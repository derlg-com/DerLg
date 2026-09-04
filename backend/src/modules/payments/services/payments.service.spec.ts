import { PaymentStatus, PaymentProvider, BookingStatus } from '@prisma/client';
import type Stripe from 'stripe';

import { PaymentsService } from './payments.service';
import { PaymentMethod } from '../dto/payments.dto';

/*
 * Settlement renders a ticket QR, and PNG encoding is real work — around 150ms a
 * call. Multiplied across the settlement cases, and running alongside 47 other
 * suites, that was enough to push individual tests past Jest's 5s timeout and make
 * them fail intermittently.
 *
 * Nothing here asserts on the image, so it is stubbed. `AbaKhqrService`'s own spec
 * covers the payload that actually matters.
 */
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,stub'),
}));

/**
 * Settlement behaviour — the part where money and bookings meet.
 *
 * The emphasis is on what must NOT happen: settling twice, settling the wrong
 * booking, settling for less than was owed, or reporting a refund that never
 * moved money.
 */
describe('PaymentsService settlement', () => {
  let service: PaymentsService;
  let prisma: {
    booking: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    payment: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
    refund: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let redisClient: { set: jest.Mock; publish: jest.Mock };
  let stripe: {
    fromCents: jest.Mock;
    toCents: jest.Mock;
    refund: jest.Mock;
    isConfigured: jest.Mock;
  };
  let releaseHold: { release: jest.Mock };

  beforeEach(() => {
    prisma = {
      booking: {
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ reference: 'DERLG-TEST-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      payment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn(),
      },
      refund: { create: jest.fn().mockResolvedValue({}) },
      // Runs the callback against the same mocks, so assertions can inspect the
      // writes a transaction would perform.
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(prisma),
      ),
    };

    redisClient = {
      // 'OK' = the SET NX succeeded, i.e. this transaction id is new.
      set: jest.fn().mockResolvedValue('OK'),
      publish: jest.fn().mockResolvedValue(1),
    };

    stripe = {
      fromCents: jest.fn((cents: number) => cents / 100),
      toCents: jest.fn((usd: number) => Math.round(usd * 100)),
      refund: jest.fn().mockResolvedValue({ id: 're_1' }),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    releaseHold = { release: jest.fn().mockResolvedValue(undefined) };

    service = new PaymentsService(
      prisma as never,
      { getClient: () => redisClient } as never,
      stripe as never,
      { isConfigured: () => true, buildDynamicQr: jest.fn() } as never,
      releaseHold as never,
    );
  });

  // -------------------------------------------------------------------------
  describe('settleAbaAlert', () => {
    const alert = {
      amountUsd: 5,
      phoneSuffix: '476',
      trxId: '178220228091798',
    };

    it('settles the single matching pending payment', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-1', bookingId: 'bk-1', amountUsd: 5 },
      ]);

      await expect(service.settleAbaAlert(alert)).resolves.toBe('pay-1');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          status: PaymentStatus.succeeded,
          providerPaymentId: 'aba_178220228091798',
        }),
      });
      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'bk-1' }),
          data: expect.objectContaining({ status: BookingStatus.confirmed }),
        }),
      );
      // A confirmed booking owns its inventory outright.
      expect(releaseHold.release).toHaveBeenCalledWith('bk-1');
    });

    it('scopes the lookup to unexpired pending ABA payments only', async () => {
      // Without the provider filter an ABA alert could settle a Bakong row that
      // happened to share an amount.
      await service.settleAbaAlert(alert);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            provider: PaymentProvider.aba,
            status: PaymentStatus.pending,
            amountUsd: 5,
            qrExpiresAt: { gt: expect.any(Date) },
          }),
        }),
      );
    });

    it('ignores a redelivered alert without touching the database', async () => {
      // SET NX returns null when the key already exists.
      redisClient.set.mockResolvedValue(null);

      await expect(service.settleAbaAlert(alert)).resolves.toBeNull();

      expect(prisma.payment.findMany).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('keys de-duplication on the transaction id', async () => {
      await service.settleAbaAlert(alert);

      expect(redisClient.set).toHaveBeenCalledWith(
        `aba:trx:${alert.trxId}`,
        '1',
        'EX',
        expect.any(Number),
        'NX',
      );
    });

    it('refuses to settle when two payments share the amount', async () => {
      // Matching is on amount alone, so a tie is unresolvable. Picking the newest
      // would confirm one stranger's booking with another stranger's money.
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-1', bookingId: 'bk-1', amountUsd: 5 },
        { id: 'pay-2', bookingId: 'bk-2', amountUsd: 5 },
      ]);

      await expect(service.settleAbaAlert(alert)).resolves.toBeNull();

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it('alerts operators when an alert is ambiguous', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-1', bookingId: 'bk-1', amountUsd: 5 },
        { id: 'pay-2', bookingId: 'bk-2', amountUsd: 5 },
      ]);

      await service.settleAbaAlert(alert);

      const [channel, body] = redisClient.publish.mock.calls[0];
      expect(channel).toBe('admin_events');
      expect(JSON.parse(body)).toMatchObject({
        event: 'ABA_PAYMENT_AMBIGUOUS',
        trxId: alert.trxId,
      });
    });

    it('alerts operators when money arrives with no matching payment', async () => {
      prisma.payment.findMany.mockResolvedValue([]);

      await expect(service.settleAbaAlert(alert)).resolves.toBeNull();

      expect(JSON.parse(redisClient.publish.mock.calls[0][1])).toMatchObject({
        event: 'ABA_PAYMENT_UNMATCHED',
      });
    });

    it('only confirms a booking that is still payable', async () => {
      // Guards the transition in SQL so two concurrent settlements cannot both
      // apply it, and a cancelled booking cannot be revived by a late alert.
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-1', bookingId: 'bk-1', amountUsd: 5 },
      ]);

      await service.settleAbaAlert(alert);

      const call = prisma.booking.updateMany.mock.calls[0][0];
      expect(call.where.status).toEqual({
        in: [
          BookingStatus.hold,
          BookingStatus.pending_payment,
          BookingStatus.payment_failed,
        ],
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('handleStripeEvent', () => {
    const intentEvent = (intent: Partial<Stripe.PaymentIntent>) =>
      ({
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_1', amount: 500, amount_received: 500, ...intent },
        },
      }) as unknown as Stripe.Event;

    it('settles a successful intent', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        bookingId: 'bk-1',
        amountUsd: 5,
        status: PaymentStatus.pending,
      });

      await service.handleStripeEvent(intentEvent({}));

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: PaymentStatus.succeeded }),
      });
      expect(releaseHold.release).toHaveBeenCalledWith('bk-1');
    });

    it('prefers the charge id for the settlement reference', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        bookingId: 'bk-1',
        amountUsd: 5,
        status: PaymentStatus.pending,
      });

      await service.handleStripeEvent(intentEvent({ latest_charge: 'ch_99' }));

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ providerPaymentId: 'ch_99' }),
      });
    });

    it('is idempotent for a redelivered success', async () => {
      // Stripe retries until it gets a 2xx, so the same event arrives more than once.
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        bookingId: 'bk-1',
        amountUsd: 5,
        status: PaymentStatus.succeeded,
      });

      await service.handleStripeEvent(intentEvent({}));

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('refuses to confirm when Stripe reports less than the amount owed', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        bookingId: 'bk-1',
        amountUsd: 50,
        status: PaymentStatus.pending,
      });

      await service.handleStripeEvent(intentEvent({ amount_received: 500 }));

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it('tolerates a rounding difference on an exact payment', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        bookingId: 'bk-1',
        amountUsd: 5.0,
        status: PaymentStatus.pending,
      });

      await service.handleStripeEvent(intentEvent({ amount_received: 500 }));

      expect(prisma.payment.update).toHaveBeenCalled();
    });

    it('ignores a success for an unknown intent', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.handleStripeEvent(intentEvent({})),
      ).resolves.toBeUndefined();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('marks a failure without releasing the hold', async () => {
      // The customer can still retry with another card while the hold lasts.
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        bookingId: 'bk-1',
        status: PaymentStatus.pending,
      });

      await service.handleStripeEvent({
        type: 'payment_intent.payment_failed',
        data: {
          object: { id: 'pi_1', last_payment_error: { code: 'card_declined' } },
        },
      } as unknown as Stripe.Event);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: PaymentStatus.failed },
      });
      expect(releaseHold.release).not.toHaveBeenCalled();
    });

    it('does not downgrade an already-succeeded payment on a late failure', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        bookingId: 'bk-1',
        status: PaymentStatus.succeeded,
      });

      await service.handleStripeEvent({
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_1' } },
      } as unknown as Stripe.Event);

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('records a dashboard-initiated partial refund', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        amountUsd: 100,
      });

      await service.handleStripeEvent({
        type: 'charge.refunded',
        data: { object: { payment_intent: 'pi_1', amount_refunded: 4000 } },
      } as unknown as Stripe.Event);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: {
          refundedAmountUsd: 40,
          status: PaymentStatus.partially_refunded,
        },
      });
    });

    it('records a dashboard-initiated full refund', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        amountUsd: 100,
      });

      await service.handleStripeEvent({
        type: 'charge.refunded',
        data: { object: { payment_intent: 'pi_1', amount_refunded: 10000 } },
      } as unknown as Stripe.Event);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { refundedAmountUsd: 100, status: PaymentStatus.refunded },
      });
    });

    it('acknowledges an event type it does not handle', async () => {
      // Returning an error would put the event into Stripe's retry loop forever.
      await expect(
        service.handleStripeEvent({
          type: 'customer.created',
          data: { object: {} },
        } as unknown as Stripe.Event),
      ).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('refundForCancellation', () => {
    const request = {
      bookingId: 'bk-1',
      amountUsd: 50,
      percentage: 50,
      reason: 'Booking DERLG-1 cancelled',
    };

    it('refunds a card payment through Stripe', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        provider: PaymentProvider.stripe,
        stripePaymentIntentId: 'pi_1',
        amountUsd: 100,
        refundedAmountUsd: 0,
      });

      await service.refundForCancellation(request);

      expect(stripe.refund).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: 'pi_1', amountUsd: 50 }),
      );
      expect(prisma.refund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amountUsd: 50,
          percentage: 50,
          status: PaymentStatus.succeeded,
          providerRefundId: 're_1',
        }),
      });
    });

    it('uses an idempotency key derived from payment and amount', async () => {
      // A retried cancellation must not refund twice.
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        provider: PaymentProvider.stripe,
        stripePaymentIntentId: 'pi_1',
        amountUsd: 100,
        refundedAmountUsd: 0,
      });

      await service.refundForCancellation(request);

      expect(stripe.refund.mock.calls[0][0].idempotencyKey).toBe(
        'rf:pay-1:5000',
      );
    });

    it('marks the payment partially refunded', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        provider: PaymentProvider.stripe,
        stripePaymentIntentId: 'pi_1',
        amountUsd: 100,
        refundedAmountUsd: 0,
      });

      await service.refundForCancellation(request);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          refundedAmountUsd: 50,
          status: PaymentStatus.partially_refunded,
        }),
      });
    });

    it('never refunds more than remains', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        provider: PaymentProvider.stripe,
        stripePaymentIntentId: 'pi_1',
        amountUsd: 100,
        refundedAmountUsd: 80,
      });

      await service.refundForCancellation({ ...request, amountUsd: 50 });

      expect(stripe.refund.mock.calls[0][0].amountUsd).toBe(20);
    });

    it('does nothing when the payment is already fully refunded', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        provider: PaymentProvider.stripe,
        stripePaymentIntentId: 'pi_1',
        amountUsd: 100,
        refundedAmountUsd: 100,
      });

      await service.refundForCancellation(request);

      expect(stripe.refund).not.toHaveBeenCalled();
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it('queues an ABA refund for manual payout instead of claiming success', async () => {
      // ABA has no refund API. Recording it as succeeded would make the books
      // show money returned that nobody sent.
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        provider: PaymentProvider.aba,
        amountUsd: 100,
        refundedAmountUsd: 0,
      });

      await service.refundForCancellation(request);

      expect(stripe.refund).not.toHaveBeenCalled();
      expect(prisma.refund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: PaymentStatus.pending }),
      });
      // Pending payout must not move the payment's own totals.
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(JSON.parse(redisClient.publish.mock.calls[0][1])).toMatchObject({
        event: 'ABA_REFUND_REQUIRED',
      });
    });

    it('skips the 0% refund tier entirely', async () => {
      await service.refundForCancellation({ ...request, amountUsd: 0 });

      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('does nothing when the booking was never paid', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await service.refundForCancellation(request);

      expect(stripe.refund).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('startPayment guards', () => {
    const payable = {
      id: 'bk-1',
      userId: 'user-1',
      reference: 'DERLG-1',
      status: BookingStatus.hold,
      totalUsd: 100,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    };

    it('rejects a booking belonging to someone else', async () => {
      prisma.booking.findFirst.mockResolvedValue(payable);

      await expect(
        service.startPayment('intruder', 'bk-1', PaymentMethod.CARD),
      ).rejects.toThrow(/Not your booking/);
    });

    it('rejects a booking that does not exist', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.startPayment('user-1', 'bk-1', PaymentMethod.CARD),
      ).rejects.toThrow(/Booking not found/);
    });

    it('rejects an already-paid booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...payable,
        status: BookingStatus.confirmed,
      });

      await expect(
        service.startPayment('user-1', 'bk-1', PaymentMethod.CARD),
      ).rejects.toThrow(/already paid/);
    });

    it('rejects a cancelled booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...payable,
        status: BookingStatus.cancelled,
      });

      await expect(
        service.startPayment('user-1', 'bk-1', PaymentMethod.CARD),
      ).rejects.toThrow(/cannot be paid for/);
    });

    it('rejects a booking whose hold has lapsed', async () => {
      // Status still reads `hold` between the Redis TTL expiring and the sweep
      // running, so the timestamp is checked rather than trusted.
      prisma.booking.findFirst.mockResolvedValue({
        ...payable,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(
        service.startPayment('user-1', 'bk-1', PaymentMethod.CARD),
      ).rejects.toThrow(/hold on this booking has expired/);
    });

    it('rejects a zero-value booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({ ...payable, totalUsd: 0 });

      await expect(
        service.startPayment('user-1', 'bk-1', PaymentMethod.CARD),
      ).rejects.toThrow(/no payable amount/);
    });
  });
});
