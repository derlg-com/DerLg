import Image from 'next/image';
import Link from 'next/link';

import { useTranslations } from '@/lib/i18n';
import { cn, formatCents } from '@/lib/utils';
import type { PackageSummary } from '@/types/catalog';

/** Card used on the home page and the /packages grid. */
export function PackageCard({ pkg, priority = false }: { pkg: PackageSummary; priority?: boolean }) {
  const t = useTranslations('packages');
  const tc = useTranslations('common');

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white transition-shadow hover:shadow-md">
      <Link href={`/packages/${pkg.slug}`} className="relative block aspect-[4/3] overflow-hidden">
        {pkg.heroImageUrl ? (
          <Image
            src={pkg.heroImageUrl}
            alt={pkg.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="size-full bg-ink-100" aria-hidden="true" />
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              pkg.kind === 'PRIVATE' ? 'bg-brand-700 text-white' : 'bg-white/95 text-ink-800',
            )}
          >
            {pkg.kind === 'PRIVATE' ? t('kindPrivate') : t('kindPublic')}
          </span>
          {pkg.kidFriendly ? (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-ink-800">
              {t('kidFriendlyBadge')}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {pkg.city.name} · {tc('days', { count: pkg.durationDays })}
          </p>
          <h3 className="text-lg font-semibold leading-snug text-ink-900">
            <Link href={`/packages/${pkg.slug}`} className="hover:underline">
              {pkg.title}
            </Link>
          </h3>
        </div>

        <p className="line-clamp-2 text-sm text-ink-600">{pkg.summary}</p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <p className="flex flex-col">
            <span className="text-xs text-ink-500">{t('fromPrice')}</span>
            <span className="text-xl font-semibold text-ink-900">
              {formatCents(pkg.basePriceCents)}
            </span>
            <span className="text-xs text-ink-500">
              {pkg.pricingMode === 'PER_PERSON' ? tc('perPerson') : tc('perGroup')}
            </span>
          </p>
          <Link
            href={`/packages/${pkg.slug}`}
            className="rounded-full border border-ink-300 px-4 py-2 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-100"
          >
            {t('viewDetails')}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function PackageCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white"
      aria-hidden="true"
    >
      <div className="aspect-[4/3] animate-pulse bg-ink-100" />
      <div className="flex flex-col gap-3 p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
        <div className="h-8 w-28 animate-pulse rounded bg-ink-100" />
      </div>
    </div>
  );
}
