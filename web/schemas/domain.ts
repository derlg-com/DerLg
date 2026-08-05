import { z } from 'zod'

/**
 * Domain models, written against response shapes captured from the live API.
 *
 * Two deliberate choices:
 *  - Field names are NOT normalised across entities. Trips expose
 *    `coverImageUrl` while hotels, vehicles and places expose `coverImage`;
 *    inventing a uniform name here would hide that from callers and break as
 *    soon as the backend changes. Presentation code picks the right field.
 *  - Every optional field is `.nullish()` rather than `.optional()`, because the
 *    API returns explicit `null` for absent values (`location`, `ratingAverage`).
 */

export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  })

/* ------------------------------------------------------------------ trips */

export const TRIP_CATEGORIES = ['temples', 'nature', 'culture', 'adventure', 'food'] as const
export const TripCategorySchema = z.enum(TRIP_CATEGORIES)
export type TripCategory = z.infer<typeof TripCategorySchema>

/** Trip as returned by `GET /v1/trips` (list projection). */
export const TripSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  coverImageUrl: z.string().nullish(),
  durationDays: z.number(),
  priceUsd: z.number(),
  category: z.string().nullish(),
  location: z.string().nullish(),
  ratingAverage: z.number().nullish(),
  ratingCount: z.number().nullish(),
})
export type TripSummary = z.infer<typeof TripSummarySchema>

export const ItineraryDaySchema = z.object({
  dayNumber: z.number(),
  title: z.string(),
  description: z.string().nullish(),
})

/** Trip as returned by `GET /v1/trips/:id` — the summary plus detail fields. */
export const TripDetailSchema = TripSummarySchema.extend({
  description: z.string().nullish(),
  galleryImageUrls: z.array(z.string()).nullish(),
  itineraryDays: z.array(ItineraryDaySchema).nullish(),
  includedItems: z.array(z.string()).nullish(),
  excludedItems: z.array(z.string()).nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  maxParticipants: z.number().nullish(),
})
export type TripDetail = z.infer<typeof TripDetailSchema>

/* ----------------------------------------------------------------- hotels */

/** Hotel list item. Note `coverImage`, not `coverImageUrl`. */
export const HotelSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullish(),
  starRating: z.number().nullish(),
  /**
   * P1: hotel category added by the backend (resort | boutique | hotel |
   * guesthouse | hostel | villa). Optional so parsing survives before the
   * backend ships the field.
   */
  type: z.string().nullish(),
  coverImage: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  priceFromUsd: z.number().nullish(),
})
export type HotelSummary = z.infer<typeof HotelSummarySchema>

/**
 * Hotel detail. Note the divergence from the list projection: detail returns
 * `images` (an array) and no `coverImage`, while the list returns `coverImage`
 * and no images. Both are modelled optional so either response parses.
 */
export const HotelDetailSchema = HotelSummarySchema.extend({
  description: z.string().nullish(),
  amenities: z.array(z.string()).nullish(),
  images: z.array(z.string()).nullish(),
})
export type HotelDetail = z.infer<typeof HotelDetailSchema>

/**
 * Room as returned by `GET /v1/hotels/:id/rooms?checkIn&checkOut`.
 *
 * Verified against the live API: the price field is `priceUsd` (not
 * `pricePerNightUsd`), there is no room `name` — `roomType` is the label — and
 * `available` reflects the requested date range.
 */
export const HotelRoomSchema = z.object({
  id: z.string(),
  roomType: z.string(),
  maxOccupancy: z.number().nullish(),
  priceUsd: z.number(),
  amenities: z.array(z.string()).nullish(),
  images: z.array(z.string()).nullish(),
  available: z.boolean().nullish(),
})
export type HotelRoom = z.infer<typeof HotelRoomSchema>

/* ----------------------------------------------------------------- guides */

/**
 * Trip packages a guide runs, from the guide<->trip relation (P2).
 *
 * Every field is nullish because the backend mapper has not shipped yet: the
 * item shape is expected to mirror the trip list projection, and a nullish
 * object accepts any subset of those fields without failing the whole guide
 * parse if the backend names one differently.
 */
export const GuidePackageSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  coverImageUrl: z.string().nullish(),
  durationDays: z.number().nullish(),
  priceUsd: z.number().nullish(),
  category: z.string().nullish(),
  location: z.string().nullish(),
})
export type GuidePackage = z.infer<typeof GuidePackageSchema>

/**
 * Guide list item.
 *
 * The list projection has NO `name` field — verified against the live API. Only
 * the detail endpoint carries a display name, so list UIs must fall back to the
 * province and languages rather than rendering an empty heading.
 */
export const GuideSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  pricePerDayUsd: z.number(),
  province: z.string().nullish(),
  provinces: z.array(z.string()).nullish(),
  languages: z.array(z.string()).nullish(),
  /** Legacy free-text specialities (spelling matches the current API). */
  specialities: z.array(z.string()).nullish(),
  /**
   * P2: enum-backed specialties (culture_history | food_tours | ...) added by
   * the backend. Optional so a response that still ships `specialities` parses.
   */
  specialties: z.array(z.string()).nullish(),
  /** P2: trip packages linked to this guide (implicit m2m). */
  packages: z.array(GuidePackageSchema).nullish(),
  isVerified: z.boolean().nullish(),
  ratingAverage: z.number().nullish(),
  ratingCount: z.number().nullish(),
})
export type GuideSummary = z.infer<typeof GuideSummarySchema>

/**
 * Guide detail.
 *
 * Verified against the live API: there is NO display name in either the list or
 * the detail projection, so every guide surface must build its heading from the
 * province, languages or verification status.
 */
