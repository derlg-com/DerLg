import type {
  Prisma,
  BookingMethod,
  SingleResourceKind,
  BookingType,
} from '@prisma/client';

/**
 * Shape consumed by CommitBookingUseCase. Future M4 sub-method use cases
 * (BookTransportationUseCase, etc.) build this shape and delegate. Phase 5b
 * configuration-driven flows (M1/M2/M3) build the same shape from a
 * frozen JourneyConfiguration.
 */
export interface CommitInputItem {
  type: BookingType;
  resourceId: string;
  startDate: Date;
  endDate: Date;
  quantity: number;
  unitPriceUsd: Prisma.Decimal;
  subtotalUsd: Prisma.Decimal;
  snapshot: Prisma.InputJsonValue;
}

export interface CommitInput {
  reference: string;
  totalPriceUsd: Prisma.Decimal;
  items: CommitInputItem[];
  metadata: {
    method: BookingMethod;
    singleResourceKind?: SingleResourceKind;
    /** UUID of the Trip template that seeded this itinerary, if any. Omit for
     *  build-from-scratch, public-package, or single-resource bookings. */
    tripTemplateId?: string;
  };
}
