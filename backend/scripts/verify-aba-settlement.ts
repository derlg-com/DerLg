/**
 * Runtime verification of ABA settlement.
 *
 * Boots a real Nest application context and drives `AbaKhqrService.parseCreditAlert`
 * + `PaymentsService.settleAbaAlert` with the exact text ABA's bot posts. This is
 * everything the Telegram listener does except receiving the message, so it
 * exercises the real parser, the real Redis de-duplication and the real database
 * writes rather than mocks.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { AbaKhqrService } from '../src/modules/payments/services/aba-khqr.service';
import { PaymentsService } from '../src/modules/payments/services/payments.service';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
}

/** Mirrors ABA's real credit-alert wording. */
function alertText(amountUsd: number, trxId: string): string {
  return (
    `$${amountUsd.toFixed(2)} paid by TEP SOMNANG (*476) on Sep 01, 04:20 PM ` +
    `via ABA PAY at TEST MERCHANT. Trx. ID: ${trxId}, APV: 400834.`
  );
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);
  const aba = app.get(AbaKhqrService);
  const payments = app.get(PaymentsService);

  const bookingId = require('fs')
    .readFileSync('/tmp/verify-booking-id', 'utf8')
    .trim();

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { id: true, userId: true, reference: true, status: true, totalUsd: true },
  });
  const amount = Number(booking.totalUsd);
  const trxId = `9${Date.now()}`.slice(0, 15);

  // ---------------------------------------------------------------- parse
  const parsed = aba.parseCreditAlert(alertText(amount, trxId));
  check('parses the real ABA alert wording', parsed !== null);
  check('extracts the exact amount', parsed?.amountUsd === amount, `got ${parsed?.amountUsd}`);
  check('extracts the transaction id', parsed?.trxId === trxId);
  check('extracts the payer phone suffix', parsed?.phoneSuffix === '476');
  if (!parsed) throw new Error('parser returned null; cannot continue');

  // -------------------------------------------------------------- settle
  const settledId = await payments.settleAbaAlert(parsed);
  check('settles the matching pending payment', settledId !== null);

  const after = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { status: true, qrCodeUrl: true },
  });
  check('booking becomes confirmed', after.status === 'confirmed', `status=${after.status}`);
  check(
    'ticket QR generated locally as a data URL (not a third-party service)',
    (after.qrCodeUrl ?? '').startsWith('data:image/png;base64,'),
  );

  const paid = await prisma.payment.findFirstOrThrow({
    where: { bookingId, provider: 'aba' },
    select: { status: true, paidAt: true, providerPaymentId: true },
  });
  check('payment marked succeeded', paid.status === 'succeeded');
  check('paidAt recorded', paid.paidAt !== null);
  check(
    'bank transaction id stored for reconciliation',
    paid.providerPaymentId === `aba_${trxId}`,
    paid.providerPaymentId ?? 'null',
  );

  const holdKey = await redis.get(`booking_hold:${bookingId}`);
  check('Redis hold released', holdKey === null);

  // ------------------------------------------------------------- replay
  const replay = await payments.settleAbaAlert(parsed);
  check('a redelivered alert is ignored (idempotent)', replay === null);

  // ----------------------------------------------------------- ambiguity
  // Two pending ABA payments for the same amount must settle NOTHING.
  const future = new Date(Date.now() + 10 * 60 * 1000);
  const twin = 55.55;
  const [a, b] = await Promise.all([
    prisma.payment.create({
      data: {
        bookingId,
        userId: booking.userId,
        provider: 'aba',
        amountUsd: twin,
        currency: 'usd',
        status: 'pending',
        qrPayload: 'test-a',
        qrExpiresAt: future,
      },
      select: { id: true },
    }),
    prisma.payment.create({
      data: {
        bookingId,
        userId: booking.userId,
        provider: 'aba',
        amountUsd: twin,
        currency: 'usd',
        status: 'pending',
        qrPayload: 'test-b',
        qrExpiresAt: future,
      },
      select: { id: true },
    }),
  ]);

  const ambiguous = aba.parseCreditAlert(alertText(twin, `8${Date.now()}`.slice(0, 15)))!;
  const ambiguousResult = await payments.settleAbaAlert(ambiguous);
  check('an ambiguous alert settles nothing', ambiguousResult === null);

  const stillPending = await prisma.payment.findMany({
    where: { id: { in: [a.id, b.id] } },
    select: { status: true },
  });
  check(
    'neither candidate was settled on a guess',
    stillPending.every((p) => p.status === 'pending'),
  );

  // --------------------------------------------------------- unmatched
  const orphan = aba.parseCreditAlert(alertText(1234.56, `7${Date.now()}`.slice(0, 15)))!;
  check('an alert with no match settles nothing', (await payments.settleAbaAlert(orphan)) === null);

  // --------------------------------------------- manual settle (admin path)
  const manual = await payments.settleManually({
    paymentId: a.id,
    abaTrxId: `6${Date.now()}`.slice(0, 15),
    adminUserId: 'verify-admin',
  });
  check('operator can settle an ambiguous payment by hand', manual.paymentId === a.id);
  const manualPaid = await prisma.payment.findUniqueOrThrow({
    where: { id: a.id },
    select: { status: true, providerPaymentId: true },
  });
  check('manually settled payment is succeeded', manualPaid.status === 'succeeded');
  check(
    'manual settlement records the bank transaction id',
    (manualPaid.providerPaymentId ?? '').startsWith('aba_'),
  );

  // Re-settling the same payment must be refused.
  let refused = false;
  try {
    await payments.settleManually({
      paymentId: a.id,
      abaTrxId: `5${Date.now()}`.slice(0, 15),
      adminUserId: 'verify-admin',
    });
  } catch {
    refused = true;
  }
  check('re-settling an already-settled payment is refused', refused);

  // ------------------------------------------------------------- cleanup
  await prisma.payment.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  await redis.delByPattern('aba:trx:*');

  await app.close();

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(
      `  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.pass ? ` (${r.detail})` : ''}`,
    );
  }
  console.log('');
  console.log(
    failed.length === 0
      ? `  ALL ${results.length} SETTLEMENT CHECKS PASSED`
      : `  ${failed.length} of ${results.length} FAILED`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

void main().catch((error: Error) => {
  console.error('VERIFICATION ERROR:', error.message);
  process.exit(1);
});
