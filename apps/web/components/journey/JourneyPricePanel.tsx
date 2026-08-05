'use client';

import Link from 'next/link';

import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';
import type { DraftView } from '@/types/journey';

interface JourneyPricePanelProps {
  draft: DraftView;
  isSaving: boolean;
  pendingCount: number;
  onGuestsChange: (guests: number) => void;
  onStartDateChange: (startDate: string) => void;
}

export function JourneyPricePanel({
  draft,
  isSaving,
  pendingCount,
  onGuestsChange,
  onStartDateChange,
}: JourneyPricePanelProps) {
  const t = useTranslations('customize');
  const delta = draft.price.deltaCents;

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
      <div className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          {t('priceTitle')}
        </h2>

        <dl className="flex flex-col gap-1.5 text-sm">
          {draft.price.baseCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-600">{t('priceBase')}</dt>
              <dd className="tabular-nums text-ink-900">{formatCents(draft.price.baseCents)}</dd>
            </div>
          ) : null}

          {delta !== 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-600">{t('priceDelta')}</dt>
              <dd
                className={`tabular-nums ${delta > 0 ? 'text-ink-900' : 'text-emerald-700'}`}
                data-testid="price-delta"
              >
                {delta > 0 ? '+' : '−'}
                {formatCents(Math.abs(delta))}
              </dd>
            </div>
          ) : null}

          <div className="mt-1 flex items-baseline justify-between border-t border-ink-100 pt-2">
            <dt className="font-medium text-ink-900">{t('priceTotal')}</dt>
            <dd
              className="text-2xl font-semibold tabular-nums text-ink-900"
              data-testid="price-total"
            >
              {formatCents(draft.price.totalCents)}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-ink-500" role="status" aria-live="polite">
          {isSaving
            ? t('saving')
            : pendingCount > 0
              ? t('pending', { count: pendingCount })
              : t('saved')}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="draft-guests" className="text-sm font-medium text-ink-800">
            {t('guestsLabel')}
          </label>
          <input
            id="draft-guests"
            type="number"
            min={1}
            max={40}
            value={draft.guests}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(next) && next >= 1 && next <= 40) {
                onGuestsChange(next);
              }
            }}
            className="rounded-lg border border-ink-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="draft-start-date" className="text-sm font-medium text-ink-800">
            {t('startDateLabel')}
          </label>
          <input
            id="draft-start-date"
            type="date"
            value={draft.startDate ?? ''}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="rounded-lg border border-ink-300 px-3 py-2 text-sm"
          />
          {!draft.startDate ? <p className="text-xs text-ink-500">{t('startDateHint')}</p> : null}
        </div>

        {draft.availability ? (
          <p
            className={`rounded-lg px-3 py-2 text-xs ${
              draft.availability.available
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}
            role="status"
            data-testid="availability-summary"
          >
            {draft.availability.available
              ? t('availabilityOk')
              : t('availabilityProblem', { count: draft.availability.unavailableCount })}
          </p>
        ) : null}
      </div>

      {draft.price.lines.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-ink-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            {t('priceBreakdown')}
          </h3>
          <ul className="flex flex-col gap-1 text-xs text-ink-600">
            {draft.price.lines.map((line, index) => (
              <li key={`${line.label}-${index}`} className="flex justify-between gap-2">
                <span className="truncate">
                  {line.label} ×{line.quantity}
                </span>
                <span className="shrink-0 tabular-nums">{formatCents(line.totalCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Link
          href={`/checkout/new?draft=${draft.id}`}
          className="rounded-full bg-brand-600 px-5 py-3 text-center font-medium text-white hover:bg-brand-700"
        >
          {t('continueToBooking')}
        </Link>
        <Link
          href={`/vibe?draft=${draft.id}`}
          className="rounded-full px-5 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          {t('askAi')}
        </Link>
        {draft.packageSlug ? (
          <Link
            href={`/packages/${draft.packageSlug}`}
            className="rounded-full px-5 py-2.5 text-center text-sm text-ink-600 hover:bg-ink-100"
          >
            {t('backToPackage')}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
