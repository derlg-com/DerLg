'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, List, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatDateShort, formatDate } from '@/lib/format'
import { useFestivals } from '@/hooks/use-festivals'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { FestivalCountdown } from './FestivalCountdown'
import {
  FESTIVAL_TYPES,
  FESTIVAL_TYPE_CLASSES,
  filterFestivalsByType,
  resolveFestivalType,
  festivalInMonth,
  type FestivalTypeFilter,
} from '@/types/explore'
import type { FestivalSummary } from '@/types/domain'

type ViewMode = 'month' | 'list'

/** Calendar grid weeks (arrays of day numbers; 0 = padding cell). */
function buildMonthGrid(year: number, month: number): number[][] {
  // month: 0-based.
  const firstDay = new Date(year, month, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: number[] = []
  for (let i = 0; i < firstDay; i++) cells.push(0)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(0)
  const weeks: number[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Whether a festival's [start,end] range covers a specific calendar date. */
function festivalCoversDate(f: FestivalSummary, date: Date): boolean {
  const start = new Date(f.startDate)
  const end = new Date(f.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  return day >= s && day <= e
}

/**
 * Public festivals calendar (task 25.1, Requirement 41.1/41.2): a mobile-first
 * view with a Month grid and a List toggle. Festival entries are color-coded by
 * {@link FestivalType}, and a type filter (task 25.3, Requirement 41.5) narrows
 * both views client-side. Upcoming festivals show a days-until countdown
 * (task 25.4). Data comes from {@link useFestivals}; dates render locale-aware
 * via {@link formatDateShort}.
 */
export function FestivalCalendarView() {
  const t = useTranslations('festivals')
  const locale = useLanguageStore((s) => s.locale)
  const [view, setView] = useState<ViewMode>('month')
  const [typeFilter, setTypeFilter] = useState<FestivalTypeFilter | null>(null)

  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  // Load a generous page (calendar shows many at once); time 'all' so past
  // festivals in the viewed month still appear.
  const { data, isLoading, error, refetch } = useFestivals({ time: 'all', limit: 100 })

  const allItems = useMemo(() => data?.items ?? [], [data?.items])
  const items = useMemo(() => filterFestivalsByType(allItems, typeFilter), [allItems, typeFilter])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={CalendarDays}
          title={t('error.title')}
          description={t('error.desc')}
          action={
            <Button variant="outline" size="sm" onClick={refetch}>
              {t('error.retry')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {t('calendar.title')}
        </h1>
        <div
          className="inline-flex rounded-lg border border-border p-0.5"
          role="group"
          aria-label={t('calendar.viewLabel')}
        >
          <button
            type="button"
            aria-pressed={view === 'month'}
            onClick={() => setView('month')}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'month' ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            {t('calendar.month')}
          </button>
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            <List className="h-4 w-4" aria-hidden />
            {t('calendar.list')}
          </button>
        </div>
      </div>

      <TypeFilter value={typeFilter} onChange={setTypeFilter} />
      <TypeLegend />

      {view === 'month' ? (
        <MonthView
          cursor={cursor}
          onPrev={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          onNext={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          festivals={items}
          locale={locale}
        />
      ) : (
        <ListView festivals={items} locale={locale} />
      )}
    </div>
  )
}

function TypeFilter({
  value,
  onChange,
}: {
  value: FestivalTypeFilter | null
  onChange: (v: FestivalTypeFilter | null) => void
}) {
  const t = useTranslations('festivals')
  const chip =
    'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const activeChip = 'border-transparent bg-gradient-brand text-white shadow-glow'
  const idleChip = 'border-border bg-background text-foreground hover:bg-muted'
  return (
    <div
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      role="group"
      aria-label={t('filters.typeLabel')}
    >
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={cn(chip, value === null ? activeChip : idleChip)}
      >
        {t('filters.type.all')}
      </button>
      {FESTIVAL_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={value === type}
          onClick={() => onChange(type)}
          className={cn(chip, value === type ? activeChip : idleChip)}
        >
          {t(`filters.type.${type}`)}
        </button>
      ))}
    </div>
  )
}

function TypeLegend() {
  const t = useTranslations('festivals')
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label={t('calendar.legendLabel')}>
      {FESTIVAL_TYPES.map((type) => (
        <li key={type} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn('h-2.5 w-2.5 rounded-full', FESTIVAL_TYPE_CLASSES[type].split(' ')[0])}
            aria-hidden
          />
          {t(`filters.type.${type}`)}
        </li>
      ))}
    </ul>
  )
}

function MonthView({
  cursor,
  onPrev,
  onNext,
  festivals,
  locale,
}: {
  cursor: Date
  onPrev: () => void
  onNext: () => void
  festivals: FestivalSummary[]
  locale: ReturnType<typeof useLanguageStore.getState>['locale']
}) {
  const t = useTranslations('festivals')
  const weeks = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const monthLabel = formatDate(cursor, locale, { year: 'numeric', month: 'long' })
  // Weekday headers derived locale-aware from a known week (Sun..Sat).
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        formatDate(new Date(2024, 0, 7 + i, 12), locale, { weekday: 'short' }),
      ),
    [locale],
  )

  const monthFestivals = useMemo(
    () => festivals.filter((f) => festivalInMonth(f, cursor.getMonth() + 1)),
    [festivals, cursor],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          aria-label={t('calendar.prevMonth')}
          className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-display text-lg font-semibold text-foreground" aria-live="polite">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={onNext}
          aria-label={t('calendar.nextMonth')}
          className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {(weekdays as string[]).map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, i) => {
          if (day === 0) return <span key={i} className="aspect-square" aria-hidden />
          const date = new Date(cursor.getFullYear(), cursor.getMonth(), day)
          const dayFestivals = festivals.filter((f) => festivalCoversDate(f, date))
          return (
            <div
              key={i}
              className="flex aspect-square flex-col rounded-lg border border-border/60 p-1 text-left"
            >
              <span className="text-[11px] font-medium text-muted-foreground">{day}</span>
              <span className="mt-auto flex flex-wrap gap-0.5">
                {dayFestivals.slice(0, 3).map((f) => {
                  const ft = resolveFestivalType(f.type)
                  return (
                    <Link
                      key={f.id}
                      href={`/festivals/${f.id}`}
                      title={f.name}
                      aria-label={f.name}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        FESTIVAL_TYPE_CLASSES[ft].split(' ')[0],
                      )}
                    />
                  )
                })}
              </span>
            </div>
          )
        })}
      </div>

      {/* Below-grid list of this month's festivals for tappable detail access. */}
      {monthFestivals.length > 0 ? (
        <ul className="space-y-2 pt-2">
          {monthFestivals.map((f) => (
            <li key={f.id}>
              <FestivalRow festival={f} locale={locale} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('calendar.emptyMonth')}</p>
      )}
    </div>
  )
}

