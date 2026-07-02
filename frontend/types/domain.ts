/**
 * Additional domain types for the DerLg backend that are not covered by
 * `api.ts` (cross-cutting), `catalog.ts` (browse), or `vibe-booking.ts` (chat).
 *
 * These describe the post-envelope `data` payloads (the api client unwraps the
 * `{ success, data }` envelope). Field names and shapes mirror the backend API
 * contract: camelCase, money in USD as numbers, translatable fields flattened
 * to the requested locale (e.g. `name`, `description`), dates as ISO strings.
 */

import type { Currency } from './api'

// =============================================================================
// PLACES (Explore — Requirement 4)
// =============================================================================

export type PlaceCategory =
  'temple' | 'nature' | 'beach' | 'museum' | 'market' | 'landmark' | string

/** Place list item (`data` of GET /v1/places). */
export interface PlaceSummary {
  id: string
  name: string
  category: PlaceCategory
  latitude: number
  longitude: number
  entryFeeUsd: number | null
  coverImage: string | null
}

/** Full place (`data` of GET /v1/places/:id). */
export interface PlaceDetail {
  id: string
  name: string
  description: string | null
  category: PlaceCategory
  latitude: number
  longitude: number
  entryFeeUsd: number | null
  openingHours: string | null
  dressCode: string | null
  website: string | null
  visitorTips: string | null
  address: string | null
  images: string[]
}

// =============================================================================
// FESTIVALS (Home / Explore — Requirements 3, 4)
// =============================================================================

/**
 * Festival category, used for color-coded calendar markers and type filtering
 * (Requirement 41.2, 41.5). BACKEND-CONTRACT ASSUMPTION: the public
 * `GET /v1/festivals` payload does not currently expose a `type` field. It is
 * declared optional here and consumers degrade gracefully (a festival without a
 * recognised type is bucketed as `other` and still rendered). When the backend
 * adds the field it will populate automatically.
 */
export type FestivalType = 'religious' | 'cultural' | 'music' | 'food' | 'other'

/** Festival list item (`data` of GET /v1/festivals). */
export interface FestivalSummary {
  id: string
  name: string
  /** Inclusive start date (ISO date string, e.g. "2026-04-13"). */
  startDate: string
  /** Inclusive end date (ISO date string). */
  endDate: string
  province: string | null
  location: string | null
  coverImage: string | null
  /** Festival category (optional; see {@link FestivalType}). */
  type?: FestivalType | string | null
}

/** Full festival (`data` of GET /v1/festivals/:id). */
export interface FestivalDetail extends FestivalSummary {
  description: string | null
  images: string[]
  /**
   * Programme/activities listed for the festival (Requirement 41.4). Optional —
   * absent on backends that don't yet surface it; the detail view hides the
   * section when empty.
   */
  activities?: string[] | null
}

// =============================================================================
// REVIEWS & RATINGS (Requirement 21)
// =============================================================================

/** Subject a review can be attached to. */
export type ReviewSubjectType = 'trip' | 'hotel' | 'guide'

export interface ReviewAuthor {
  id: string
  name: string | null
  avatarUrl: string | null
}

/** A single review (`data` item of GET /v1/reviews). */
export interface Review {
  id: string
  /** 1–5 stars. */
  rating: number
  text: string | null
  images: string[]
  /** Badge shown when the review comes from a confirmed booking. */
  isVerifiedBooking: boolean
  author: ReviewAuthor
  createdAt: string
  updatedAt: string
}

/** Aggregate rating block returned alongside paginated review lists. */
export interface ReviewSummary {
  averageRating: number
  reviewCount: number
  /** Count of reviews per star value, keyed "1".."5". */
  ratingBreakdown?: Record<string, number>
}

export type ReviewSort = 'recent' | 'rating_desc'

/**
 * Composite payload returned in the `data` field of
 * `GET /v1/reviews?type=<subject>&id=<id>` (see ReviewsResponse assumption in
 * components/reviews). Bundles the aggregate {@link ReviewSummary}, the current
 * page of {@link Review} items, and pagination metadata in a single response so
 * the lightweight {@link useApiQuery} layer (which unwraps `data` and drops the
 * envelope `meta`) can drive both the summary block and the paginated list.
 */
