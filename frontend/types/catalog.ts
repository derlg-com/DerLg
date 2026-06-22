/** Catalog (browse) domain types. Payloads are post-envelope (`data`). */

export type TripCategory = 'Temples' | 'Nature' | 'Culture' | 'Adventure' | 'Food'

export const TRIP_CATEGORIES: TripCategory[] = [
  'Temples',
  'Nature',
  'Culture',
  'Adventure',
  'Food',
]

export type TripSort =
  | 'featured'
  | 'price_asc'
  | 'price_desc'
  | 'duration_asc'
  | 'rating_desc'

export const TRIP_SORTS: TripSort[] = [
  'featured',
  'price_asc',
  'price_desc',
  'duration_asc',
  'rating_desc',
]

export interface TripSummary {
  id: string
  slug?: string | null
  name: string
  coverImageUrl: string | null
  durationDays: number
  priceUsd: number
  category: string
  location: string
  ratingAverage: number | null
  ratingCount: number
  isFeatured?: boolean
}

export interface ItineraryDay {
  dayNumber: number
  title: string
  description: string
  durationHours?: number
}

export interface MeetingPoint {
  description: string
  latitude: number
  longitude: number
}

export interface TripDetail extends TripSummary {
  description: string | null
  galleryImageUrls: string[]
  itineraryDays: ItineraryDay[]
  includedItems: string[]
  excludedItems: string[]
  meetingPoint: MeetingPoint | null
  cancellationPolicy: string | null
  maxGuests: number | null
  status?: string
}

export type SearchType = 'all' | 'trip' | 'place' | 'hotel' | 'guide'

export const SEARCH_TYPES: SearchType[] = ['all', 'trip', 'place', 'hotel', 'guide']

export interface SearchHotelItem {
  id: string
  slug?: string | null
  name: string
  coverImageUrl: string | null
  location?: string | null
  pricePerNightFrom?: number | null
}

export interface SearchGuideItem {
  id: string
  name: string
  profilePicture?: string | null
  location?: string | null
}

export interface SearchPlaceItem {
  id: string
  slug?: string | null
  name: string
  coverImageUrl: string | null
  province?: string | null
  category?: string | null
}

export interface SearchGroup<T> {
  items: T[]
  total: number
}

export interface SearchResults {
  trips: SearchGroup<TripSummary>
  places: SearchGroup<SearchPlaceItem>
  hotels: SearchGroup<SearchHotelItem>
  guides: SearchGroup<SearchGuideItem>
}

export type HotelSort = 'recommended' | 'price_asc' | 'price_desc' | 'rating_desc'

export const HOTEL_SORTS: HotelSort[] = ['recommended', 'price_asc', 'price_desc', 'rating_desc']

export const HOTEL_AMENITIES = ['Pool', 'WiFi', 'Breakfast', 'AC', 'Parking', 'Spa', 'Gym'] as const

export interface HotelSummary {
  id: string
  slug?: string | null
  name: string
  coverImageUrl: string | null
  location: string
  starRating: number | null
  pricePerNightFrom: number | null
  amenities: string[]
  ratingAverage: number | null
  ratingCount: number
}

export interface HotelRoom {
  id: string
  name: string
  description: string | null
  bedConfiguration: string | null
  maxOccupancy: number
  sizeSqm: number | null
  amenities: string[]
  imageUrls: string[]
  pricePerNightUsd: number
  totalRooms?: number
}

export interface HotelDetail extends HotelSummary {
  description: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  galleryImageUrls: string[]
  checkInTime: string | null
  checkOutTime: string | null
  cancellationPolicy: string | null
  rooms?: HotelRoom[]
}

export const CAMBODIA_LOCATIONS = [
  'Siem Reap',
  'Phnom Penh',
  'Sihanoukville',
  'Battambang',
  'Kampot',
  'Kep',
  'Koh Rong',
] as const

export type TransportSort = 'price_asc' | 'price_desc' | 'rating_desc'

export const TRANSPORT_SORTS: TransportSort[] = ['price_asc', 'price_desc', 'rating_desc']

export const TRANSPORT_TYPES = ['Van', 'Bus', 'TukTuk', 'Car', 'Minivan'] as const

export interface VehicleSummary {
  id: string
  type: string
  name: string
  capacity: number
  pricePerDayUsd: number
  imageUrls: string[]
  amenities: string[]
  isAvailable?: boolean
  ratingAverage: number | null
  ratingCount: number
}

export interface VehicleDetail extends VehicleSummary {
  description?: string | null
  pricePerKmUsd?: number | null
  latitude?: number | null
  longitude?: number | null
}

export interface VehicleAvailability {
  isAvailable: boolean
  priceTotalUsd: number
}

export type GuideSort = 'recommended' | 'rating_desc' | 'price_asc' | 'price_desc'

export const GUIDE_SORTS: GuideSort[] = ['recommended', 'rating_desc', 'price_asc', 'price_desc']

export const GUIDE_LANGUAGES = ['EN', 'ZH', 'KM'] as const
export const GUIDE_SPECIALTIES = ['Temples', 'Nature', 'Food', 'History', 'Adventure'] as const
export const GUIDE_GENDERS = ['Male', 'Female', 'Other'] as const

export interface GuideSummary {
  id: string
  name: string
  profilePicture: string | null
  languages: string[]
  specialties: string[]
  location: string
  gender: string | null
  pricePerDayUsd: number
  pricePerHourUsd?: number | null
  isVerified: boolean
  ratingAverage: number | null
  ratingCount: number
}

export interface GuideDetail extends GuideSummary {
  bio: string
  experienceYears: number
  certifications: string[]
  galleryImageUrls: string[]
  status?: string
}

export interface GuideAvailability {
  isAvailable: boolean
  priceEstimateUsd: number | null
  days: number | null
  conflictingBookings?: Array<{ startDate: string; endDate: string }>
}
