'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';
import type { Guide, Hotel, ItemType, PlaceSummary, Transport } from '@/types/catalog';
import type { DraftItemInput } from '@/types/journey';

interface Option {
  refId: string;
  title: string;
  subtitle: string;
  priceLabel: string;
}

function endpointFor(type: ItemType, city: string | null, search: string): string | null {
  const params = new URLSearchParams({ limit: '20' });
  if (search.trim()) {
    params.set('q', search.trim());
  }
  if (city) {
    params.set('city', city);
  }

  switch (type) {
    case 'PLACE':
      return `/places?${params.toString()}`;
    case 'HOTEL':
      return `/hotels?${params.toString()}`;
    case 'GUIDE': {
      // Guides have no free-text search server-side; city is the useful filter.
      const guideParams = new URLSearchParams({ limit: '20' });
      if (city) guideParams.set('city', city);
      return `/guides?${guideParams.toString()}`;
    }
    case 'TRANSPORT': {
      const transportParams = new URLSearchParams({ limit: '20' });
      if (city) transportParams.set('from', city);
      return `/transports?${transportParams.toString()}`;
    }
    default:
      return null;
  }
}

function toOptions(type: ItemType, rows: unknown[]): Option[] {
  switch (type) {
    case 'PLACE':
      return (rows as PlaceSummary[]).map((row) => ({
        refId: row.id,
        title: row.name,
        subtitle: `${row.city.name} · ${row.category.toLowerCase()}`,
        priceLabel:
          row.entranceFeeCents > 0 ? formatCents(row.entranceFeeCents) : 'No entrance fee',
      }));
    case 'HOTEL':
      return (rows as Hotel[]).map((row) => ({
        refId: row.id,
        title: row.name,
        subtitle: `${row.city.name} · ${row.starRating}★`,
        priceLabel: `${formatCents(row.pricePerNightCents)} / night`,
      }));
    case 'TRANSPORT':
      return (rows as Transport[]).map((row) => ({
        refId: row.id,
        title: `${row.operator} ${row.departureTime}`,
        subtitle: `${row.originCity.name} → ${row.destinationCity.name} · ${row.kind.toLowerCase()}`,
        priceLabel: `${formatCents(row.pricePerSeatCents)} / seat`,
      }));
    case 'GUIDE':
      return (rows as Guide[]).map((row) => ({
        refId: row.id,
        title: row.fullName,
        subtitle: `${row.city.name} · ${row.languages.join(', ')}`,
        priceLabel: `${formatCents(row.pricePerDayCents)} / day`,
      }));
    default:
      return [];
  }
}

interface ResourcePickerProps {
  type: ItemType;
  city: string | null;
  onSelect: (item: DraftItemInput) => void;
  onCancel: () => void;
}

/**
 * Modal list of real catalogue rows. Choosing here is the only way to add a
 * bookable item, so the editor can never invent a reference the API would reject.
 */
export function ResourcePicker({ type, city, onSelect, onCancel }: ResourcePickerProps) {
  const t = useTranslations('customize');
  const [search, setSearch] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const endpoint = endpointFor(type, city, search);
  const options = useQuery({
    queryKey: ['picker', type, city, search],
    queryFn: async () => {
      const page = await api.getPage<unknown>(endpoint!, { authenticated: false });
      return toOptions(type, page.items);
    },
    enabled: Boolean(endpoint),
  });

  // Focus the dialog on open and close on Escape.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(`pickerTitle${type}`)}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col gap-4 overflow-hidden rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-ink-900">{t(`pickerTitle${type}`)}</h2>

        {type === 'CUSTOM' ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (customTitle.trim()) {
                onSelect({ type: 'CUSTOM', title: customTitle.trim() });
              }
            }}
          >
            <label htmlFor="custom-title" className="text-sm font-medium text-ink-800">
              {t('customTitleLabel')}
            </label>
            <input
              id="custom-title"
              autoFocus
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder={t('customTitlePlaceholder')}
              className="rounded-lg border border-ink-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-ink-500">{t('freeTimeNote')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onCancel}>
                {t('pickerCancel')}
              </Button>
              <Button type="submit" size="sm" disabled={!customTitle.trim()}>
                {t('addFreeTime')}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {type === 'PLACE' || type === 'HOTEL' ? (
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('pickerSearch')}
                aria-label={t('pickerSearch')}
                className="rounded-lg border border-ink-300 px-3 py-2 text-sm"
              />
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {options.isLoading ? (
                <p className="py-6 text-center text-sm text-ink-500">{t('pickerLoading')}</p>
              ) : (options.data?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">{t('pickerEmpty')}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {options.data?.map((option) => (
                    <li key={option.refId}>
                      <button
                        type="button"
                        onClick={() =>
                          onSelect({ type, refId: option.refId, title: option.title })
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-ink-100"
                      >
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-ink-900">{option.title}</span>
                          <span className="text-xs text-ink-500">{option.subtitle}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-ink-700">
                          {option.priceLabel}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={onCancel}>
                {t('pickerCancel')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
