'use client'

import { useTranslations } from 'next-intl'

import { Price } from '@/components/shared/price'
import { Link } from '@/lib/i18n/navigation'
import type { ContentPayload } from '@/schemas/vibe-payloads'

/**
 * Custom trip card — the result of the agent's `create_trip` tool.
 *
 * The agent composes a trip (hotel room, guide, vehicle, extras) and the backend
 * persists it as a real Trip row, so `data.id` resolves on `/trips/[id]` just
 * like a catalogue trip. Styling follows the other rich blocks: one subject,
 * several facets, in a labelled panel.
 *
 * The backend prices everything server-side, so `totalUsd` is the authoritative
 * figure; the per-line amounts below it are shown for transparency only.
 */

type CustomTripCardData = Extract<ContentPayload, { type: 'custom_trip_card' }>['data']

/** hotel_room -> Hotel room. The agent sends snake_case item types. */
function readableType(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function CustomTripCardBlock({ data }: { data: CustomTripCardData }) {
  const t = useTranslations('content')

  const hasExtras = data.extras !== undefined && data.extras.length > 0

  return (
    <section className="flex flex-col gap-2" data-testid="custom-trip-card">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {t('customTrip')}
      </h3>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h4 className="text-base font-semibold text-[var(--text-primary)]">{data.title}</h4>
            <p className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                <Price amountUsd={data.totalUsd} />
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {t('customTripTotal')}
              </span>
              {data.durationDays > 0 ? (
                <span className="text-xs text-[var(--text-tertiary)]">
                  · {t('customTripDays', { count: data.durationDays })}
                </span>
              ) : null}
            </p>
          </div>

          {data.items.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                {t('customTripItems')}
              </p>
              {/* A definition list: each row is a label/amount pair. */}
              <ul className="flex flex-col gap-1.5">
                {data.items.map((item, index) => (
                  <li
                    key={`${item.type}-${item.name}-${index}`}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 text-[var(--text-secondary)]">
                      <span className="text-[var(--text-primary)]">{item.name}</span>
                      {item.quantity > 1 ? (
                        <span className="text-[var(--text-tertiary)]">
                          {' '}
                          {t('customTripQuantity', { count: item.quantity })}
                        </span>
                      ) : null}
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {' '}
                        · {readableType(item.type)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[var(--text-primary)]">
                      <Price amountUsd={item.unitPriceUsd * item.quantity} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasExtras ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                {t('customTripExtras')}
              </p>
              <ul className="flex flex-col gap-1.5">
                {data.extras!.map((extra, index) => (
                  <li
                    key={`${extra.name}-${index}`}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 text-[var(--text-secondary)]">
                      <span className="text-[var(--text-primary)]">{extra.name}</span>
                      {extra.quantity > 1 ? (
                        <span className="text-[var(--text-tertiary)]">
                          {' '}
                          {t('customTripQuantity', { count: extra.quantity })}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[var(--text-primary)]">
                      <Price amountUsd={extra.unitPriceUsd * extra.quantity} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Link
            href={`/trips/${data.id}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)] pointer-coarse:min-h-11"
          >
            {t('customTripBook')}
          </Link>
        </div>
      </div>
    </section>
  )
}
