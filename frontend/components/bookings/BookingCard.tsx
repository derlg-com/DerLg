'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { statusVariant } from '@/lib/bookings-display'
import type { UnifiedBooking } from '@/types/api'

export function BookingCard({ booking }: { booking: UnifiedBooking }) {
  const t = useTranslations('bookings')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const dateRange =
    booking.endDate && booking.endDate !== booking.startDate
      ? `${formatDateShort(booking.startDate, locale)} – ${formatDateShort(booking.endDate, locale)}`
      : formatDateShort(booking.startDate, locale)

  return (
    <Link href={`/bookings/${booking.id}`} className="block focus-visible:outline-none">
      <Card variant="interactive" className="flex items-center gap-3 p-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {booking.coverImageUrl ? (
            <Image src={booking.coverImageUrl} alt={booking.name} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <MapPin className="h-5 w-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-1 font-display font-semibold text-foreground">{booking.name}</p>
            <Badge variant={statusVariant(booking.status)}>{t(`status.${booking.status}`)}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{dateRange}</p>
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(booking.totalPriceUsd, locale, currency)}
          </p>
        </div>
      </Card>
    </Link>
  )
}
