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

/**
 * A single entry in the loyalty points ledger.
 *
 * NOTE (backend-contract assumption): the backend does not yet expose a
 * user-facing loyalty ledger endpoint. The only loyalty data the backend
 * surfaces today is `loyaltyPoints` on `/v1/users/me` (the current balance)
 * and a service-key-guarded `/v1/ai-tools/loyalty` used internally by the AI
 * agent. {@link LoyaltyView} therefore assumes a future
 * `GET /v1/users/me/loyalty/history` endpoint returning a {@link Paginated}
 * list of these entries, and degrades gracefully (showing the balance only,
 * with an empty/error state for history) when that endpoint is unavailable.
 */
export interface LoyaltyLedgerEntry {
  id: string
  /** Human-readable description, e.g. "Booking #1234" or "Redeemed for discount". */
  description: string
  /** Signed points delta: positive = earned, negative = redeemed/expired. */
  points: number
  /** Booking that generated this entry, when applicable. */
  bookingId?: string | null
  /** ISO timestamp the entry was recorded. */
  createdAt: string
  /** ISO timestamp the earned points expire, when applicable (Requirement 34.5). */
  expiresAt?: string | null
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole | string
}

export type BookingStatus =
  'HOLD' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'

export type BookingType = 'trip' | 'guide' | 'hotel' | 'transportation'

export type Currency = 'USD' | 'KHR' | 'CNY'

export interface UnifiedBooking {
  id: string
  reference: string
  type: BookingType | string
  name: string
  /** Human-readable location label (e.g. meeting point / pickup), or null when unknown. */
  location?: string | null
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
