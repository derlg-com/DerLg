import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, BookingStatus } from '@prisma/client';

import { PaymentsService } from './payments.service';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,stub'),
}));

/**
 * Manual intervention — the operator escape hatch for ABA.
 *
 * These paths exist because `settleAbaAlert` refuses to guess when two pending
 * payments share an amount. That safety choice is only usable if a human can
 * finish the job, and since the human is confirming a booking as paid, the guards
 * around it are the whole point.
 */
describe('PaymentsService manual intervention', () => {
  let service: PaymentsService;
  let prisma: {
    booking: { findUnique: jest.Mock; updateMany: jest.Mock };
    payment: { findUnique: jest.Mock; update: jest.Mock };
    refund: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let redisClient: { set: jest.Mock; publish: jest.Mock };
  let releaseHold: { release: jest.Mock };

  const ABA_PENDING = {
    id: 'pay-1',
    bookingId: 'bk-1',
    provider: PaymentProvider.aba,
    status: PaymentStatus.pending,
    amountUsd: 189,
  };

  beforeEach(() => {
    prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({ reference: 'DERLG-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      refund: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(prisma),
      ),
    };
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      publish: jest.fn().mockResolvedValue(1),
    };
    releaseHold = { release: jest.fn().mockResolvedValue(undefined) };

    service = new PaymentsService(
      prisma as never,
      { getClient: () => redisClient } as never,
      { toCents: (usd: number) => Math.round(usd * 100) } as never,
      { isConfigured: () => true } as never,
      releaseHold as never,
    );
  });

  describe('settleManually', () => {
    const request = {
      paymentId: 'pay-1',
      abaTrxId: '178220228091798',
      adminUserId: 'admin-1',
    };

    it('settles through the same path as an automatic alert', async () => {
      // One place a booking becomes confirmed. A separate write here would be a
      // second way to reach `confirmed` that could drift from the first.
      prisma.payment.findUnique
        .mockResolvedValueOnce(ABA_PENDING)
        .mockResolvedValueOnce(null); // trx id not yet used

      await expect(service.settleManually(request)).resolves.toEqual({
        paymentId: 'pay-1',
        bookingId: 'bk-1',
      });

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          status: PaymentStatus.succeeded,
          providerPaymentId: 'aba_178220228091798',
        }),
      });
      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.confirmed }),
        }),
      );
      expect(releaseHold.release).toHaveBeenCalledWith('bk-1');
    });

    it('claims the transaction id so a late alert is not reported unmatched', async () => {
      prisma.payment.findUnique
        .mockResolvedValueOnce(ABA_PENDING)
        .mockResolvedValueOnce(null);

      await service.settleManually(request);

      expect(redisClient.set).toHaveBeenCalledWith(
        'aba:trx:178220228091798',
        '1',
        'EX',
        expect.any(Number),
        'NX',
      );
    });

    it('refuses to settle a card payment', async () => {
      // Cards settle by webhook. An override here would confirm a booking Stripe
      // never charged for.
      prisma.payment.findUnique.mockResolvedValueOnce({
        ...ABA_PENDING,
        provider: PaymentProvider.stripe,
      });

      await expect(service.settleManually(request)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('refuses a payment that has already settled', async () => {
      // A double-click must not look like two confirmations.
      prisma.payment.findUnique.mockResolvedValueOnce({
        ...ABA_PENDING,
        status: PaymentStatus.succeeded,
      });

      await expect(service.settleManually(request)).rejects.toThrow(
        /already been settled/,
      );
    });

    it('refuses a transaction id that already settled another payment', async () => {
      // One bank transaction cannot pay for two bookings.
      prisma.payment.findUnique
        .mockResolvedValueOnce(ABA_PENDING)
        .mockResolvedValueOnce({ id: 'pay-other' });

      await expect(service.settleManually(request)).rejects.toThrow(
        /already settled another payment/,
      );
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('allows re-settling when the trx id is already on this same payment', async () => {
      prisma.payment.findUnique
        .mockResolvedValueOnce(ABA_PENDING)
        .mockResolvedValueOnce({ id: 'pay-1' });

      await expect(service.settleManually(request)).resolves.toMatchObject({
        paymentId: 'pay-1',
      });
    });

    it('throws NotFound for an unknown payment', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(null);

      await expect(service.settleManually(request)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeManualRefund', () => {
    const request = {
      refundId: 'rf-1',
      providerRefundId: 'ABA-TRANSFER-9931',
      adminUserId: 'admin-1',
    };

    const PENDING_ABA_REFUND = {
      id: 'rf-1',
      status: PaymentStatus.pending,
      amountUsd: 50,
      payment: {
        id: 'pay-1',
        provider: PaymentProvider.aba,
        amountUsd: 100,
        refundedAmountUsd: 0,
      },
    };

    it('records the payout and moves the payment total', async () => {
      // The refund row is written as `pending` at cancellation time and the
      // payment's own total is deliberately left alone until here — the books must
      // not show money returned before it was.
      prisma.refund.findUnique.mockResolvedValue(PENDING_ABA_REFUND);

      await expect(service.completeManualRefund(request)).resolves.toEqual({
        refundId: 'rf-1',
        paymentId: 'pay-1',
      });

      expect(prisma.refund.update).toHaveBeenCalledWith({
        where: { id: 'rf-1' },
        data: {
          status: PaymentStatus.succeeded,
          providerRefundId: 'ABA-TRANSFER-9931',
          processedById: 'admin-1',
        },
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: {
          refundedAmountUsd: 50,
          status: PaymentStatus.partially_refunded,
        },
      });
    });

    it('marks the payment fully refunded when the payout clears the balance', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        ...PENDING_ABA_REFUND,
        amountUsd: 100,
      });

      await service.completeManualRefund(request);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { refundedAmountUsd: 100, status: PaymentStatus.refunded },
      });
    });

    it('accumulates on top of an earlier partial refund', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        ...PENDING_ABA_REFUND,
        amountUsd: 40,
        payment: { ...PENDING_ABA_REFUND.payment, refundedAmountUsd: 60 },
      });

      await service.completeManualRefund(request);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { refundedAmountUsd: 100, status: PaymentStatus.refunded },
      });
    });

    it('refuses a card refund', async () => {
      // Stripe settles those itself; there is nothing for a human to confirm.
      prisma.refund.findUnique.mockResolvedValue({
        ...PENDING_ABA_REFUND,
        payment: {
          ...PENDING_ABA_REFUND.payment,
          provider: PaymentProvider.stripe,
        },
      });

      await expect(service.completeManualRefund(request)).rejects.toThrow(
        /processed by Stripe/,
      );
      expect(prisma.refund.update).not.toHaveBeenCalled();
    });

    it('refuses a refund already recorded as paid out', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        ...PENDING_ABA_REFUND,
        status: PaymentStatus.succeeded,
      });

      await expect(service.completeManualRefund(request)).rejects.toThrow(
        /already recorded as paid out/,
      );
    });

    it('throws NotFound for an unknown refund', async () => {
      prisma.refund.findUnique.mockResolvedValue(null);

      await expect(service.completeManualRefund(request)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
