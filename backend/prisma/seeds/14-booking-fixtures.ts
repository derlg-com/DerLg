// =============================================================================
// Seed: 14 — Booking fixtures for the admin panel (F110–F118)
// =============================================================================
// The admin booking, assignment and room-availability screens are meaningless
// against an empty `bookings` table. This seed creates a deliberately small,
// hand-picked set — every row exists to exercise one specific behaviour:
//
//   ADM-TRANSPORT-1  confirmed transportation, passengerCount set
//                    → driver assignment + vehicle-capacity validation
//   ADM-HOLD-1       status=hold, expiresAt in the future
//                    → status filters, hold countdown
//   ADM-EXPIRED-1    status=expired
//                    → status filters
//   ADM-DELETED-1    status=confirmed but deletedAt set
//                    → proof the admin list excludes soft-deleted rows
//   ADM-HOTEL-1      confirmed hotel_room over a known date range
//                    → interval-overlap availability
//   ADM-HOTEL-CXL-1  cancelled hotel_room on the SAME room and range
//                    → proof cancelled bookings are ignored by availability
//
// `dummy-bulk.ts` is deliberately not used: it generates 500 rows per table and
// its own header warns it pollutes customer-facing search. This database backs
// the running site.
// =============================================================================

import type {
  PrismaClient,
  BookingStatus,
  BookingMethod,
  BookingType,
  SingleResourceKind,
} from '@prisma/client';

const DAY_MS = 86_400_000;

