/**
 * Pure time helpers for the festival countdown (Requirement 41.7).
 *
 * Kept framework-free so they can be unit-tested in isolation and reused by the
 * {@link FestivalCountdown} component. All functions are total: malformed dates
 * yield a sensible "past/now" result rather than throwing.
 */

export interface CountdownParts {
  /** Whole days remaining (>= 0). */
  days: number
  /** Whole hours remaining within the final day (0–23). */
  hours: number
  /** Total milliseconds remaining (>= 0). */
  totalMs: number
  /** True once the target instant has passed (totalMs === 0). */
  isPast: boolean
}

const MS_PER_HOUR = 1000 * 60 * 60
const MS_PER_DAY = MS_PER_HOUR * 24

/**
 * Break the time between `now` and a festival `startDate` into days/hours.
 * Returns a zeroed, `isPast` result for past or invalid dates.
 */
export function countdownTo(startDate: string | Date, now: Date = new Date()): CountdownParts {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const startMs = start.getTime()
  if (Number.isNaN(startMs)) {
    return { days: 0, hours: 0, totalMs: 0, isPast: true }
  }
  const diff = startMs - now.getTime()
  if (diff <= 0) {
    return { days: 0, hours: 0, totalMs: 0, isPast: true }
  }
  const days = Math.floor(diff / MS_PER_DAY)
  const hours = Math.floor((diff % MS_PER_DAY) / MS_PER_HOUR)
  return { days, hours, totalMs: diff, isPast: false }
}

/**
 * Whether a festival is upcoming relative to `now` (start date in the future).
 * Invalid dates are treated as not-upcoming.
 */
export function isUpcomingFestival(startDate: string | Date, now: Date = new Date()): boolean {
  return !countdownTo(startDate, now).isPast
}
