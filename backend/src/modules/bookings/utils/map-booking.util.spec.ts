import { Prisma, BookingType } from '@prisma/client';
import { mapBooking, mapBookingDetail } from './map-booking.util';

const D = (n: string) => new Prisma.Decimal(n);

function tripBookingRow(over: Partial<Record<string, unknown>> = {}) {
  const start = new Date('2026-10-01T00:00:00Z');
  const { snapshotOverride, ...rowOver } = over as {
    snapshotOverride?: Record<string, unknown>;
  } & Record<string, unknown>;
  return {
    id: 'booking-1',
    userId: 'user-1',
    reference: 'TRP-ABC123',
    method: 'single_resource',
    singleResourceKind: 'trip',
    tripTemplateId: null,
    status: 'hold',
    startDate: start,
    endDate: new Date('2026-10-03T00:00:00Z'),
    subtotalUsd: D('300'),
    discountUsd: D('0'),
    totalUsd: D('300'),
    expiresAt: new Date('2026-10-01T00:15:00Z'),
    cancelledAt: null,
    cancelReason: null,
    refundPercentage: null,
    qrCodeUrl: null,
    createdAt: new Date('2026-09-30T23:00:00Z'),
    updatedAt: new Date('2026-09-30T23:00:00Z'),
    deletedAt: null,
    items: [
      {
        id: 'item-1',
        bookingType: BookingType.trip_package,
        tripId: 'trip-1',
        hotelRoomId: null,
        vehicleId: null,
        guideId: null,
        startDate: start,
        endDate: new Date('2026-10-03T00:00:00Z'),
        quantity: 2,
        unitPriceUsd: D('150'),
        subtotalUsd: D('300'),
        snapshot: snapshotOverride ?? {
          name: 'Angkor Highlights',
          coverImageUrl: 'https://img/x.jpg',
          specialRequests: 'Vegetarian meals',
        },
      },
    ],
    ...rowOver,
  } as never;
}

describe('mapBooking', () => {
  it('emits the documented public DTO with derived presentation fields', () => {
    const dto = mapBooking(tripBookingRow());
    expect(dto.type).toBe('trip');
    expect(dto.name).toBe('Angkor Highlights');
    expect(dto.coverImageUrl).toBe('https://img/x.jpg');
    expect(dto.totalPriceUsd).toBe(300);
    expect(dto.holdExpiresAt).toBe('2026-10-01T00:15:00.000Z');
    expect(dto.status).toBe('HOLD');
    expect(dto.specialRequests).toBe('Vegetarian meals');
    expect(dto.refundAmountUsd).toBeNull();
  });

  it('returns null location when no location-ish snapshot key is present', () => {
    expect(mapBooking(tripBookingRow()).location).toBeNull();
  });

  it('derives location from meetingPoint (trip), pickupLocation (transport) and province (guide)', () => {
    const withSnapshot = (snapshot: Record<string, unknown>) =>
      mapBooking(tripBookingRow({ snapshotOverride: snapshot })).location;

    expect(
      withSnapshot({ name: 'Trip', meetingPoint: 'Pub Street, Siem Reap' }),
    ).toBe('Pub Street, Siem Reap');
    expect(
      withSnapshot({ name: 'Van', pickupLocation: 'Siem Reap Airport' }),
    ).toBe('Siem Reap Airport');
    expect(withSnapshot({ name: 'Guide', province: 'Kampot' })).toBe('Kampot');
    // pickupLocation wins over the other keys when several are present.
    expect(
      withSnapshot({
        name: 'X',
        pickupLocation: 'A',
        meetingPoint: 'B',
        province: 'C',
      }),
    ).toBe('A');
  });

  it('computes refundAmountUsd from refundPercentage when cancelled', () => {
    const dto = mapBooking(
      tripBookingRow({
        status: 'cancelled',
        refundPercentage: 50,
        totalUsd: D('300'),
        cancelledAt: new Date('2026-09-30T23:30:00Z'),
      }),
    );
    expect(dto.status).toBe('CANCELLED');
    expect(dto.refundAmountUsd).toBe(150);
  });

  it('derives type from the item bookingType when singleResourceKind is null', () => {
    const dto = mapBooking(tripBookingRow({ singleResourceKind: null }));
    expect(dto.type).toBe('trip');
  });
});

describe('mapBookingDetail', () => {
  it('flattens items with name and totalPriceUsd', () => {
    const dto = mapBookingDetail(tripBookingRow());
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].name).toBe('Angkor Highlights');
    expect(dto.items[0].totalPriceUsd).toBe(300);
    expect(dto.items[0].quantity).toBe(2);
  });
});
