'use client'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'

interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function BudgetEstimateRenderer({ item }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const t = useTranslations()
  const { totalUsd, breakdown } = item.data as { totalUsd: number; breakdown: Record<string, number> }
  return (
    <div className="p-4 space-y-2">
      <p className="font-semibold text-sm">{t('budget.title')}</p>
      <p className="text-2xl font-bold">{formatCurrency(totalUsd, locale)}</p>
      <div className="space-y-1">
        {Object.entries(breakdown).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="capitalize text-muted-foreground">{k}</span>
            <span>{formatCurrency(v, locale)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
