import { BookingStatus, PaymentStatus } from '@prisma/client';
import type Stripe from 'stripe';

import { ErrorCode } from '../../common/errors/error-codes';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

function bookingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    reference: 'DLG-2026-0042',
    userId: 'user-1',
    status: BookingStatus.HOLD,
    totalCents: 37_800,
    currency: 'USD',
    contactEmail: 'sok@example.com',
    startDate: new Date('2027-05-10T00:00:00.000Z'),
    holdExpiresAt: new Date(Date.now() + 600_000),
    ...overrides,
  };
}

function intent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return { id: 'pi_1', ...overrides } as Stripe.PaymentIntent;
}

describe('PaymentsService', () => {
  let prisma: {
    payment: { findFirst: jest.Mock; upsert: jest.Mock; update: jest.Mock };
  };
  let stripe: {
    createPaymentIntent: jest.Mock;
    retrievePaymentIntent: jest.Mock;
    refund: jest.Mock;
  };
  let bookings: {
    loadOwned: jest.Mock;
    markPendingPayment: jest.Mock;
    markConfirmed: jest.Mock;
    cancel: jest.Mock;
  };
  let service: PaymentsService;

  beforeEach(() => {
    prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'payment-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    stripe = {
      createPaymentIntent: jest.fn().mockResolvedValue(intent({ client_secret: 'cs_1' })),
      retrievePaymentIntent: jest.fn(),
      refund: jest.fn().mockResolvedValue({ id: 're_1' }),
    };
    bookings = {
      loadOwned: jest.fn().mockResolvedValue(bookingRecord()),
      markPendingPayment: jest.fn().mockResolvedValue(undefined),
      markConfirmed: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      cancel: jest.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.CANCELLED }),
    };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
      bookings as unknown as BookingsService,
      'pk_test_visible',
    );
  });

  describe('createIntent', () => {
    it('charges the amount from the booking, not from the caller', async () => {
      const view = await service.createIntent('user-1', 'booking-1');

      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 37_800,
          currency: 'USD',
          bookingReference: 'DLG-2026-0042',
          customerEmail: 'sok@example.com',
          idempotencyKey: 'booking-booking-1-37800',
        }),
      );
      expect(view).toMatchObject({
        clientSecret: 'cs_1',
        amountCents: 37_800,
        bookingReference: 'DLG-2026-0042',
        publishableKey: 'pk_test_visible',
      });
    });

    it('moves the booking into the payment stage', async () => {
      await service.createIntent('user-1', 'booking-1');

      expect(bookings.markPendingPayment).toHaveBeenCalledWith('booking-1');
    });

    it('resumes an existing intent instead of creating a second charge', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        stripePaymentIntentId: 'pi_existing',
        amountCents: 37_800,
        currency: 'USD',
      });
      stripe.retrievePaymentIntent.mockResolvedValue(
        intent({ id: 'pi_existing', client_secret: 'cs_existing', status: 'requires_payment_method' }),
      );

      const view = await service.createIntent('user-1', 'booking-1');

      expect(view.clientSecret).toBe('cs_existing');
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('creates a fresh intent when the amount has changed since last time', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        stripePaymentIntentId: 'pi_stale',
        // The traveller edited the trip, so the old intent is for the wrong amount.
        amountCents: 20_000,
        currency: 'USD',
      });

      await service.createIntent('user-1', 'booking-1');

      expect(stripe.retrievePaymentIntent).not.toHaveBeenCalled();
      expect(stripe.createPaymentIntent).toHaveBeenCalled();
    });

    it('creates a fresh intent when the old one was cancelled at Stripe', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        stripePaymentIntentId: 'pi_dead',
        amountCents: 37_800,
        currency: 'USD',
      });
      stripe.retrievePaymentIntent.mockResolvedValue(
        intent({ id: 'pi_dead', client_secret: 'cs_dead', status: 'canceled' }),
      );

      await service.createIntent('user-1', 'booking-1');

      expect(stripe.createPaymentIntent).toHaveBeenCalled();
    });

    it('refuses to charge for a booking that is already confirmed', async () => {
      bookings.loadOwned.mockResolvedValue(bookingRecord({ status: BookingStatus.CONFIRMED }));

      await expect(service.createIntent('user-1', 'booking-1')).rejects.toMatchObject({
        code: ErrorCode.BOOKING_INVALID_STATE,
      });
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it.each([BookingStatus.EXPIRED, BookingStatus.CANCELLED])(
      'refuses to charge for a %s booking',
      async (status) => {
        bookings.loadOwned.mockResolvedValue(bookingRecord({ status }));

        await expect(service.createIntent('user-1', 'booking-1')).rejects.toMatchObject({
          code: ErrorCode.BOOKING_INVALID_STATE,
        });
      },
    );

    it('refuses to charge once the hold window has closed', async () => {
      bookings.loadOwned.mockResolvedValue(
        bookingRecord({ holdExpiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.createIntent('user-1', 'booking-1')).rejects.toMatchObject({
        code: ErrorCode.BOOKING_HOLD_EXPIRED,
      });
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent', () => {
    function paymentRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'payment-1',
        bookingId: 'booking-1',
        status: PaymentStatus.REQUIRES_PAYMENT,
        amountCents: 37_800,
        booking: { status: BookingStatus.PENDING_PAYMENT, reference: 'DLG-2026-0042' },
        ...overrides,
      };
    }

    it('confirms the booking on payment_intent.succeeded', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentRow());

      const result = await service.handleEvent({
        type: 'payment_intent.succeeded',
        data: { object: intent() },
      } as Stripe.Event);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: PaymentStatus.SUCCEEDED, failureReason: null },
      });
      expect(bookings.markConfirmed).toHaveBeenCalledWith('booking-1');
      expect(result).toEqual({ handled: true, bookingId: 'booking-1' });
    });

    it('is idempotent: a replayed success does not confirm twice', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        paymentRow({ status: PaymentStatus.SUCCEEDED, booking: { status: BookingStatus.CONFIRMED, reference: 'x' } }),
      );

      const result = await service.handleEvent({
        type: 'payment_intent.succeeded',
        data: { object: intent() },
      } as Stripe.Event);

      expect(result.handled).toBe(true);
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(bookings.markConfirmed).not.toHaveBeenCalled();
    });

    it('does not re-confirm a booking that is already confirmed', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        paymentRow({ booking: { status: BookingStatus.CONFIRMED, reference: 'x' } }),
      );

      await service.handleEvent({
        type: 'payment_intent.succeeded',
        data: { object: intent() },
      } as Stripe.Event);

      expect(bookings.markConfirmed).not.toHaveBeenCalled();
    });

    it('records the decline reason on failure and leaves the hold alone', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentRow());

      await service.handleEvent({
        type: 'payment_intent.payment_failed',
        data: {
          object: intent({
            last_payment_error: { message: 'Your card was declined.', code: 'card_declined' },
          } as Partial<Stripe.PaymentIntent>),
        },
      } as Stripe.Event);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: PaymentStatus.FAILED, failureReason: 'Your card was declined.' },
      });
      // The traveller can retry with another card until the hold lapses.
      expect(bookings.markConfirmed).not.toHaveBeenCalled();
      expect(bookings.cancel).not.toHaveBeenCalled();
    });

    it('marks a cancelled intent as failed', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentRow());

      await service.handleEvent({
        type: 'payment_intent.canceled',
        data: { object: intent() },
      } as Stripe.Event);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: PaymentStatus.FAILED, failureReason: 'The payment was cancelled.' },
      });
    });

    it('ignores an event type it does not handle', async () => {
      await expect(
        service.handleEvent({ type: 'customer.created', data: { object: {} } } as Stripe.Event),
      ).resolves.toEqual({ handled: false });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('ignores an event for a payment intent it does not know', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.handleEvent({
          type: 'payment_intent.succeeded',
          data: { object: intent({ id: 'pi_unknown' }) },
        } as Stripe.Event),
      ).resolves.toEqual({ handled: false });
      expect(bookings.markConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('cancelWithRefund', () => {
    it('refunds in full and cancels when far from departure', async () => {
      bookings.loadOwned.mockResolvedValue(
        bookingRecord({ status: BookingStatus.CONFIRMED, startDate: new Date(Date.now() + 30 * 86_400_000) }),
      );
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        stripePaymentIntentId: 'pi_1',
        amountCents: 37_800,
        refundedCents: 0,
      });

      const result = await service.cancelWithRefund('user-1', 'booking-1');

      expect(stripe.refund).toHaveBeenCalledWith({
        paymentIntentId: 'pi_1',
        amountCents: 37_800,
        reason: 'requested_by_customer',
      });
      expect(result.refund).toMatchObject({ tier: 'FULL', amountCents: 37_800 });
      expect(bookings.cancel).toHaveBeenCalledWith('user-1', 'booking-1');
    });

    it('cancels without calling Stripe when the tier refunds nothing', async () => {
      bookings.loadOwned.mockResolvedValue(
        bookingRecord({ status: BookingStatus.CONFIRMED, startDate: new Date(Date.now() + 3600_000) }),
      );
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        stripePaymentIntentId: 'pi_1',
        amountCents: 37_800,
        refundedCents: 0,
      });

      const result = await service.cancelWithRefund('user-1', 'booking-1');

      expect(stripe.refund).not.toHaveBeenCalled();
      expect(result.refund).toMatchObject({ tier: 'NONE', amountCents: 0 });
      expect(bookings.cancel).toHaveBeenCalled();
    });

    it('cancels an unpaid hold with no refund at all', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      const result = await service.cancelWithRefund('user-1', 'booking-1');

      expect(stripe.refund).not.toHaveBeenCalled();
      expect(result.refund.amountCents).toBe(0);
      expect(bookings.cancel).toHaveBeenCalled();
    });
  });
});
