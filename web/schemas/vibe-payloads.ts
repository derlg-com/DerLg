import { z } from 'zod'

/**
 * Content payload contract for agent chat blocks.
 *
 * Ported from the previous frontend's proven contract and then VERIFIED field by
 * field against the agent's own normalisers in agent/core.py (_norm_trip,
 * _norm_hotel, _norm_guide, _norm_transport) — not assumed.
 *
 * All 18 block types are declared here even though their renderers land across
 * three tasks, so the schema is a single source of truth and an unrendered type is
 * still a known type rather than an unknown one.
 */

const MoneySchema = z.object({
  usd: z.number(),
  khr: z.number().optional(),
})

/**
 * Actions the agent attaches to a block.
 *
 * VERIFIED: the agent currently emits `"actions": []` on every payload — it never
 * populates them, and its user_action handler just synthesises a text message. This
 * is kept for forward compatibility, but no renderer should depend on it.
 */
export const PayloadActionSchema = z.object({
  type: z.string(),
  label: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
  style: z.enum(['primary', 'secondary']).optional(),
})

export const PayloadMetadataSchema = z.looseObject({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  replace: z.boolean().optional(),
})

/** Envelope fields every block may carry. */
const envelope = {
  actions: z.array(PayloadActionSchema).optional(),
  metadata: PayloadMetadataSchema.optional(),
}

/* ------------------------------------------------------------------ entities */

export const PayloadTripSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  blurb: z.string().optional(),
  province: z.string().optional(),
  durationDays: z.number().optional(),
  priceUsd: z.number(),
  priceKhr: z.number().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  imageUrl: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

