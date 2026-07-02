import { api } from './api-client'

import type { Review, ReviewSubjectType } from '@/types/domain'

/**
 * Reviews submission / edit / delete client (Section 20.3 / 20.4 —
 * Requirements 21.3, 21.5, 21.9). The form validation schema lives in
 * `@/schemas/review`.
 *
 * ## Backend contract (ASSUMPTION)
 *
 * At the time of writing the NestJS backend exposes **no** reviews module (the
 * display side in `components/reviews` already documents the assumed
 * `GET /v1/reviews` read contract). Section 20 continues that assumption for
 * the write side and the UI degrades gracefully when the endpoint is missing
 * (an inline error is surfaced rather than crashing the form):
 *
 *   - `POST   /v1/reviews`        body {@link CreateReviewPayload} → {@link Review}
 *   - `PATCH  /v1/reviews/:id`    body {@link UpdateReviewPayload} → {@link Review}
 *   - `DELETE /v1/reviews/:id`    → `void`
 *
 * Reviews are anchored to the originating booking (`bookingId`) — the canonical
 * proof of a completed booking (Requirement 21.3, verified-booking badge 21.8) —
 * plus the derived subject (`type` + `subjectId`) so the read endpoint can
 * group them. The backend is expected to enforce "completed booking only" and
 * ownership on edit/delete; the frontend gates the affordances client-side as a
 * first line of defence.
 */

export interface CreateReviewPayload {
  type: ReviewSubjectType
  /** Subject the review is about (trip/hotel/guide id). Optional when the backend derives it from the booking. */
  subjectId?: string
  /** Originating booking — proof of a completed booking. */
  bookingId: string
  rating: number
  text: string
  images: string[]
}

export interface UpdateReviewPayload {
  rating: number
  text: string
  images: string[]
}

/** Submit a new review (Requirement 21.3). */
export function createReview(payload: CreateReviewPayload, idempotencyKey?: string) {
  return api.post<Review>('/v1/reviews', payload, idempotencyKey ? { idempotencyKey } : undefined)
}

/** Edit an existing review the current user owns (Requirement 21.9). */
export function updateReview(id: string, payload: UpdateReviewPayload) {
  return api.patch<Review>(`/v1/reviews/${id}`, payload)
}

/** Delete a review the current user owns (Requirement 21.9). */
export function deleteReview(id: string) {
  return api.delete<void>(`/v1/reviews/${id}`)
}

/**
 * Booking statuses that allow a review to be written (Requirement 21.3 — only
 * completed bookings). Compared case-insensitively against the booking status.
 */
export function isReviewableBookingStatus(status: string | null | undefined): boolean {
  return String(status ?? '').toUpperCase() === 'COMPLETED'
}

/**
 * Map a booking `type` to the {@link ReviewSubjectType} a review attaches to.
 * Transport bookings are not reviewable as a subject, so they yield `null`.
 */
export function bookingTypeToReviewSubject(
  type: string | null | undefined,
): ReviewSubjectType | null {
  switch (String(type ?? '').toLowerCase()) {
    case 'trip':
      return 'trip'
    case 'hotel':
      return 'hotel'
    case 'guide':
      return 'guide'
    default:
      return null
  }
}
