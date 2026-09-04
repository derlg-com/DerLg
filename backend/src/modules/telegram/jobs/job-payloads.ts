/**
 * Payload shapes for the Telegram BullMQ queues.
 *
 * `Job.data` is `any` by default, which propagated untyped values through every
 * processor. Declaring the payloads here means a producer that forgets a field is
 * caught at compile time rather than in a worker log at 3am.
 */

/** One recipient of a broadcast. */
export interface BroadcastTarget {
  /** Telegram chat id, stringified because ids exceed Number.MAX_SAFE_INTEGER. */
  chatId: string;
  message: string;
  driverId: string;
}

/** `broadcast` queue — fan a message out to drivers. */
export interface BroadcastJobData {
  broadcastId: string;
  targets: BroadcastTarget[];
  imageUrl?: string;
}

/**
 * `assignment-timeout` queue — auto-reject an offer the driver never answered,
 * so the booking returns to the unassigned pool.
 */
export interface AssignmentTimeoutJobData {
  assignmentId: string;
  driverId?: string;
  bookingId?: string;
}

/** `location-cleanup` queue — drop expired live-location keys from Redis. */
export interface LocationCleanupJobData {
  driverId?: string;
  olderThanMinutes?: number;
}
