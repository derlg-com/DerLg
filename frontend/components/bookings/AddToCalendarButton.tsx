'use client'

import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { fetchIcal } from '@/lib/bookings-api'
import { useTranslations } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface AddToCalendarButtonProps {
  /** Booking id used to fetch the (auth-protected) iCalendar file. */
  bookingId: string
  /** Booking reference, used to name the downloaded `.ics` file when present. */
  reference?: string | null
  className?: string
  variant?: 'outline' | 'ghost' | 'secondary'
}

/**
 * Add-to-calendar / download `.ics` action (Requirement 39.8).
 *
 * The iCalendar file is served from an auth-protected endpoint, so it cannot be
 * a plain `<a href>` — we fetch the text via {@link fetchIcal} and trigger a
 * client-side download. Extracted from `BookingDetailView` so the same logic is
 * reused on the booking confirmation page without duplication.
 */
export function AddToCalendarButton({
  bookingId,
  reference,
  className,
  variant = 'outline',
}: AddToCalendarButtonProps) {
  const t = useTranslations('bookings')

  function downloadIcal() {
    fetchIcal(bookingId)
      .then((text) => {
        const blob = new Blob([text], { type: 'text/calendar' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `booking-${reference ?? bookingId}.ics`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast({ title: t('detail.icalError'), variant: 'error' }))
  }

  return (
    <Button variant={variant} onClick={downloadIcal} className={cn(className)}>
      <CalendarPlus className="mr-1 h-4 w-4" aria-hidden />
      {t('detail.addToCalendar')}
    </Button>
  )
}
