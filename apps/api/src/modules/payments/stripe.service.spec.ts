import { ConfigService } from '@nestjs/config';

import { ErrorCode } from '../../common/errors/error-codes';
import { StripeService } from './stripe.service';

/**
 * The Stripe SDK is mocked wholesale: these tests assert how DerLg *uses* it
 * (idempotency keys, metadata, signature handling), never Stripe's own behaviour,
 * and they never touch the network.
 */
const paymentIntents = {
  create: jest.fn(),
  retrieve: jest.fn(),
};
const refunds = { create: jest.fn() };
const webhooks = { constructEvent: jest.fn() };

jest.mock('stripe', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ paymentIntents, refunds, webhooks })),
  };
});

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('StripeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  describe('when no secret key is configured', () => {
    const service = new StripeService(configWith({}));

    it('reports itself unconfigured instead of throwing at construction', () => {
      expect(service.isConfigured).toBe(false);
      expect(service.canVerifyWebhooks).toBe(false);
    });

    it('answers 503 rather than 500 when a payment is attempted', async () => {
      await expect(
        service.createPaymentIntent({
          amountCents: 1000,
          currency: 'USD',
          bookingId: 'b1',
          bookingReference: 'DLG-2026-0001',
          customerEmail: 'a@b.com',
          idempotencyKey: 'k',
        }),
      ).rejects.toMatchObject({ code: ErrorCode.PAYMENT_FAILED, status: 503 });
    });

    it('refuses to verify a webhook it has no secret for', () => {
      expect(() => service.constructWebhookEvent('{}', 'sig')).toThrow(
        expect.objectContaining({ code: ErrorCode.PAYMENT_SIGNATURE_INVALID, status: 503 }),
      );
    });
  });

  describe('when configured', () => {
    let service: StripeService;

    beforeEach(() => {
      service = new StripeService(
        configWith({ STRIPE_SECRET_KEY: 'sk_test_x'.repeat(3), STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' }),
      );
    });

    it('creates an intent in the smallest currency unit with booking metadata', async () => {
      paymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: 'cs_1' });

      await service.createPaymentIntent({
        amountCents: 37_800,
        currency: 'USD',
        bookingId: 'booking-1',
        bookingReference: 'DLG-2026-0042',
        customerEmail: 'sok@example.com',
        idempotencyKey: 'booking-booking-1-37800',
      });

      const [params, options] = paymentIntents.create.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(params).toMatchObject({
        amount: 37_800,
        currency: 'usd',
        receipt_email: 'sok@example.com',
        metadata: { bookingId: 'booking-1', bookingReference: 'DLG-2026-0042' },
      });
      // The idempotency key is what stops a double-clicked button double-charging.
      expect(options.idempotencyKey).toBe('booking-booking-1-37800');
    });

    it('passes the raw body and signature through to Stripe for verification', () => {
      webhooks.constructEvent.mockReturnValue({ type: 'payment_intent.succeeded' });
      const raw = Buffer.from('{"id":"evt_1"}');

      const event = service.constructWebhookEvent(raw, 'sig_header');

      expect(webhooks.constructEvent).toHaveBeenCalledWith(raw, 'sig_header', 'whsec_test_secret');
      expect(event).toEqual({ type: 'payment_intent.succeeded' });
    });

    it('rejects a webhook with no signature header', () => {
      expect(() => service.constructWebhookEvent('{}', undefined)).toThrow(
        expect.objectContaining({ code: ErrorCode.PAYMENT_SIGNATURE_INVALID, status: 400 }),
      );
      expect(webhooks.constructEvent).not.toHaveBeenCalled();
    });

    it('turns a failed signature check into a 400 without leaking Stripe internals', () => {
      webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      let caught: { code?: string; message?: string } = {};
      try {
        service.constructWebhookEvent('{}', 'bad_sig');
      } catch (error) {
        caught = error as { code?: string; message?: string };
      }

      expect(caught.code).toBe(ErrorCode.PAYMENT_SIGNATURE_INVALID);
      expect(caught.message).toBe('That webhook signature could not be verified.');
      expect(caught.message).not.toContain('expected signature');
    });

    it('refunds a specific amount against the original intent', async () => {
      refunds.create.mockResolvedValue({ id: 're_1' });

      await service.refund({ paymentIntentId: 'pi_1', amountCents: 18_900, reason: 'requested_by_customer' });

      expect(refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_1',
        amount: 18_900,
        reason: 'requested_by_customer',
      });
    });

    it('reuses one client across calls rather than constructing per request', async () => {
      paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1' });

      await service.retrievePaymentIntent('pi_1');
      await service.retrievePaymentIntent('pi_1');

      const StripeConstructor = (await import('stripe')).default as unknown as jest.Mock;
      expect(StripeConstructor).toHaveBeenCalledTimes(1);
    });
  });
});
