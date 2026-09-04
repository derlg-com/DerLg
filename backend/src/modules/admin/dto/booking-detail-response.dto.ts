import {
  BookingMethod,
  BookingStatus,
  BookingType,
  SingleResourceKind,
} from '@prisma/client';

import type { Prisma } from '@prisma/client';

export class BookingDetailResponseDto {
  id: string;
  userId: string;
  reference: string;
  startDate: Date;
  endDate: Date | null;
  status: BookingStatus;
  expiresAt: Date;
  subtotalUsd: number;
  discountUsd: number;
  loyaltyDiscountUsd: number;
  totalUsd: number;
  cancelledAt: Date | null;
  cancelReason: string | null;
  refundPercentage: number | null;
  passengerCount: number;
  roomCount: number;

  /**
   * How the booking was composed. Added by the add_booking_method_and_snapshot
   * and merge_booking_methods migrations, which landed after the standalone
   * admin schema was introspected — so the old admin UI could not tell a fixed
   * package apart from a custom itinerary.
   */
  method: BookingMethod;

  /** Set only when `method` is `single_resource`. */
  singleResourceKind: SingleResourceKind | null;

  /** The Trip this itinerary was seeded from, when any. */
  tripTemplateId: string | null;

  createdAt: Date;
  updatedAt: Date;

  user?: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
  } | null;

  payments?: Array<{
    id: string;
    amountUsd: number;
    status: string;
    refundedAmountUsd: number;
    paidAt: Date | null;
  }>;

  /**
   * Booking lines. Named `items` to match the Prisma relation.
   *
   * Each line carries a `startDate`/`endDate` interval rather than the single
   * `date` the old schema had, plus the `snapshot` of resource state frozen at
   * booking time (price and cancellation policy as the customer agreed them).
   */
  items?: Array<{
    id: string;
    bookingType: BookingType;
    tripId: string | null;
    hotelRoomId: string | null;
    vehicleId: string | null;
    guideId: string | null;
    startDate: Date;
    endDate: Date;
    quantity: number;
    unitPriceUsd: number;
    subtotalUsd: number;
    snapshot: Prisma.JsonValue;
  }>;

  driverAssignment?: {
    id: string;
    driverId: string;
    vehicleId: string;
    status: string;
    assignmentTimestamp: Date;
  } | null;
}
