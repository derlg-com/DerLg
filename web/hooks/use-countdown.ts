'use client'

import * as React from 'react'

export interface Countdown {
  /** Whole seconds left, floored at zero. */
  secondsLeft: number
  minutes: number
  seconds: number
  expired: boolean
}

function remainingSeconds(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
}

/**
 * Ticking countdown to an ISO deadline.
 *
 * Booking holds expire (15 minutes server-side), and a stale "confirm" button on an
 * expired hold sends the user into a failure they were given no warning about — so
 * the remaining time has to be live, not rendered once.
 *
 * Returns `expired: true` when there is no time left, and also when no deadline was
 * supplied at all is treated as "not expiring" rather than "already expired", since
 * the agent omits the field for holds that do not expire.
 */
export function useCountdown(expiresAt: string | undefined): Countdown | null {
  const deadline = React.useMemo(() => {
    if (!expiresAt) return null
    const parsed = Date.parse(expiresAt)
    return Number.isNaN(parsed) ? null : parsed
  }, [expiresAt])

  // Seeded from the deadline so the first paint already shows the right value.
  const [secondsLeft, setSecondsLeft] = React.useState(() =>
    deadline === null ? 0 : remainingSeconds(deadline),
  )

  React.useEffect(() => {
    if (deadline === null) return

    // setState in the interval CALLBACK, never synchronously in the effect body.
    const tick = () => setSecondsLeft(remainingSeconds(deadline))
    tick()

    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [deadline])

  if (deadline === null) return null

  return {
    secondsLeft,
    minutes: Math.floor(secondsLeft / 60),
    seconds: secondsLeft % 60,
    expired: secondsLeft <= 0,
  }
}
