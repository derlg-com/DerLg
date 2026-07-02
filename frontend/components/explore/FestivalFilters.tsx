'use client'

import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { useTranslations } from '@/lib/i18n'
import { FESTIVAL_MONTH_ANY, FESTIVAL_TIME_FILTERS, type FestivalTimeFilter } from '@/types/explore'

interface FestivalFiltersProps {
  time: FestivalTimeFilter
  month: number | null
  province: string | null
  /** Distinct province labels derived from the loaded festivals. */
  provinces: string[]
  onTimeChange: (time: FestivalTimeFilter) => void
  onMonthChange: (month: number | null) => void
  onProvinceChange: (province: string | null) => void
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/**
 * Filter controls for the Explore → Festivals tab: a row of time chips
 * (upcoming/all, mirroring {@link PlaceFilters}'s category chips) plus a month
 * select (date filter) and a province select (location filter) — the two
 * filters Requirement 4.3 mandates. Selections are lifted to the parent, which
 * persists them in the URL query (Requirement 4.7, 4.8) and refetches/filters
 * in real time.
 */
export function FestivalFilters({
  time,
  month,
  province,
  provinces,
  onTimeChange,
  onMonthChange,
  onProvinceChange,
}: FestivalFiltersProps) {
  const t = useTranslations('explore.festivals')
  const chip =
    'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const activeChip = 'border-transparent bg-gradient-brand text-white shadow-glow'
  const idleChip = 'border-border bg-background text-foreground hover:bg-muted'

  return (
    <div className="space-y-3">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label={t('filters.timeLabel')}
      >
        {FESTIVAL_TIME_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={time === value}
            onClick={() => onTimeChange(value)}
            className={cn(chip, time === value ? activeChip : idleChip)}
          >
            {t(`filters.time.${value}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="w-44">
          <Select
            value={month == null ? FESTIVAL_MONTH_ANY : String(month)}
            onChange={(e) =>
              onMonthChange(e.target.value === FESTIVAL_MONTH_ANY ? null : Number(e.target.value))
            }
            aria-label={t('filters.monthLabel')}
          >
            <option value={FESTIVAL_MONTH_ANY}>{t('filters.month.all')}</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {t(`filters.month.${m}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-44">
          <Select
            value={province ?? ''}
            onChange={(e) => onProvinceChange(e.target.value || null)}
            aria-label={t('filters.provinceLabel')}
            disabled={provinces.length === 0}
          >
            <option value="">{t('filters.province.all')}</option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  )
}
