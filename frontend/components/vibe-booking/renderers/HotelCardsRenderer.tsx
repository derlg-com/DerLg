'use client'
import Image from 'next/image'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'

interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function HotelCardsRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const t = useTranslations()
  const { hotels } = item.data as { hotels: Array<{ id: string; name: string; priceUsd: number; rating?: number; imageUrl?: string; amenities?: string[] }> }
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {hotels.map((h) => (
        <div key={h.id} className="rounded-lg border overflow-hidden">
          {h.imageUrl && (
            <div className="relative w-full h-32">
              <Image
                src={h.imageUrl}
                alt={h.name}
                fill
                loading="lazy"
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
          <div className="p-3 space-y-1">
            <p className="font-semibold text-sm">{h.name}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(h.priceUsd, locale)}/{t('hotel.perNight')}{h.rating ? ` · ⭐ ${h.rating}` : ''}</p>
            {h.amenities && <p className="text-xs text-muted-foreground">{h.amenities.slice(0, 3).join(' · ')}</p>}
            <button onClick={() => onAction('view_hotel', h.id, { hotelId: h.id })} className="w-full text-xs border border-border rounded py-1 mt-1">{t('hotel.viewDetails')}</button>
          </div>
        </div>
      ))}
    </div>
  )
}
