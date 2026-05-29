'use client'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'

interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
type CompareItem = { id: string; name: string; priceUsd: number; durationDays: number; rating?: number }

export default function ComparisonRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const t = useTranslations()
  const { items } = item.data as { items: CompareItem[] }
  return (
    <div className="p-4">
      <p className="font-semibold text-sm mb-3">{t('compare.title')}</p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((c) => (
          <div key={c.id} className="rounded-lg border p-3 space-y-1 text-sm">
            <p className="font-medium">{c.name}</p>
            <p className="text-muted-foreground">{formatCurrency(c.priceUsd, locale)} · {c.durationDays}d</p>
            {c.rating && <p className="text-xs">⭐ {c.rating}</p>}
            <button onClick={() => onAction('book_trip', c.id, { tripId: c.id })} className="w-full text-xs bg-primary text-primary-foreground rounded py-1 mt-1">{t('compare.book')}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