/** Date-only value for a @db.Date column, normalised to UTC midnight. */
function dateOnly(daysFromNow: number): Date {
  const d = new Date(Date.now() + daysFromNow * DAY_MS);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Fixed window used by the hotel fixtures so tests can assert exact overlaps.
 * Not exported: this file uses `export =` for the seed function, matching the
 * other seeds, and TypeScript forbids mixing that with named exports.
 */
const HOTEL_FIXTURE_WINDOW = { startDay: 30, endDay: 34 };

interface FixtureSpec {
  reference: string;
  status: BookingStatus;
  method: BookingMethod;
  singleResourceKind: SingleResourceKind | null;
  bookingType: BookingType;
  startDay: number;
  endDay: number;
  passengerCount: number;
  roomCount: number;
  unitPriceUsd: number;
  quantity: number;
  softDeleted: boolean;
  cancelled: boolean;
}

const FIXTURES: FixtureSpec[] = [
  {
    reference: 'ADM-TRANSPORT-1',
    status: 'confirmed',
    method: 'single_resource',
    singleResourceKind: 'transportation',
    bookingType: 'transportation',
    startDay: 7,
    endDay: 7,
    passengerCount: 4,
    roomCount: 1,
    unitPriceUsd: 65,
    quantity: 1,
    softDeleted: false,
    cancelled: false,
  },
  {
    reference: 'ADM-HOLD-1',
    status: 'hold',
    method: 'public_package',
    singleResourceKind: null,
    bookingType: 'trip_package',
    startDay: 21,
    endDay: 24,
    passengerCount: 2,
    roomCount: 1,
    unitPriceUsd: 399,
    quantity: 2,
    softDeleted: false,
    cancelled: false,
  },
  {
    reference: 'ADM-EXPIRED-1',
    status: 'expired',
    method: 'public_package',
    singleResourceKind: null,
    bookingType: 'trip_package',
    startDay: 14,
    endDay: 17,
    passengerCount: 1,
    roomCount: 1,
    unitPriceUsd: 399,
    quantity: 1,
    softDeleted: false,
    cancelled: false,
  },
  {
    reference: 'ADM-DELETED-1',
    status: 'confirmed',
    method: 'public_package',
    singleResourceKind: null,
    bookingType: 'trip_package',
    startDay: 10,
    endDay: 13,
    passengerCount: 3,
    roomCount: 1,
    unitPriceUsd: 399,
    quantity: 3,
    softDeleted: true,
    cancelled: false,
  },
  {
    reference: 'ADM-HOTEL-1',
    status: 'confirmed',
    method: 'single_resource',
    singleResourceKind: 'hotel',
    bookingType: 'hotel_room',
    startDay: HOTEL_FIXTURE_WINDOW.startDay,
    endDay: HOTEL_FIXTURE_WINDOW.endDay,
    passengerCount: 2,
    roomCount: 1,
    unitPriceUsd: 75,
    quantity: 4,
    softDeleted: false,
    cancelled: false,
  },
  {
    reference: 'ADM-HOTEL-CXL-1',
    status: 'cancelled',
    method: 'single_resource',
    singleResourceKind: 'hotel',
    bookingType: 'hotel_room',
    startDay: HOTEL_FIXTURE_WINDOW.startDay,
    endDay: HOTEL_FIXTURE_WINDOW.endDay,
    passengerCount: 2,
    roomCount: 1,
    unitPriceUsd: 75,
    quantity: 4,
    softDeleted: false,
    cancelled: true,
  },
];

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • booking fixtures (admin panel)');

  // A dedicated customer so these fixtures never touch real user accounts.
  const customer = await prisma.user.upsert({
    where: { email: 'admin.fixtures.customer@derlg.demo' },
    update: {},
    create: {
      supabaseUid: 'seed-admin-fixture-customer',
      email: 'admin.fixtures.customer@derlg.demo',
      role: 'user',
      preferredLanguage: 'en',
      fullName: 'Fixture Customer',
      phone: '+855990000001',
      loyaltyPoints: 250,
      status: 'active',
    },
    select: { id: true },
  });

  const [trip, room, vehicle, guide] = await Promise.all([
    prisma.trip.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.hotelRoom.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, roomType: true, hotelId: true },
    }),
    prisma.transportationVehicle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, capacity: true },
    }),
    prisma.guide.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
  ]);

  if (!trip || !room || !vehicle) {
    console.log(
      '  ⚠️  needs trips, hotel rooms and vehicles — run seeds 05/06/08 first; skipping',
    );
    return;
  }

  // Idempotent: remove prior fixtures by reference. Items cascade.
  await prisma.booking.deleteMany({
    where: { reference: { in: FIXTURES.map((f) => f.reference) } },
  });

  for (const f of FIXTURES) {
    const subtotal = f.unitPriceUsd * f.quantity;

    const resourceIds: Record<BookingType, string | null> = {
      trip_package: trip.id,
      hotel_room: room.id,
      transportation: vehicle.id,
      tour_guide: guide?.id ?? null,
    };
    const resourceId = resourceIds[f.bookingType];
    if (!resourceId) continue;

    await prisma.booking.create({
      data: {
        userId: customer.id,
        reference: f.reference,
        method: f.method,
        singleResourceKind: f.singleResourceKind,
        // Only the package booking is seeded from a Trip template.
        tripTemplateId: f.method === 'public_package' ? trip.id : null,
        startDate: dateOnly(f.startDay),
        endDate: dateOnly(f.endDay),
        status: f.status,
        // Holds expire in the future; everything else is already resolved.
        expiresAt:
          f.status === 'hold'
            ? new Date(Date.now() + 15 * 60_000)
            : new Date(Date.now() - DAY_MS),
        subtotalUsd: subtotal,
        discountUsd: 0,
        loyaltyDiscountUsd: 0,
        totalUsd: subtotal,
        passengerCount: f.passengerCount,
        roomCount: f.roomCount,
        cancelledAt: f.cancelled ? new Date(Date.now() - DAY_MS) : null,
        cancelReason: f.cancelled ? 'Seeded fixture: cancelled booking' : null,
        refundPercentage: f.cancelled ? 100 : null,
        deletedAt: f.softDeleted ? new Date(Date.now() - DAY_MS) : null,
        items: {
          create: {
            bookingType: f.bookingType,
            tripId: f.bookingType === 'trip_package' ? trip.id : null,
            hotelRoomId: f.bookingType === 'hotel_room' ? room.id : null,
            vehicleId: f.bookingType === 'transportation' ? vehicle.id : null,
            guideId:
              f.bookingType === 'tour_guide' ? (guide?.id ?? null) : null,
            startDate: dateOnly(f.startDay),
            endDate: dateOnly(f.endDay),
            quantity: f.quantity,
            unitPriceUsd: f.unitPriceUsd,
            subtotalUsd: subtotal,
            // Frozen resource state, mirroring what the booking engine writes.
            snapshot: {
              seeded: true,
              bookingType: f.bookingType,
              priceUsd: f.unitPriceUsd,
              cancellationPolicy: '100% refund if 7+ days before start',
            },
          },
        },
      },
    });
  }

  console.log(
    `  ✅ Created ${FIXTURES.length} booking fixtures ` +
      `(room "${room.roomType}" booked days ${HOTEL_FIXTURE_WINDOW.startDay}–${HOTEL_FIXTURE_WINDOW.endDay}, ` +
      `vehicle "${vehicle.name}" capacity ${vehicle.capacity})`,
  );
};
