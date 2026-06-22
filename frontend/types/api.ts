/**
 * Shared API/domain types for the DerLg backend.
 * Responses are unwrapped from the `{ success, data }` envelope by the api client,
 * so these describe the `data` payloads directly. Per-feature types live alongside
 * their feature schemas; this file holds the cross-cutting shapes.
 */

/** Paginated list payload (`data` of a list endpoint). */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type UserRole = 'user' | 'student' | 'guide' | 'admin'

export interface UserProfile {
  id: string
  email: string
  name: string | null
  phone: string | null
  avatarUrl: string | null
  role: UserRole | string
  loyaltyPoints: number
  isStudent: boolean
  createdAt: string
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole | string
}

export type BookingStatus =
  | 'HOLD'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'

export type BookingType = 'trip' | 'guide' | 'hotel' | 'transportation'

export type Currency = 'USD' | 'KHR' | 'CNY'

export interface UnifiedBooking {
  id: string
  reference: string
  type: BookingType | string
  name: string
  startDate: string
  endDate: string
  status: BookingStatus | string
  totalPriceUsd: number
  coverImageUrl: string | null
}

export interface BookingItem {
  id?: string
  name: string
  quantity?: number
  unitPriceUsd?: number
  totalPriceUsd?: number
}

export interface BookingDetail extends UnifiedBooking {
  items?: BookingItem[]
  specialRequests?: string | null
  cancelledAt?: string | null
  refundAmountUsd?: number | null
  holdExpiresAt?: string | null
  paymentStatus?: string | null
}
