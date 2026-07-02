'use client'

import { Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { isWithinEmergencyWindow } from '@/lib/bookings-display'
import { useTranslations } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { BookingStatus } from '@/types/api'

interface EmergencyAlertButtonProps {
  /** Booking id passed to the alert flow (Section 15 sends it with the alert). */
  bookingId: string
  /** ISO start date/time of the booking — gates the 24-hour visibility window. */
  startDate: string
  /** Booking status; only `upcoming`-group bookings ever surface the button. */
  status: BookingStatus | string
  /**
   * Activation handler for the emergency alert flow. The full GPS-capture /
   * countdown / send flow is owned by Section 15 (useEmergencyAlert + send-alert
   * mutation + modal). When omitted, the button shows a placeholder toast so the
   * entry point is visible and non-broken before Section 15 lands.
   */
  onActivate?: (bookingId: string) => void
  /** Reference time in ms (defaults to Date.now()), injected for tests. */
  now?: number
  className?: string
}

/**
 * Emergency Alert entry point on the booking detail view (Requirements 7.6, 10.1).
 *
 * Renders a destructive-styled button ONLY when the booking is active and within
 * 24 hours of its start time. Clicking it triggers the emergency alert flow.
 *
 * Scope (Task 14.5): surface the button and its entry point. The actual alert
 * sending UI (GPS permission, map preview, 5-second countdown, confirmation with
 * emergency contact numbers) is implemented in Section 15 and wired in via
 * `onActivate` (see task 15.3).
 */
export function EmergencyAlertButton({
  bookingId,
  startDate,
  status,
  onActivate,
  now,
  className,
}: EmergencyAlertButtonProps) {
  const t = useTranslations('bookings')

  if (!isWithinEmergencyWindow(startDate, status, now)) return null

  function handleClick() {
    if (onActivate) {
      onActivate(bookingId)
      return
    }
    // Placeholder until Section 15 wires the full alert flow (task 15.3).
    toast({ title: t('emergency.comingSoon'), variant: 'default' })
  }

  return (
    <Button
      variant="destructive"
      onClick={handleClick}
      className={cn(className)}
      data-testid="emergency-alert-button"
    >
      <Siren className="mr-1 h-4 w-4" aria-hidden />
      {t('emergency.button')}
    </Button>
  )
}
