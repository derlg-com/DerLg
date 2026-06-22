'use client'

import { useEffect, useState } from 'react'

export interface BookingHold {
  expired: boolean
  totalSeconds: number | null
  minutes: number
  seconds: number
}

/** Live 15-minute hold countdown derived from the server `holdExpiresAt` timestamp. */
export function useBookingHold(holdExpiresAt: string | null | undefined): BookingHold {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!holdExpiresAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [holdExpiresAt])

  if (!holdExpiresAt) {
    return { expired: false, totalSeconds: null, minutes: 0, seconds: 0 }
  }
  const remainingMs = new Date(holdExpiresAt).getTime() - now
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  return {
    expired: totalSeconds <= 0,
    totalSeconds,
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  }
}
