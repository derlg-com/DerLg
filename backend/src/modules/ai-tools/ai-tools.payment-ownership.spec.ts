import { NotFoundException } from '@nestjs/common';

import { AiToolsService } from './ai-tools.service';

/**
 * `checkPaymentStatus` is now scoped to the booking's owner.
 *
 * It returned a booking's amount, payment method and paid-at time for any
 * `booking_id`, with no ownership check anywhere in the path — so whoever held
 * (or proxied) the service key could read any customer's payment record. The web
 * BFF exposed that route publicly, which made it reachable from a browser with no
 * session at all.
 */
describe('AiToolsService.checkPaymentStatus ownership', () => {
  let service: AiToolsService;
  let findFirst: jest.Mock;

  const OWNER = '11111111-1111-4111-8111-111111111111';
  const BOOKING = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    findFirst = jest.fn();
    service = new AiToolsService(
      { booking: { findFirst } } as never,
      { get: jest.fn() },
      { getClient: jest.fn() },
    );
  });

  it('scopes the lookup to the requesting user in the query itself', async () => {
    // Filtering in `where` rather than comparing after the fetch means another
    // user's booking is indistinguishable from one that does not exist, so there
    // is no "wrong owner" signal to enumerate against.
    findFirst.mockResolvedValue({
      id: BOOKING,
      status: 'confirmed',
      payments: [],
    });

    await service.checkPaymentStatus(BOOKING, OWNER);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING, userId: OWNER },
      }),
    );
  });

  it('returns 404 for a booking the caller does not own', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.checkPaymentStatus(BOOKING, 'someone-else'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the payment summary for the owner', async () => {
    findFirst.mockResolvedValue({
      id: BOOKING,
      status: 'confirmed',
      payments: [
        {
          id: 'pay-1',
          status: 'succeeded',
          amountUsd: '189.00',
          provider: 'BAKONG',
          paidAt: new Date('2026-01-02T03:04:05.000Z'),
        },
      ],
    });

    await expect(service.checkPaymentStatus(BOOKING, OWNER)).resolves.toEqual({
      booking_id: BOOKING,
      booking_status: 'confirmed',
      payment_intent_id: 'pay-1',
      status: 'succeeded',
      amount_usd: 189,
      method: 'BAKONG',
      paid_at: '2026-01-02T03:04:05.000Z',
    });
  });

  it('reports pending when the booking has no payment yet', async () => {
    findFirst.mockResolvedValue({
      id: BOOKING,
      status: 'hold',
      payments: [],
    });

    await expect(
      service.checkPaymentStatus(BOOKING, OWNER),
    ).resolves.toMatchObject({
      status: 'pending',
      payment_intent_id: null,
      amount_usd: null,
    });
  });
});