export const GuideDetailSchema = GuideSummarySchema.extend({
  bio: z.string().nullish(),
  images: z.array(z.string()).nullish(),
})
export type GuideDetail = z.infer<typeof GuideDetailSchema>

/**
 * Availability response shared by guides and vehicles:
 * `{ guideId | vehicleId, busyRanges: [...] }`.
 *
 * The API reports when something is BUSY rather than when it is free, so the UI
 * has to invert it. An empty `busyRanges` means fully available for the window.
 */
export const BusyRangeSchema = z.looseObject({
  from: z.string().nullish(),
  to: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
})

export const AvailabilitySchema = z.looseObject({
  guideId: z.string().nullish(),
  vehicleId: z.string().nullish(),
  busyRanges: z.array(BusyRangeSchema),
})
export type Availability = z.infer<typeof AvailabilitySchema>

/* --------------------------------------------------------- transportation */

export const VEHICLE_TYPES = ['van', 'bus', 'tuk_tuk', 'taxi', 'shuttle', 'minivan'] as const
export const VehicleTypeSchema = z.enum(VEHICLE_TYPES)
export type VehicleType = z.infer<typeof VehicleTypeSchema>

export const PRICING_MODELS = ['per_km', 'per_trip', 'per_day', 'per_person'] as const

export const VehicleSummarySchema = z.object({
  id: z.string(),
  vehicleType: z.string(),
  name: z.string(),
  capacity: z.number(),
  /**
   * P3: tier (normal | vip) and subtype (starex | hiace | alphard |
   * small_bus | big_bus) added by the backend. Optional so parsing survives
   * before the backend ships the fields.
   */
  tier: z.string().nullish(),
  subtype: z.string().nullish(),
  priceUsd: z.number(),
  pricingModel: z.string().nullish(),
  province: z.string().nullish(),
  coverImage: z.string().nullish(),
})
export type VehicleSummary = z.infer<typeof VehicleSummarySchema>

export const VehicleDetailSchema = VehicleSummarySchema.extend({
  licensePlate: z.string().nullish(),
  images: z.array(z.string()).nullish(),
})
export type VehicleDetail = z.infer<typeof VehicleDetailSchema>

/* ----------------------------------------------------------------- places */

export const PLACE_CATEGORIES = [
  'temple',
  'museum',
  'nature',
  'market',
  'beach',
  'mountain',
] as const
export const PlaceCategorySchema = z.enum(PLACE_CATEGORIES)
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>

export const PlaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  entryFeeUsd: z.number().nullish(),
  coverImage: z.string().nullish(),
})
export type PlaceSummary = z.infer<typeof PlaceSummarySchema>

export const PlaceDetailSchema = PlaceSummarySchema.extend({
  description: z.string().nullish(),
  address: z.string().nullish(),
  openingHours: z.string().nullish(),
  dressCode: z.string().nullish(),
  website: z.string().nullish(),
  visitorTips: z.string().nullish(),
  images: z.array(z.string()).nullish(),
})
export type PlaceDetail = z.infer<typeof PlaceDetailSchema>

/* ----------------------------------------------------------------- search */

export const SEARCH_KINDS = ['trip', 'hotel', 'guide', 'transport', 'place'] as const

export const SearchResultSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  image: z.string().nullish(),
  category: z.string().nullish(),
  basePriceUsd: z.number().nullish(),
})
export type SearchResult = z.infer<typeof SearchResultSchema>

/* --------------------------------------------------------------- bookings */

export const BOOKING_STATUSES = [
  'hold',
  'pending_payment',
  'payment_failed',
  'confirmed',
  'completed',
  'cancelled',
  'expired',
  'no_show',
] as const
export const BookingStatusSchema = z.enum(BOOKING_STATUSES)
export type BookingStatus = z.infer<typeof BookingStatusSchema>

export const BookingItemSchema = z.object({
  id: z.string(),
  itemType: z.string().nullish(),
  itemId: z.string().nullish(),
  name: z.string().nullish(),
  quantity: z.number().nullish(),
  unitPriceUsd: z.number().nullish(),
  subtotalUsd: z.number().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
})
export type BookingItem = z.infer<typeof BookingItemSchema>

export const BookingSchema = z.object({
  id: z.string(),
  reference: z.string().nullish(),
  status: z.string(),
  totalUsd: z.number().nullish(),
  currency: z.string().nullish(),
  travelDate: z.string().nullish(),
  participants: z.number().nullish(),
  createdAt: z.string().nullish(),
  holdExpiresAt: z.string().nullish(),
  qrCodeUrl: z.string().nullish(),
  items: z.array(BookingItemSchema).nullish(),
})
export type Booking = z.infer<typeof BookingSchema>

/* ------------------------------------------------------------------- user */

/**
 * Authenticated user, as returned by `GET /v1/users/me` and by the auth
 * endpoints. Verified against the live API: the display field is `name` (not
 * fullName) and the student flag is `isStudent` (not isStudentVerified).
 */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().nullish(),
  name: z.string().nullish(),
  phone: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  role: z.string().nullish(),
  loyaltyPoints: z.number().nullish(),
  isStudent: z.boolean().nullish(),
  createdAt: z.string().nullish(),
})
export type User = z.infer<typeof UserSchema>

/** `register` and `login` return a token plus the user; `refresh` returns only a token. */
export const AuthResultSchema = z.object({
  accessToken: z.string(),
  user: UserSchema.nullish(),
})
export type AuthResult = z.infer<typeof AuthResultSchema>