export const PayloadHotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceUsd: z.number(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  imageUrl: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  distanceKm: z.number().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  blurb: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

/**
 * Guides from the AGENT do carry a `name`, because agent/core.py's _norm_guide
 * synthesises one. The REST catalogue API has no guide name at all, which is why
 * the browse pages fall back to province — do not unify these two paths.
 */
export const PayloadGuideSchema = z.object({
  id: z.string(),
  name: z.string(),
  pricePerDayUsd: z.number(),
  languages: z.array(z.string()).optional(),
  specialities: z.array(z.string()).optional(),
  province: z.string().optional(),
  avatarUrl: z.string().optional(),
  isVerified: z.boolean().optional(),
  bio: z.string().optional(),
})

export const PayloadTransportSchema = z.object({
  id: z.string(),
  // Kept as a plain string rather than an enum: a new vehicle type added
  // server-side must not invalidate the whole block.
  mode: z.string(),
  operator: z.string(),
  priceUsd: z.number(),
  durationMinutes: z.number().optional(),
  departureTime: z.string().optional(),
  amenities: z.array(z.string()).optional(),
})

/* -------------------------------------------------------------- card blocks */

export const TripCardsPayloadSchema = z.object({
  type: z.literal('trip_cards'),
  data: z.object({ trips: z.array(PayloadTripSchema) }),
  ...envelope,
})

/**
 * VERIFIED: search_trips emits `comparison` when there are exactly TWO results and
 * `trip_cards` otherwise, keyed on `items` instead of `trips`. So comparison is a
 * common card case, not an exotic one — it must render with the cards or a
 * two-result search would show nothing.
 */
export const ComparisonPayloadSchema = z.object({
  type: z.literal('comparison'),
  data: z.object({ items: z.array(PayloadTripSchema) }),
  ...envelope,
})

export const HotelCardsPayloadSchema = z.object({
  type: z.literal('hotel_cards'),
  data: z.object({ hotels: z.array(PayloadHotelSchema) }),
  ...envelope,
})

export const GuideCardsPayloadSchema = z.object({
  type: z.literal('guide_cards'),
  data: z.object({ guides: z.array(PayloadGuideSchema) }),
  ...envelope,
})

export const TransportOptionsPayloadSchema = z.object({
  type: z.literal('transport_options'),
  data: z.object({ options: z.array(PayloadTransportSchema) }),
  ...envelope,
})

/* -------------------------------------------------------------- rich blocks */

export const TripDetailPayloadSchema = z.object({
  type: z.literal('trip_detail'),
  data: z.object({
    id: z.string(),
    name: z.string(),
    priceUsd: z.number(),
    durationDays: z.number().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    images: z.array(z.string()).optional(),
    included: z.array(z.string()).optional(),
    excluded: z.array(z.string()).optional(),
    itinerary: z
      .array(
        z.object({
          day: z.number(),
          title: z.string(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    rating: z.number().optional(),
  }),
  ...envelope,
})

export const HotelDetailPayloadSchema = z.object({
  type: z.literal('hotel_detail'),
  data: z.object({
    id: z.string(),
    name: z.string(),
    priceUsd: z.number(),
    address: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    images: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
    rating: z.number().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  ...envelope,
})

export const ItineraryPayloadSchema = z.object({
  type: z.literal('itinerary'),
  data: z.object({
    days: z.array(
      z.object({
        day: z.number(),
        title: z.string(),
        activities: z.array(z.string()),
      }),
    ),
  }),
  ...envelope,
})

export const ImageGalleryPayloadSchema = z.object({
  type: z.literal('image_gallery'),
  data: z.object({
    images: z.array(z.object({ url: z.string(), caption: z.string().optional() })),
  }),
  ...envelope,
})

export const MapViewPayloadSchema = z.object({
  type: z.literal('map_view'),
  data: z.object({
    center: z.object({ lat: z.number(), lng: z.number() }),
    markers: z.array(
      z.object({
        id: z.string(),
        lat: z.number(),
        lng: z.number(),
        label: z.string().optional(),
        type: z.string().optional(),
      }),
    ),
    zoom: z.number().optional(),
  }),
  ...envelope,
})

export const WeatherPayloadSchema = z.object({
  type: z.literal('weather'),
  data: z.object({
    forecast: z.array(
      z.object({
        date: z.string(),
        high: z.number(),
        low: z.number(),
        condition: z.string(),
        icon: z.string().optional(),
      }),
    ),
  }),
  ...envelope,
})

export const BudgetEstimatePayloadSchema = z.object({
  type: z.literal('budget_estimate'),
  data: z.object({
    totalUsd: z.number(),
    breakdown: z.record(z.string(), z.number()),
  }),
  ...envelope,
})

export const TextSummaryPayloadSchema = z.object({
  type: z.literal('text_summary'),
  data: z.object({ text: z.string() }),
  ...envelope,
})

/* ----------------------------------------------------------- booking blocks */

export const BookingSummaryPayloadSchema = z.object({
  type: z.literal('booking_summary'),
  data: z.object({
    bookingId: z.string(),
    itemType: z.enum(['trip', 'hotel', 'transport', 'guide']),
    itemName: z.string(),
    travelDate: z.string(),
    peopleCount: z.number(),
    priceBreakdown: z.array(z.object({ label: z.string(), amountUsd: z.number() })),
    totalUsd: z.number(),
    cancellationPolicy: z.string().optional(),
    holdExpiresAt: z.string().optional(),
  }),
  ...envelope,
})

export const BookingConfirmedPayloadSchema = z.object({
  type: z.literal('booking_confirmed'),
  data: z.object({
    bookingRef: z.string(),
    tripName: z.string(),
    travelDate: z.string(),
    qrCode: z.string().optional(),
  }),
  ...envelope,
})

export const QrPaymentPayloadSchema = z.object({
  type: z.literal('qr_payment'),
  data: z.object({
    qrUrl: z.string(),
    amount: MoneySchema,
    expiry: z.string(),
    paymentIntentId: z.string(),
    /*
     * bookingId must stay declared: the cancel/retry actions and the agent's
     * check_payment_status / payment_completed flows all key on it, and a schema
     * that omits it would strip the value and fire those actions with undefined.
     */
    bookingId: z.string().optional(),
    remaining_seconds: z.number().optional(),
    expired: z.boolean().optional(),
  }),
  ...envelope,
})

export const StripeCardFormPayloadSchema = z.object({
  type: z.literal('stripe_card_form'),
  data: z.object({
    bookingId: z.string(),
    paymentIntentId: z.string().optional(),
    /*
     * There is NO backend endpoint that mints a PaymentIntent, so clientSecret is
     * never populated. The renderer must therefore present a labelled sandbox
     * confirmation, not a Stripe Elements form that cannot work.
     */
    clientSecret: z.string().optional(),
    amount: MoneySchema,
    expiry: z.string().optional(),
  }),
  ...envelope,
})

export const PaymentStatusPayloadSchema = z.object({
  type: z.literal('payment_status'),
  data: z.object({
    paymentIntentId: z.string(),
    bookingId: z.string(),
    status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
    amountUsd: z.number(),
    amountKhr: z.number().optional(),
    method: z.string().optional(),
    receiptUrl: z.string().optional(),
  }),
  ...envelope,
})

/* ------------------------------------------------------------------- union */

export const ContentPayloadSchema = z.discriminatedUnion('type', [
  TripCardsPayloadSchema,
  ComparisonPayloadSchema,
  HotelCardsPayloadSchema,
  GuideCardsPayloadSchema,
  TransportOptionsPayloadSchema,
  TripDetailPayloadSchema,
  HotelDetailPayloadSchema,
  ItineraryPayloadSchema,
  ImageGalleryPayloadSchema,
  MapViewPayloadSchema,
  WeatherPayloadSchema,
  BudgetEstimatePayloadSchema,
  TextSummaryPayloadSchema,
  BookingSummaryPayloadSchema,
  BookingConfirmedPayloadSchema,
  QrPaymentPayloadSchema,
  StripeCardFormPayloadSchema,
  PaymentStatusPayloadSchema,
])

export type ContentPayload = z.infer<typeof ContentPayloadSchema>
export type ContentPayloadType = ContentPayload['type']

export type PayloadTrip = z.infer<typeof PayloadTripSchema>
export type PayloadHotel = z.infer<typeof PayloadHotelSchema>
export type PayloadGuide = z.infer<typeof PayloadGuideSchema>
export type PayloadTransport = z.infer<typeof PayloadTransportSchema>
export type PayloadAction = z.infer<typeof PayloadActionSchema>

/** Every type the schema knows, for tests and the renderer registry. */
export const CONTENT_PAYLOAD_TYPES = [
  'trip_cards',
  'comparison',
  'hotel_cards',
  'guide_cards',
  'transport_options',
  'trip_detail',
  'hotel_detail',
  'itinerary',
  'image_gallery',
  'map_view',
  'weather',
  'budget_estimate',
  'text_summary',
  'booking_summary',
  'booking_confirmed',
  'qr_payment',
  'stripe_card_form',
  'payment_status',
] as const satisfies readonly ContentPayloadType[]

/**
 * Validates one block.
 *
 * Returns null instead of throwing: a single malformed or unrecognised block must
 * not take down the whole reply, and the caller decides how to degrade.
 */
export function parseContentPayload(block: unknown): ContentPayload | null {
  const result = ContentPayloadSchema.safeParse(block)
  return result.success ? result.data : null
}
