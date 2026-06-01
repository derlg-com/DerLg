'use client'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { z } from 'zod'
import type { ContentItem } from '@/stores/vibe-booking.store'
import type { TripDetailPayloadSchema } from '@/schemas/vibe-booking'
import { useLanguageStore } from '@/lib/i18n'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { formatCurrency } from '@/lib/format'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

type Data = z.infer<typeof TripDetailPayloadSchema>['data']

export default function TripDetailRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const addContentItem = useVibeBookingStore((s) => s.addContentItem)
  const t = item.data as Data
  const gallery = (t.images ?? []).filter((u) => u && u !== t.imageUrl)

  const showOnMap = () => {
    if (t.lat == null || t.lng == null) return
    addContentItem({
      id: uuid(),
      type: 'map_view',
      data: { center: { lat: t.lat, lng: t.lng }, markers: [{ id: t.id, lat: t.lat, lng: t.lng, label: t.name }] },
      actions: [],
      metadata: { title: t.name },
      status: 'ready',
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <div className="overflow-hidden">
      {t.imageUrl && (
        <div className="relative w-full aspect-video">
          <Image src={t.imageUrl} alt={t.name} fill loading="lazy" sizes="100vw" className="object-cover" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-base">{t.name}</p>
          <p className="text-lg font-bold text-primary whitespace-nowrap">{formatCurrency(t.priceUsd, locale)}</p>
        </div>
        {t.durationDays != null && (
          <p className="text-xs text-muted-foreground">{t.durationDays} days{t.rating ? ` · ⭐ ${t.rating}` : ''}</p>
        )}
        {t.description && <p className="text-sm text-foreground/90">{t.description}</p>}

        {t.included && t.included.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {t.included.map((it, i) => (
              <span key={i} className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">✓ {it}</span>
            ))}
          </div>
        )}
        {t.excluded && t.excluded.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {t.excluded.map((it, i) => (
              <span key={i} className="text-xs rounded-full bg-muted text-muted-foreground px-2 py-0.5">✕ {it}</span>
            ))}
          </div>
        )}

        {t.itinerary && t.itinerary.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-sm">Itinerary</p>
            {t.itinerary.map((d) => (
              <div key={d.day} className="border-l-2 border-primary pl-3">
                <p className="text-sm font-medium">Day {d.day}: {d.title}</p>
                {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
              </div>
            ))}
          </div>
        )}

        {gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {gallery.slice(0, 6).map((url, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden">
                <Image src={url} alt={`${t.name} photo ${i + 1}`} fill loading="lazy" sizes="33vw" className="object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAction('book_trip', t.id, { tripId: t.id })}
            className="flex-1 text-sm bg-primary text-primary-foreground rounded-md min-h-[44px] px-3 font-medium transition-colors hover:opacity-90 active:opacity-80"
          >
            Book Now
          </button>
          {t.lat != null && t.lng != null && (
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
