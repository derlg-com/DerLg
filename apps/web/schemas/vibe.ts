import { z } from 'zod';

/**
 * Runtime contracts for the Content Stage panels.
 *
 * The API is ours, but these panels are rendered from streamed JSON built by an
 * agent loop, so they are validated rather than trusted: a shape that drifts, or
 * a stage the client does not know yet, degrades to a readable summary instead of
 * throwing inside a render and blanking the conversation.
 */

const money = z.number().finite();

const placeSchema = z.object({
  refId: z.string(),
  name: z.string(),
  city: z.string().optional(),
  category: z.string().optional(),
  entranceFeeUsd: money.optional(),
  visitMinutes: z.number().optional(),
});

const hotelSchema = z.object({
  refId: z.string(),
  name: z.string(),
  city: z.string().optional(),
  stars: z.number().optional(),
  pricePerNightUsd: money.optional(),
  amenities: z.array(z.string()).optional(),
});

const transportSchema = z.object({
  refId: z.string(),
  operator: z.string(),
  kind: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  departureTime: z.string().optional(),
  durationMinutes: z.number().optional(),
  pricePerSeatUsd: money.optional(),
});

const guideSchema = z.object({
  refId: z.string(),
  name: z.string(),
  city: z.string().optional(),
  languages: z.array(z.string()).optional(),
  pricePerDayUsd: money.optional(),
  rating: z.number().nullable().optional(),
  yearsExperience: z.number().optional(),
});

const packageSchema = z.object({
  packageId: z.string(),
  slug: z.string(),
  title: z.string(),
  city: z.string().optional(),
  days: z.number().optional(),
  priceUsd: money.optional(),
  summary: z.string().optional(),
  kidFriendly: z.boolean().optional(),
});

function listOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({ total: z.number().optional(), items: z.array(item) });
}

const availabilitySchema = z.object({
  available: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalUsd: money.optional(),
  items: z.array(
    z.object({
      dayNumber: z.number(),
      date: z.string().optional(),
      type: z.string(),
      refId: z.string().nullable().optional(),
      available: z.boolean(),
      reason: z.string().optional(),
      remaining: z.number().nullable().optional(),
      alternatives: z
        .array(z.object({ refId: z.string(), name: z.string(), priceUsd: money.optional() }))
        .optional(),
    }),
  ),
});

const itineraryItemSchema = z.object({
  type: z.string(),
  refId: z.string().nullable().optional(),
  title: z.string(),
  startTime: z.string().nullable().optional(),
  bookable: z.boolean(),
  name: z.string().nullable().optional(),
  unitPriceUsd: money.optional(),
});

const itinerarySchema = z.object({
  draftId: z.string(),
  title: z.string(),
  startDate: z.string().nullable().optional(),
  guests: z.number(),
  totalUsd: money,
  currency: z.string().optional(),
  days: z.array(
    z.object({
      dayNumber: z.number(),
      title: z.string(),
      summary: z.string().optional(),
      items: z.array(itineraryItemSchema),
    }),
  ),
  priceLines: z
    .array(z.object({ label: z.string(), quantity: z.number(), totalUsd: money }))
    .optional(),
  availability: z
    .object({
      available: z.boolean(),
      unavailable: z
        .array(
          z.object({
            dayNumber: z.number().optional(),
            date: z.string().optional(),
            reason: z.string().optional(),
            alternatives: z
              .array(z.object({ refId: z.string(), name: z.string(), priceUsd: money.optional() }))
              .optional(),
          }),
        )
        .optional(),
    })
    .nullable()
    .optional(),
});

const bookingSchema = z.object({
  bookingId: z.string(),
  reference: z.string(),
  status: z.string(),
  totalUsd: money,
  holdExpiresAt: z.string().nullable().optional(),
  secondsRemaining: z.number().nullable().optional(),
  guests: z.number().optional(),
  startDate: z.string().nullable().optional(),
});

/** One schema per stage. `greeting` and `text_summary` carry no structure. */
export const stagePayloadSchemas = {
  places: listOf(placeSchema),
  hotels: listOf(hotelSchema),
  transport: listOf(transportSchema),
  guides: listOf(guideSchema),
  packages: listOf(packageSchema),
  availability: availabilitySchema,
  itinerary: itinerarySchema,
  booking: bookingSchema,
} as const;

export type StageWithSchema = keyof typeof stagePayloadSchemas;

export type PlacesPayload = z.infer<typeof stagePayloadSchemas.places>;
export type HotelsPayload = z.infer<typeof stagePayloadSchemas.hotels>;
export type TransportPayload = z.infer<typeof stagePayloadSchemas.transport>;
export type GuidesPayload = z.infer<typeof stagePayloadSchemas.guides>;
export type PackagesPayload = z.infer<typeof stagePayloadSchemas.packages>;
export type AvailabilityPayload = z.infer<typeof availabilitySchema>;
export type ItineraryPayload = z.infer<typeof itinerarySchema>;
export type BookingPayload = z.infer<typeof bookingSchema>;

export function hasSchema(stage: string): stage is StageWithSchema {
  return stage in stagePayloadSchemas;
}
