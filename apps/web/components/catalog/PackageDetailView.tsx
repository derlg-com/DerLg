import Image from 'next/image';
import Link from 'next/link';

import { ItineraryTimeline } from '@/components/catalog/ItineraryTimeline';
import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';
import type { PackageDetail } from '@/types/catalog';

/**
 * Gathers the gallery from the places used across the itinerary, keeping each
 * image's licence attribution attached (a CC BY-SA obligation).
 */
function galleryFrom(pkg: PackageDetail) {
  const seen = new Set<string>();
  const gallery: Array<{ url: string; author: string | null; license: string | null; alt: string }> =
    [];

  for (const day of pkg.days) {
    for (const item of day.items) {
      if (item.reference?.kind !== 'PLACE') {
        continue;
      }
      const image = item.reference.place.images[0];
      if (!image || seen.has(image.url)) {
        continue;
      }
      seen.add(image.url);
      gallery.push({
        url: image.url,
        author: image.author,
        license: image.license,
        alt: item.reference.place.name,
      });
    }
  }

  return gallery.slice(0, 6);
}

export function PackageDetailView({ pkg }: { pkg: PackageDetail }) {
  const t = useTranslations('packageDetail');
  const tp = useTranslations('packages');
  const tc = useTranslations('common');
  const gallery = galleryFrom(pkg);

  return (
    <article className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800">
            {pkg.kind === 'PRIVATE' ? tp('kindPrivate') : tp('kindPublic')}
          </span>
          <span className="text-ink-500">{t('cityLabel', { city: pkg.city.name })}</span>
          <span className="text-ink-400" aria-hidden="true">
            ·
          </span>
          <span className="text-ink-500">{t('durationDays', { count: pkg.durationDays })}</span>
          {pkg.kidFriendly ? (
            <span className="rounded-full bg-ink-100 px-3 py-1 text-ink-700">
              {tp('kidFriendlyBadge')}
            </span>
          ) : null}
        </div>

        <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">
          {pkg.title}
        </h1>
        <p className="max-w-3xl text-lg text-ink-600">{pkg.summary}</p>
      </header>

      {pkg.heroImageUrl ? (
        <div className="relative aspect-[21/9] overflow-hidden rounded-3xl bg-ink-100">
          <Image
            src={pkg.heroImageUrl}
            alt={pkg.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1152px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-10">
          {pkg.highlights.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold text-ink-900">{t('highlights')}</h2>
              <ul className="flex flex-col gap-2">
                {pkg.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2 text-ink-700">
                    <span aria-hidden="true" className="text-brand-600">
                      ●
                    </span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-5">
            <h2 className="text-xl font-semibold text-ink-900">{t('itinerary')}</h2>
            <ItineraryTimeline days={pkg.days} />
          </section>

          <section className="grid gap-8 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink-900">{t('included')}</h2>
              <ul className="flex flex-col gap-1.5 text-sm text-ink-700">
                {pkg.inclusions.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink-900">{t('excluded')}</h2>
              <ul className="flex flex-col gap-1.5 text-sm text-ink-500">
                {pkg.exclusions.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          </section>

          {gallery.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink-900">{pkg.city.name}</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((image) => (
                  <li key={image.url} className="flex flex-col gap-1">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink-100">
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        loading="lazy"
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                    <p className="text-[11px] leading-tight text-ink-500">
                      {image.alt}
                      {image.author && image.license
                        ? ` — ${t('imageCredit', { author: image.author, license: image.license })}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-6">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-ink-500">{t('priceFrom')}</span>
              <span className="text-3xl font-semibold text-ink-900">
                {formatCents(pkg.basePriceCents)}
              </span>
              <span className="text-sm text-ink-500">
                {pkg.pricingMode === 'PER_PERSON' ? t('perPerson') : t('perGroup')}
              </span>
            </div>

            <p className="text-sm text-ink-600">
              {tp('groupSize', { min: pkg.minGroupSize, max: pkg.maxGroupSize })}
            </p>

            <div className="flex flex-col gap-2">
              <Link
                href={`/packages/${pkg.slug}/book`}
                className="rounded-full bg-brand-600 px-5 py-3 text-center font-medium text-white transition-colors hover:bg-brand-700"
              >
                {t('bookAsIs')}
              </Link>
              <Link
                href={`/packages/${pkg.slug}/customize`}
                className="rounded-full border border-ink-300 px-5 py-3 text-center font-medium text-ink-800 transition-colors hover:bg-ink-100"
              >
                {t('customize')}
              </Link>
              <Link
                href={`/vibe?package=${pkg.slug}`}
                className="rounded-full px-5 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                {t('askAi')}
              </Link>
            </div>

            <p className="text-xs text-ink-500">
              {tc('days', { count: pkg.durationDays })} · {pkg.city.name}, {pkg.city.country}
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}
