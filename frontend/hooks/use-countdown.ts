'use client'

import { useEffect, useRef, useState } from 'react'

export interface UseCountdownOptions {
  /** Seconds to count down from. */
  seconds: number
  /** Whether the countdown is active. When false, it is paused and reset. */
  active: boolean
  /** Fired once when the countdown reaches zero. */
  onComplete: () => void
}

export interface UseCountdownReturn {
  /** Whole seconds remaining (starts at `seconds`, ends at 0). */
  remaining: number
}

/**
 * Generic 1-second-tick countdown used by the Emergency Alert send flow
 * (Requirements 10.7/10.8 — a 5-second cancel window before the alert is sent).
 *
 * While `active`, ticks down every second and invokes `onComplete` exactly once
 * when it hits zero. Toggling `active` back to false (e.g. the user cancels)
 * stops the timer and resets `remaining` to `seconds`, so `onComplete` never
 * fires for a cancelled countdown.
 */
export function useCountdown({
  seconds,
  active,
  onComplete,
}: UseCountdownOptions): UseCountdownReturn {
  const [ticks, setTicks] = useState(0)
  // Keep the latest onComplete without restarting the interval each render.
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!active) return

    // Reset elapsed ticks when the countdown (re)starts. This synchronizes the
    // display with the freshly-started timer below; intentional reset on activation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTicks(0)
    let elapsed = 0
    let fired = false

    const id = setInterval(() => {
      elapsed += 1
      setTicks(elapsed)
      if (elapsed >= seconds) {
        clearInterval(id)
        if (!fired) {
          fired = true
          onCompleteRef.current()
        }
      }
    }, 1000)

    return () => clearInterval(id)
  }, [active, seconds])

  // Derive remaining from elapsed ticks; when inactive this is simply `seconds`.
  const remaining = active ? Math.max(0, seconds - ticks) : seconds
  return { remaining }
}
