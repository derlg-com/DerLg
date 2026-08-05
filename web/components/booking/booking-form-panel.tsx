'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { BookingForm, type BookingKind } from '@/components/booking/booking-form'
import { Button, buttonVariants } from '@/components/ui'
import { useSession } from '@/hooks/use-auth'
import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/cn'
import { Link, usePathname } from '@/lib/i18n/navigation'

/**
 * Client wrapper for the booking form.
 *
 * Handles the two states the server page cannot: waiting for the session to settle,
 * and a guest who needs to sign in. A guest is shown an explanation and a link that
 * RETURNS HERE afterwards, rather than being redirected away silently — they came
 * with a specific intent and should not lose it.
 */
export function BookingFormPanel({
  kind,
  resourceId,
  name,
  unitPriceUsd,
  unitKey,
  roomId,
  initialCheckIn,
  initialCheckOut,
}: {
  kind: BookingKind
  resourceId: string
  name: string
  unitPriceUsd: number
  unitKey: 'perPerson' | 'perNight' | 'perDay'
  roomId?: string
  initialCheckIn?: string
  initialCheckOut?: string
}) {
  const t = useTranslations('bookings.form')
  const { user, ready } = useSession()
  const hydrated = useHydrated()
  const pathname = usePathname()

  // Reserve the space until the session is known, so the page does not jump.
  if (!hydrated || !ready) {
    return <div className="h-64" aria-hidden="true" />
  }

  if (!user) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--accent-subtle)] p-4">
        <h2 className="text-sm font-semibold text-[var(--accent-subtle-text)]">
          {t('signInTitle')}
        </h2>
        <p className="mt-1 text-sm text-[var(--accent-subtle-text)]">{t('signInDesc')}</p>
        <Link
          // Carries the destination so signing in returns to this exact booking.
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className={cn(buttonVariants({ size: 'sm' }), 'mt-3')}
        >
          {t('signInTitle')}
        </Link>
      </div>
    )
  }

  if (kind === 'hotel' && !roomId) {
    // A hotel booking needs a specific room, chosen on the hotel page.
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {t('selectRoomTitle')}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('selectRoomDesc')}</p>
        <Link
          href={`/hotels/${resourceId}`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3')}
        >
          {t('backToHotel')}
        </Link>
      </div>
    )
  }

  return (
    <BookingForm
      kind={kind}
      resourceId={resourceId}
      name={name}
      unitPriceUsd={unitPriceUsd}
      unitLabel={t(unitKey)}
      roomId={roomId}
      initialCheckIn={initialCheckIn}
      initialCheckOut={initialCheckOut}
    />
  )
}

/** Re-exported so the page can render a loading affordance if it ever needs one. */
export { Button }
