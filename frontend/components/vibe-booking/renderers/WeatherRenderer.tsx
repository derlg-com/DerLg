'use client'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { formatWeekday } from '@/lib/format'

interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
type Forecast = { date: string; icon?: string; high: number; low: number }

export default function WeatherRenderer({ item }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const t = useTranslations()
  const { forecast } = item.data as { forecast: Forecast[] }
  return (
    <div className="p-4">
      <p className="font-semibold text-sm mb-3">{t('weather.fiveDay')}</p>
      <div className="flex gap-2 overflow-x-auto">
        {forecast.map((d) => (
          <div key={d.date} className="flex-shrink-0 text-center text-xs p-2 rounded-lg bg-muted min-w-[60px]">
            <p className="font-medium">{formatWeekday(d.date, locale)}</p>
            <p className="text-lg">{d.icon ?? '🌤'}</p>
            <p>{d.high}° / {d.low}°</p>
          </div>
        ))}
      </div>
    </div>
  )
}
