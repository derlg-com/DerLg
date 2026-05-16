import { z } from 'zod'

const MoneySchema = z.object({
  usd: z.number(),
  khr: z.number().optional(),
})

export const TripSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  province: z.string().optional(),
  durationDays: z.number(),
  priceUsd: z.number(),
  priceKhr: z.number().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  imageUrl: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
})

export const TripCardsPayloadSchema = z.object({
  type: z.literal('trip_cards'),
  data: z.object({ trips: z.array(TripSchema) }),
  actions: z.array(z.object({
    type: z.string(),
    label: z.string(),
    payload: z.record(z.unknown()),
    style: z.enum(['primary', 'secondary']).optional(),
  })).optional(),
  metadata: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    replace: z.boolean().optional(),
  }).optional(),
})

export const QRPaymentPayloadSchema = z.object({
  type: z.literal('qr_payment'),
  data: z.object({
    qrUrl: z.string(),
    amount: MoneySchema,
    expiry: z.string(),
    paymentIntentId: z.string(),
  }),
})

export const BookingConfirmedPayloadSchema = z.object({
  type: z.literal('booking_confirmed'),
  data: z.object({
    bookingRef: z.string(),
    tripName: z.string(),
    travelDate: z.string(),
    qrCode: z.string().optional(),
  }),
})

export const WeatherPayloadSchema = z.object({
  type: z.literal('weather'),
  data: z.object({
    forecast: z.array(z.object({
      date: z.string(),
      high: z.number(),
      low: z.number(),
      condition: z.string(),
      icon: z.string().optional(),
    })),
  }),
})

export const ItineraryPayloadSchema = z.object({
  type: z.literal('itinerary'),
  data: z.object({
    days: z.array(z.object({
      day: z.number(),
      title: z.string(),
      activities: z.array(z.string()),
    })),
  }),
})

export const BudgetEstimatePayloadSchema = z.object({
  type: z.literal('budget_estimate'),
  data: z.object({
    totalUsd: z.number(),
    breakdown: z.record(z.number()),
  }),
})

export const ComparisonPayloadSchema = z.object({
  type: z.literal('comparison'),
  data: z.object({ items: z.array(TripSchema) }),
})

export const ImageGalleryPayloadSchema = z.object({
  type: z.literal('image_gallery'),
  data: z.object({
    images: z.array(z.object({ url: z.string(), caption: z.string().optional() })),
  }),
})

export const TextSummaryPayloadSchema = z.object({
  type: z.literal('text_summary'),
  data: z.object({ text: z.string() }),
})

export const ContentPayloadSchema = z.discriminatedUnion('type', [
  TripCardsPayloadSchema,
  QRPaymentPayloadSchema,
  BookingConfirmedPayloadSchema,
  WeatherPayloadSchema,
  ItineraryPayloadSchema,
  BudgetEstimatePayloadSchema,
  ComparisonPayloadSchema,
  ImageGalleryPayloadSchema,
  TextSummaryPayloadSchema,
])

export type ContentPayload = z.infer<typeof ContentPayloadSchema>
export type Trip = z.infer<typeof TripSchema>
