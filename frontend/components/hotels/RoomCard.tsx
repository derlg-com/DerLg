'use client'

import Link from 'next/link'
import { Users, BedDouble, Maximize } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import type { HotelRoom } from '@/types/catalog'

export function RoomCard({ room, hotelHref }: { room: HotelRoom; hotelHref: string }) {
  const t = useTranslations('hotels')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-foreground">{room.name}</h3>
          <span className="shrink-0 text-right">
            <span className="font-semibold text-foreground">
              {formatCurrency(room.pricePerNightUsd, locale, currency)}
            </span>
            <span className="block text-xs text-muted-foreground">{t('card.perNight')}</span>
          </span>
        </div>
        {room.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{room.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {room.bedConfiguration ? (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" aria-hidden />
              {room.bedConfiguration}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {t('room.maxGuests', { n: room.maxOccupancy })}
          </span>
          {room.sizeSqm ? (
            <span className="inline-flex items-center gap-1">
              <Maximize className="h-3.5 w-3.5" aria-hidden />
              {room.sizeSqm} m²
            </span>
          ) : null}
        </div>
        <Button asChild size="sm" className="w-full">
          <Link href={`${hotelHref}/book?room=${room.id}`}>{t('room.book')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
