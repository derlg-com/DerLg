'use client'

import { Award, TrendingDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Price } from '@/components/shared/price'
import { Badge, Button, buttonVariants } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import type { PayloadTrip } from '@/schemas/vibe-payloads'

/**
 * Side-by-side comparison (spec §8).
 *
 * The agent emits `comparison` whenever a search returns exactly two results, and
 * until now that block reused the trip-card rail — which is the one layout that
 * makes comparison HARD, because the values a user is weighing (price against
 * duration against rating) end up on different rows of different cards.
 *
 * This aligns them instead: one row per attribute, one column per option, so the
 * eye travels along a row to compare a single dimension. The cheapest and
 * top-rated options are marked, since "which is cheaper?" is the question people
 * actually ask (§8) and answering it should not require arithmetic.
 *
 * Below `sm` it becomes stacked per-option panels rather than a horizontally
 * scrolling table: a table you have to scroll sideways to read defeats the point.
 */

export interface ComparisonTableProps {
  items: PayloadTrip[]
  onAsk: (text: string) => void
  title?: string
}

interface Row {
  key: string
  label: string
  /** null renders as an em dash rather than an empty cell. */
  value: (trip: PayloadTrip) => React.ReactNode | null
}

export function ComparisonTable({ items, onAsk, title }: ComparisonTableProps) {
  const t = useTranslations('content')
  const tCompare = useTranslations('comparison')

  if (items.length === 0) return null
  // One option is not a comparison; fall back to the caller's card rendering.
  if (items.length === 1) return null

  const heading = title ?? t('comparison')

  const cheapestId = extremum(items, (trip) => trip.priceUsd, 'min')
  const bestRatedId = extremum(
    items.filter((trip) => trip.rating !== undefined),
    (trip) => trip.rating ?? 0,
    'max',
  )

  const rows: Row[] = [
    {
      key: 'price',
      label: tCompare('price'),
      value: (trip) => (
        <span className="font-semibold text-[var(--text-primary)]">
          <Price amountUsd={trip.priceUsd} />
          <span className="ml-1 text-xs font-normal text-[var(--text-tertiary)]">
            {t('perPerson')}
          </span>
        </span>
      ),
    },
    {
      key: 'duration',
      label: tCompare('duration'),
      value: (trip) =>
        trip.durationDays === undefined
          ? null
          : tCompare('days', { count: trip.durationDays }),
    },
    {
      key: 'rating',
      label: tCompare('rating'),
      value: (trip) =>
        trip.rating === undefined ? null : (
          <span>
            ★ {trip.rating.toFixed(1)}
            {trip.reviewCount !== undefined ? (
              <span className="ml-1 text-xs text-[var(--text-tertiary)]">
                ({trip.reviewCount})
              </span>
            ) : null}
          </span>
        ),
    },
    {
      key: 'province',
      label: tCompare('location'),
      value: (trip) => trip.province ?? null,
    },
    {
      key: 'highlights',
      label: tCompare('highlights'),
      value: (trip) =>
        trip.highlights && trip.highlights.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {trip.highlights.slice(0, 3).map((highlight) => (
              <li key={highlight} className="flex gap-1.5">
                <span aria-hidden="true" className="text-[var(--tone-success-text)]">
                  ✓
                </span>
                {highlight}
              </li>
            ))}
          </ul>
        ) : null,
    },
  ]

  return (
    <section className="flex flex-col gap-2" data-testid="comparison-table">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {heading}
      </h3>

      {/*
       * One table, scrolled horizontally when there are too many options to fit.
       * The alternative — a table above `sm` and stacked cards below — would put
       * every option's name in the DOM twice, which doubles what a screen reader
       * has to wade through and what the page has to lay out. The row-label column
       * is sticky instead, so a scrolled column is never anonymous.
       *
       * `tabIndex={0}` because a scroll container that only a mouse can pan is a
       * WCAG 2.1.1 failure: keyboard users must be able to reach the columns that
       * are off-screen.
       */}
      <div
        role="region"
        aria-label={heading}
        tabIndex={0}
        className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
              {/* Empty corner cell: the row labels below are the row headers. */}
              <th
                scope="col"
                className="sticky left-0 z-10 w-24 min-w-24 bg-[var(--surface-sunken)] p-2 text-left"
              >
                <span className="sr-only">{tCompare('attribute')}</span>
              </th>
              {items.map((trip) => (
                <th
                  key={trip.id}
                  scope="col"
                  className="min-w-40 p-2 text-left align-top sm:min-w-48"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {trip.name}
                    </span>
                    <Markers
                      isCheapest={trip.id === cheapestId}
                      isBestRated={trip.id === bestRatedId}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              // Drop a row no option has a value for: an all-dashes row is noise.
              if (items.every((trip) => row.value(trip) === null)) return null

              return (
                <tr key={row.key} className="border-b border-[var(--border-subtle)] last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-[var(--surface)] p-2 text-left align-top text-xs font-medium text-[var(--text-tertiary)]"
                  >
                    {row.label}
                  </th>
                  {items.map((trip) => (
                    <td key={trip.id} className="p-2 align-top text-[var(--text-secondary)]">
                      {row.value(trip) ?? <span aria-hidden="true">—</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
            <tr>
              <td className="sticky left-0 z-10 bg-[var(--surface)] p-2" />
              {items.map((trip) => (
                <td key={trip.id} className="p-2 align-top">
                  <Actions trip={trip} onAsk={onAsk} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => onAsk(tCompare('askWhich', { names: items.map((i) => i.name).join(', ') }))}
      >
        {tCompare('askRecommendation')}
      </Button>
    </section>
  )
}

/**
 * "Cheapest" / "Top rated" markers.
 *
 * Both carry an icon as well as a label, so the distinction does not rest on the
 * badge colour alone.
 */
function Markers({ isCheapest, isBestRated }: { isCheapest: boolean; isBestRated: boolean }) {
  const t = useTranslations('comparison')

  if (!isCheapest && !isBestRated) return null

  return (
    <ul className="flex flex-wrap gap-1">
      {isCheapest ? (
        <li>
          <Badge tone="success">
            <TrendingDown aria-hidden="true" className="size-3" />
            {t('cheapest')}
          </Badge>
        </li>
      ) : null}
      {isBestRated ? (
        <li>
          <Badge tone="accent">
            <Award aria-hidden="true" className="size-3" />
            {t('topRated')}
          </Badge>
        </li>
      ) : null}
    </ul>
  )
}

function Actions({ trip, onAsk }: { trip: PayloadTrip; onAsk: (text: string) => void }) {
  const t = useTranslations('content')
  const tWorkspace = useTranslations('workspace')

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {/* Localised: this becomes the user's own next message in the transcript. */}
      <Button size="sm" onClick={() => onAsk(tWorkspace('askBook', { name: trip.name }))}>
        {t('bookNow')}
      </Button>
      <Link
        href={`/trips/${trip.id}`}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
      >
        {t('viewDetails')}
      </Link>
    </div>
  )
}

/**
 * Id of the item with the min/max score, or undefined when the field is unusable.
 *
 * Ties resolve to the FIRST item, which preserves the agent's own ordering — it
 * ranked the results by relevance, and re-ranking silently would misrepresent that.
 */
function extremum(
  items: PayloadTrip[],
  score: (trip: PayloadTrip) => number,
  direction: 'min' | 'max',
): string | undefined {
  if (items.length < 2) return undefined

  let bestId: string | undefined
  let bestScore: number | undefined

  for (const item of items) {
    const value = score(item)
    if (!Number.isFinite(value)) continue
    if (
      bestScore === undefined ||
      (direction === 'min' ? value < bestScore : value > bestScore)
    ) {
      bestScore = value
      bestId = item.id
    }
  }

  // Every option scoring the same means nothing is "the cheapest".
  if (bestScore !== undefined && items.every((item) => score(item) === bestScore)) {
    return undefined
  }

  return bestId
}
