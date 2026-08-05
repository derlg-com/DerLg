'use client';

import { useState } from 'react';

import { PackageCard, PackageCardSkeleton } from '@/components/catalog/PackageCard';
import {
  EMPTY_FILTERS,
  PackageFiltersPanel,
  type PackageFiltersState,
  toApiFilters,
} from '@/components/catalog/PackageFiltersPanel';
import { Button } from '@/components/ui/Button';
import { useCities, usePackages } from '@/hooks/use-catalog';
import { useTranslations } from '@/lib/i18n';

/** /packages — filterable catalogue grid. */
export function PackageBrowser() {
  const t = useTranslations('packages');
  const [filters, setFilters] = useState<PackageFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const cities = useCities();
  const packages = usePackages(toApiFilters(filters, page));

  const applyFilters = (next: PackageFiltersState) => {
    setFilters(next);
    // Any filter change invalidates the current page offset.
    setPage(1);
  };

  const total = packages.data?.meta.total ?? 0;
  const totalPages = packages.data?.meta.totalPages ?? 1;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-ink-900">{t('listTitle')}</h1>
        <p className="max-w-2xl text-ink-600">{t('listBody')}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <PackageFiltersPanel
            value={filters}
            cities={cities.data ?? []}
            onChange={applyFilters}
            onReset={() => applyFilters(EMPTY_FILTERS)}
          />
        </aside>

        <section className="flex flex-col gap-6">
          <p className="text-sm text-ink-600" role="status" aria-live="polite">
            {packages.isLoading
              ? ''
              : total === 1
                ? t('resultCountOne')
                : t('resultCount', { count: total })}
          </p>

          {packages.isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <PackageCardSkeleton key={index} />
              ))}
            </div>
          ) : packages.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
              <p className="text-sm text-red-700">{t('loadError')}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => packages.refetch()}>
                {t('clearFilters')}
              </Button>
            </div>
          ) : total === 0 ? (
            <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center">
              <p className="font-medium text-ink-800">{t('empty')}</p>
              <p className="mt-1 text-sm text-ink-600">{t('emptyHint')}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {packages.data?.items.map((pkg, index) => (
                  <PackageCard key={pkg.id} pkg={pkg} priority={index < 3} />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav className="flex items-center justify-between gap-4" aria-label={t('filterSort')}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {t('previousPage')}
                  </Button>
                  <span className="text-sm text-ink-600">
                    {t('pageOf', { page, total: totalPages })}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    {t('nextPage')}
                  </Button>
                </nav>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
