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
    payload: z.record(z.string(), z.unknown()),
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
    breakdown: z.record(z.string(), z.number()),
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

export const HotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceUsd: z.number(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  imageUrl: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  distanceKm: z.number().optional(),
  address: z.string().optional(),
})

export const HotelCardsPayloadSchema = z.object({
  type: z.literal('hotel_cards'),
  data: z.object({ hotels: z.array(HotelSchema) }),
})

export const TransportOptionSchema = z.object({
  id: z.string(),
  mode: z.enum(['van', 'bus', 'tuk_tuk', 'taxi', 'shuttle', 'minivan']),
  operator: z.string(),
  priceUsd: z.number(),
  durationMinutes: z.number(),
  departureTime: z.string().optional(),
  amenities: z.array(z.string()).optional(),
})

export const TransportOptionsPayloadSchema = z.object({
  type: z.literal('transport_options'),
  data: z.object({ options: z.array(TransportOptionSchema) }),
})

export const MapViewPayloadSchema = z.object({
  type: z.literal('map_view'),
  data: z.object({
    center: z.object({ lat: z.number(), lng: z.number() }),
    markers: z.array(z.object({
      id: z.string(),
      lat: z.number(),
      lng: z.number(),
      label: z.string().optional(),
      type: z.string().optional(),
    })),
    zoom: z.number().optional(),
  }),
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
})

export const BookingSummaryPayloadSchema = z.object({
  type: z.literal('booking_summary'),
  data: z.object({
    bookingId: z.string(),
    itemType: z.enum(['trip', 'hotel', 'transport', 'guide']),
    itemName: z.string(),
    travelDate: z.string(),
    peopleCount: z.number(),
    priceBreakdown: z.array(z.object({
      label: z.string(),
      amountUsd: z.number(),
    })),
    totalUsd: z.number(),
    cancellationPolicy: z.string().optional(),
    holdExpiresAt: z.string().optional(),
  }),
})

export const StripeCardFormPayloadSchema = z.object({
  type: z.literal('stripe_card_form'),
  data: z.object({
    bookingId: z.string(),
    paymentIntentId: z.string().optional(),
    clientSecret: z.string().optional(),
    amount: MoneySchema,
    expiry: z.string().optional(),
  }),
})

export const ContentPayloadSchema = z.discriminatedUnion('type', [
  TripCardsPayloadSchema,
  HotelCardsPayloadSchema,
  TransportOptionsPayloadSchema,
  MapViewPayloadSchema,
  QRPaymentPayloadSchema,
  StripeCardFormPayloadSchema,
  PaymentStatusPayloadSchema,
  BookingSummaryPayloadSchema,
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
export type Hotel = z.infer<typeof HotelSchema>
export type TransportOption = z.infer<typeof TransportOptionSchema>
