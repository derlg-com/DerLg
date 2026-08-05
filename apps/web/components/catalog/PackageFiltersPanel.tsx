'use client';

import { useTranslations } from '@/lib/i18n';
import type { City } from '@/types/catalog';

import type { PackageFilters } from '@/hooks/use-catalog';

export type DurationBand = 'any' | 'short' | 'medium' | 'long';

export function durationBandToRange(band: DurationBand): { minDays?: number; maxDays?: number } {
  switch (band) {
    case 'short':
      return { minDays: 1, maxDays: 3 };
    case 'medium':
      return { minDays: 4, maxDays: 7 };
    case 'long':
      return { minDays: 8 };
    default:
      return {};
  }
}

export interface PackageFiltersState {
  city: string;
  kind: '' | 'PUBLIC' | 'PRIVATE';
  duration: DurationBand;
  maxPrice: string;
  kidFriendly: boolean;
  q: string;
  sort: NonNullable<PackageFilters['sort']>;
}

export const EMPTY_FILTERS: PackageFiltersState = {
  city: '',
  kind: '',
  duration: 'any',
  maxPrice: '',
  kidFriendly: false,
  q: '',
  sort: 'featured',
};

/** Translates UI filter state into the API query shape. */
export function toApiFilters(state: PackageFiltersState, page: number): PackageFilters {
  const parsedPrice = Number.parseInt(state.maxPrice, 10);

  return {
    ...(state.city ? { city: state.city } : {}),
    ...(state.kind ? { kind: state.kind } : {}),
    ...durationBandToRange(state.duration),
    ...(Number.isFinite(parsedPrice) && parsedPrice > 0 ? { maxPrice: parsedPrice } : {}),
    ...(state.kidFriendly ? { kidFriendly: true } : {}),
    ...(state.q.trim() ? { q: state.q.trim() } : {}),
    sort: state.sort,
    page,
    limit: 9,
  };
}

interface PackageFiltersPanelProps {
  value: PackageFiltersState;
  cities: City[];
  onChange: (next: PackageFiltersState) => void;
  onReset: () => void;
}

export function PackageFiltersPanel({
  value,
  cities,
  onChange,
  onReset,
}: PackageFiltersPanelProps) {
  const t = useTranslations('packages');
  const set = <K extends keyof PackageFiltersState>(key: K, next: PackageFiltersState[K]) =>
    onChange({ ...value, [key]: next });

  const fieldClass =
    'rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-brand-600';

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl border border-ink-200 bg-white p-5"
      aria-label={t('filtersTitle')}
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
        {t('filtersTitle')}
      </h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-q" className="text-sm font-medium text-ink-800">
          {t('filterSearch')}
        </label>
        <input
          id="filter-q"
          type="search"
          value={value.q}
          placeholder={t('filterSearchPlaceholder')}
          onChange={(event) => set('q', event.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-city" className="text-sm font-medium text-ink-800">
          {t('filterCity')}
        </label>
        <select
          id="filter-city"
          value={value.city}
          onChange={(event) => set('city', event.target.value)}
          className={fieldClass}
        >
          <option value="">{t('filterCityAny')}</option>
          {cities.map((city) => (
            <option key={city.slug} value={city.slug}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-kind" className="text-sm font-medium text-ink-800">
          {t('filterKind')}
        </label>
        <select
          id="filter-kind"
          value={value.kind}
          onChange={(event) => set('kind', event.target.value as PackageFiltersState['kind'])}
          className={fieldClass}
        >
          <option value="">{t('filterKindAny')}</option>
          <option value="PUBLIC">{t('filterKindPublic')}</option>
          <option value="PRIVATE">{t('filterKindPrivate')}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-duration" className="text-sm font-medium text-ink-800">
          {t('filterDuration')}
        </label>
        <select
          id="filter-duration"
          value={value.duration}
          onChange={(event) => set('duration', event.target.value as DurationBand)}
          className={fieldClass}
        >
          <option value="any">{t('filterDurationAny')}</option>
          <option value="short">{t('filterDurationShort')}</option>
          <option value="medium">{t('filterDurationMedium')}</option>
          <option value="long">{t('filterDurationLong')}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-max-price" className="text-sm font-medium text-ink-800">
          {t('filterMaxPrice')}
        </label>
        <input
          id="filter-max-price"
          type="number"
          inputMode="numeric"
          min={0}
          step={50}
          value={value.maxPrice}
          onChange={(event) => set('maxPrice', event.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="filter-kid-friendly"
          type="checkbox"
          checked={value.kidFriendly}
          onChange={(event) => set('kidFriendly', event.target.checked)}
          className="size-4 rounded border-ink-300"
        />
        <label htmlFor="filter-kid-friendly" className="text-sm text-ink-800">
          {t('filterKidFriendly')}
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-sort" className="text-sm font-medium text-ink-800">
          {t('filterSort')}
        </label>
        <select
          id="filter-sort"
          value={value.sort}
          onChange={(event) => set('sort', event.target.value as PackageFiltersState['sort'])}
          className={fieldClass}
        >
          <option value="featured">{t('sortFeatured')}</option>
          <option value="price_asc">{t('sortPriceAsc')}</option>
          <option value="price_desc">{t('sortPriceDesc')}</option>
          <option value="duration_asc">{t('sortDurationAsc')}</option>
          <option value="newest">{t('sortNewest')}</option>
        </select>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
      >
        {t('clearFilters')}
      </button>
    </form>
  );
}
