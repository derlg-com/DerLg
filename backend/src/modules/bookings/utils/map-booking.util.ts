import type { Booking, BookingItem } from '@prisma/client';

type BookingWithItems = Booking & { items: BookingItem[] };

/** Maps a Prisma Booking row (with items) to the public Booking DTO. */
export function mapBooking(row: BookingWithItems) {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.userId,
    method: row.method,
    singleResourceKind: row.singleResourceKind,
    tripTemplateId: row.tripTemplateId,
    status: row.status,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    totalUsd: row.totalUsd.toNumber(),
    subtotalUsd: row.subtotalUsd.toNumber(),
    discountUsd: row.discountUsd.toNumber(),
    expiresAt: row.expiresAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    refundPercentage: row.refundPercentage,
    qrCodeUrl: row.qrCodeUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Maps a Prisma BookingItem to the public DTO. */
export function mapBookingItem(item: BookingItem) {
  return {
    id: item.id,
    bookingType: item.bookingType,
    resourceId:
      item.tripId ?? item.hotelRoomId ?? item.vehicleId ?? item.guideId ?? null,
    startDate: item.startDate.toISOString().slice(0, 10),
    endDate: item.endDate.toISOString().slice(0, 10),
    quantity: item.quantity,
    unitPriceUsd: item.unitPriceUsd.toNumber(),
    subtotalUsd: item.subtotalUsd.toNumber(),
    snapshot: item.snapshot,
  };
}

/** Maps a Booking with items to the detail DTO (booking + items[]). */
export function mapBookingDetail(row: BookingWithItems) {
  return {
    ...mapBooking(row),
    items: row.items.map(mapBookingItem),
  };
}
