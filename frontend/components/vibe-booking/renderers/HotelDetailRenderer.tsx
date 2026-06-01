'use client'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { z } from 'zod'
import type { ContentItem } from '@/stores/vibe-booking.store'
import type { HotelDetailPayloadSchema } from '@/schemas/vibe-booking'
import { useLanguageStore } from '@/lib/i18n'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { formatCurrency } from '@/lib/format'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

type Data = z.infer<typeof HotelDetailPayloadSchema>['data']

export default function HotelDetailRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const addContentItem = useVibeBookingStore((s) => s.addContentItem)
  const h = item.data as Data
  const gallery = (h.images ?? []).filter((u) => u && u !== h.imageUrl)

  const showOnMap = () => {
    if (h.lat == null || h.lng == null) return
    addContentItem({
      id: uuid(),
      type: 'map_view',
      data: { center: { lat: h.lat, lng: h.lng }, markers: [{ id: h.id, lat: h.lat, lng: h.lng, label: h.name }] },
      actions: [],
      metadata: { title: h.name },
      status: 'ready',
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <div className="overflow-hidden">
      {h.imageUrl && (
        <div className="relative w-full aspect-video">
          <Image src={h.imageUrl} alt={h.name} fill loading="lazy" sizes="100vw" className="object-cover" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-base">{h.name}</p>
          {h.priceUsd > 0 && (
            <p className="text-lg font-bold text-primary whitespace-nowrap">{formatCurrency(h.priceUsd, locale)}<span className="text-xs font-normal text-muted-foreground">/night</span></p>
          )}
        </div>
        {(h.rating || h.address) && (
          <p className="text-xs text-muted-foreground">{h.rating ? `⭐ ${h.rating}` : ''}{h.rating && h.address ? ' · ' : ''}{h.address ?? ''}</p>
        )}
        {h.description && <p className="text-sm text-foreground/90">{h.description}</p>}

        {h.amenities && h.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {h.amenities.map((a, i) => (
              <span key={i} className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">{a}</span>
            ))}
          </div>
        )}

        {gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {gallery.slice(0, 6).map((url, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden">
                <Image src={url} alt={`${h.name} photo ${i + 1}`} fill loading="lazy" sizes="33vw" className="object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAction('book_hotel', h.id, { hotelId: h.id })}
            className="flex-1 text-sm bg-primary text-primary-foreground rounded-md min-h-[44px] px-3 font-medium transition-colors hover:opacity-90 active:opacity-80"
          >
            Book Now
          </button>
          {h.lat != null && h.lng != null && (
            <button
              onClick={showOnMap}
              className="text-sm border border-border rounded-md min-h-[44px] px-3 inline-flex items-center gap-1 transition-colors hover:bg-muted active:bg-muted/70"
            >
              <MapPin size={14} aria-hidden /> Map
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
