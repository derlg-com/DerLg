import { api } from '@/lib/api-client'
import type { QueuedAction } from '@/lib/offline-queue'

/**
 * Default replay transport for queued offline actions (task 19.5, Req 12.9).
 *
 * Maps each {@link QueuedAction} type to the backend mutation that applies it.
 * Throwing here (e.g. network/5xx) keeps the action in the queue for retry; a
 * resolved promise lets the caller remove it. Idempotency keys are derived from
 * the action id so a replayed-but-already-applied mutation is safe.
 *
 * The set of supported actions is intentionally small — the offline-sensitive
 * mutations most relevant to a traveler on spotty Cambodian mobile networks:
 *  - `profile-update`  → PATCH /v1/users/me
 *  - `booking-cancel`  → POST  /v1/bookings/:id/cancel
 *  - `review-submit`   → POST  /v1/reviews
 *
 * Wiring a new offline action is: enqueue it with `enqueueAction(type, payload)`
 * at the call site, then add a branch here.
 */
export async function replayQueuedAction(action: QueuedAction): Promise<void> {
  const idempotencyKey = action.id

  switch (action.type) {
    case 'profile-update': {
      await api.patch('/v1/users/me', action.payload, { idempotencyKey })
      return
    }
    case 'booking-cancel': {
      const { bookingId, reason } = action.payload as {
        bookingId: string
        reason?: string
      }
      await api.post(`/v1/bookings/${bookingId}/cancel`, { reason }, { idempotencyKey })
      return
    }
    case 'review-submit': {
      await api.post('/v1/reviews', action.payload, { idempotencyKey })
      return
    }
    default: {
      // Exhaustiveness guard: unknown types are dropped (resolve) so a corrupt
      // or future entry can't wedge the queue forever.
      return
    }
  }
}