export interface ReviewsResponse {
  summary: ReviewSummary
  items: Review[]
  page: number
  limit: number
  total: number
  totalPages: number
}

// =============================================================================
// PAYMENTS (Requirement 6)
// =============================================================================

export type PaymentProvider = 'stripe' | 'bakong'

export type PaymentMethodKind = 'card' | 'qr'

export type PaymentStatus =
  'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded'

/** A payment option offered for a booking (`data` of GET payment options). */
export interface PaymentOption {
  provider: PaymentProvider
  method: PaymentMethodKind
  /** Supported display currencies for this option. */
  currencies: Currency[]
  label?: string
}

/**
 * Payment intent returned when initiating payment. For Stripe, `clientSecret`
 * drives Stripe Elements; for Bakong QR, `qrCodeUrl`/`qrExpiresAt` drive the
 * QR display and polling.
 */
export interface PaymentIntent {
  id: string
  bookingId: string
  provider: PaymentProvider
  status: PaymentStatus
  amountUsd: number
  currency: Currency
  /** Stripe client secret for `confirmCardPayment` (card payments only). */
  clientSecret?: string | null
  stripePaymentIntentId?: string | null
  /** Bakong QR image URL (QR payments only). */
  qrCodeUrl?: string | null
  /** ISO timestamp after which the QR is no longer valid. */
  qrExpiresAt?: string | null
}

/** Receipt payload used for the confirmation screen / PDF download. */
export interface PaymentReceipt {
  id: string
  bookingReference: string
  provider: PaymentProvider
  status: PaymentStatus
  amountUsd: number
  currency: Currency
  paidAt: string | null
  lineItems: Array<{
    label: string
    amountUsd: number
  }>
}

// =============================================================================
// EMERGENCY ALERTS (Requirement 10)
// =============================================================================

export type EmergencyAlertType = 'sos' | 'medical' | 'theft' | 'lost'

export type EmergencyAlertStatus = 'triggered' | 'acknowledged' | 'resolved' | 'cancelled'

/** Coordinates captured from the browser Geolocation API. */
export interface GeoCoordinates {
  latitude: number
  longitude: number
  accuracyMeters?: number | null
}

/** Request body for POST /v1/emergency-alerts. */
export interface EmergencyAlertRequest {
  alertType: EmergencyAlertType
  latitude: number
  longitude: number
  accuracyMeters?: number | null
  bookingId?: string | null
  notes?: string | null
}

/** An emergency alert record (`data` of the alert endpoints). */
export interface EmergencyAlert {
  id: string
  alertType: EmergencyAlertType
  status: EmergencyAlertStatus
  latitude: number
  longitude: number
  accuracyMeters: number | null
  notes: string | null
  createdAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
}

/** Local emergency service contact shown after sending an alert. */
export interface EmergencyContact {
  id: string
  province: string
  serviceName: string
  phone: string
  address: string | null
}

// =============================================================================
// NOTIFICATIONS (Requirement 19)
// =============================================================================

export type NotificationChannel = 'email' | 'push' | 'in_app'

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read'

/** A notification record (`data` item of GET /v1/notifications). */
export interface Notification {
  id: string
  channel: NotificationChannel
  status: NotificationStatus
  title: string
  body: string | null
  /** Optional template identifier used to build the message. */
  templateKey: string | null
  /** Related booking, if the notification concerns one. */
  bookingId: string | null
  /** Arbitrary structured payload for deep-linking / rendering. */
  metadata: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

// =============================================================================
// FAVORITES / WISHLIST (Requirement 22)
// =============================================================================

/**
 * Server-side favorite subject types. Distinct from the client-only
 * `FavoriteType` in `stores/favorites.store.ts` (which uses "transport" for the
 * local guest wishlist); the API persists favorites against these entities.
 */
export type FavoriteSubjectType = 'trip' | 'hotel' | 'place' | 'guide'

/** A persisted favorite record (`data` item of GET /v1/favorites). */
export interface Favorite {
  id: string
  type: FavoriteSubjectType
  /** Id of the favorited entity (trip/hotel/place/guide). */
  itemId: string
  createdAt: string
}