function ListView({
  festivals,
  locale,
}: {
  festivals: FestivalSummary[]
  locale: ReturnType<typeof useLanguageStore.getState>['locale']
}) {
  const t = useTranslations('festivals')
  const sorted = useMemo(
    () =>
      [...festivals].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      ),
    [festivals],
  )
  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t('calendar.emptyTitle')}
        description={t('calendar.emptyDesc')}
      />
    )
  }
  return (
    <ul className="space-y-2">
      {sorted.map((f) => (
        <li key={f.id}>
          <FestivalRow festival={f} locale={locale} />
        </li>
      ))}
    </ul>
  )
}

function FestivalRow({
  festival: f,
  locale,
}: {
  festival: FestivalSummary
  locale: ReturnType<typeof useLanguageStore.getState>['locale']
}) {
  const t = useTranslations('festivals')
  const ft = resolveFestivalType(f.type)
  const start = formatDateShort(f.startDate, locale)
  const end = formatDateShort(f.endDate, locale)
  const dateRange = start === end ? start : `${start} – ${end}`
  const place = f.location ?? f.province ?? undefined
  return (
    <Link
      href={`/festivals/${f.id}`}
      className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn('h-10 w-1.5 shrink-0 rounded-full', FESTIVAL_TYPE_CLASSES[ft].split(' ')[0])}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{f.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {dateRange}
          </span>
          {place ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {place}
            </span>
          ) : null}
          <span className="sr-only">{t(`filters.type.${ft}`)}</span>
        </span>
      </span>
      <FestivalCountdown startDate={f.startDate} />
    </Link>
  )
}
