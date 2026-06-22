import { BookingType } from '@prisma/client';
import type { Booking, BookingItem } from '@prisma/client';

type BookingWithItems = Booking & { items: BookingItem[] };

/** Read a non-empty string field from a BookingItem JSON snapshot, or null. */
function snapshotString(snapshot: unknown, key: string): string | null {
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    const value = (snapshot as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** Frontend booking `type` ('trip'|'hotel'|'guide'|'transportation'). */
function bookingResourceType(row: BookingWithItems): string {
  if (row.singleResourceKind) return row.singleResourceKind;
  switch (row.items[0]?.bookingType) {
    case BookingType.hotel_room:
      return 'hotel';
    case BookingType.transportation:
      return 'transportation';
    case BookingType.tour_guide:
      return 'guide';
    case BookingType.trip_package:
    default:
      return 'trip';
  }
}

/**
 * Maps a Prisma Booking row (with items) to the public Booking DTO consumed by
 * the frontend (`types/api.ts`). Derived presentation fields (`name`,
 * `coverImageUrl`, `specialRequests`) come from the primary item snapshot;
 * `status` is UPPERCASED to match the frontend `BookingStatus` enum. Internal
 * fields are retained for back-compat with existing callers/events.
 */
export function mapBooking(row: BookingWithItems) {
  const primarySnapshot = row.items[0]?.snapshot ?? null;
  const totalPriceUsd = row.totalUsd.toNumber();
  const refundAmountUsd =
    row.status === 'cancelled' && row.refundPercentage != null
      ? Math.round(totalPriceUsd * row.refundPercentage) / 100
      : null;

  return {
    id: row.id,
    reference: row.reference,
    type: bookingResourceType(row),
    name: snapshotString(primarySnapshot, 'name') ?? '',
    coverImageUrl: snapshotString(primarySnapshot, 'coverImageUrl'),
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    status: row.status.toUpperCase(),
    totalPriceUsd,
    holdExpiresAt: row.expiresAt.toISOString(),
    specialRequests: snapshotString(primarySnapshot, 'specialRequests'),
    refundAmountUsd,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    // Internal / back-compat fields (ignored by the frontend).
    userId: row.userId,
    method: row.method,
    singleResourceKind: row.singleResourceKind,
    tripTemplateId: row.tripTemplateId,
    subtotalUsd: row.subtotalUsd.toNumber(),
    discountUsd: row.discountUsd.toNumber(),
    refundPercentage: row.refundPercentage,
    qrCodeUrl: row.qrCodeUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Maps a Prisma BookingItem to the public item DTO. */
export function mapBookingItem(item: BookingItem) {
  const subtotalUsd = item.subtotalUsd.toNumber();
  return {
    id: item.id,
    name: snapshotString(item.snapshot, 'name'),
    bookingType: item.bookingType,
    resourceId:
      item.tripId ?? item.hotelRoomId ?? item.vehicleId ?? item.guideId ?? null,
    startDate: item.startDate.toISOString().slice(0, 10),
    endDate: item.endDate.toISOString().slice(0, 10),
    quantity: item.quantity,
    unitPriceUsd: item.unitPriceUsd.toNumber(),
    totalPriceUsd: subtotalUsd,
    subtotalUsd,
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
