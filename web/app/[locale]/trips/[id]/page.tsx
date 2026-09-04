import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Gallery } from '@/components/shared/gallery'
import { Price } from '@/components/shared/price'
import { Rating } from '@/components/shared/rating'
import { ShareButton } from '@/components/shared/share-button'
import { TripCard } from '@/components/shared/catalog-cards'
import { Badge, Card } from '@/components/ui'
import { ApiError } from '@/lib/api/errors'
import { tripsApi } from '@/lib/api/resources'
import { localeTags, type Locale } from '@/lib/i18n/config'
import { Link } from '@/lib/i18n/navigation'
import { JsonLd, absoluteUrl, breadcrumbSchema, tripSchema } from '@/lib/seo'

export const revalidate = 300

async function loadTrip(id: string, locale: Locale) {
  try {
    return await tripsApi.detail(id, { locale })
  } catch (error) {
    // A missing trip is a 404, not a crash; anything else should surface as an error.
    if (error instanceof ApiError && error.isNotFound) return null
    throw error
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale, id } = await params
  const typed = locale as Locale
  const trip = await loadTrip(id, typed)

  if (!trip) {
    const t = await getTranslations({ locale, namespace: 'catalog' })
    return { title: t('detail.notFoundTitle'), robots: { index: false, follow: false } }
  }

  return {
    title: trip.name,
    description: trip.description ?? undefined,
    alternates: {
      canonical: absoluteUrl(`/trips/${trip.id}`, typed),
      languages: {
        en: absoluteUrl(`/trips/${trip.id}`, 'en'),
        zh: absoluteUrl(`/trips/${trip.id}`, 'zh'),
        km: absoluteUrl(`/trips/${trip.id}`, 'km'),
      },
    },
    openGraph: {
      title: trip.name,
      description: trip.description ?? undefined,
      url: absoluteUrl(`/trips/${trip.id}`, typed),
      images: trip.coverImageUrl ? [trip.coverImageUrl] : undefined,
      type: 'website',
    },
  }
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale as Locale)
  const typed = locale as Locale

  const trip = await loadTrip(id, typed)
  if (!trip) notFound()

  const t = await getTranslations('trips')
  const catalog = await getTranslations('catalog')
  const shell = await getTranslations('shell')

  // Related trips are a nice-to-have; a failure there must not break the page.
  const related = await tripsApi.related(id, { locale: typed }).catch(() => [])

  const gallery = [
    ...(trip.coverImageUrl ? [trip.coverImageUrl] : []),
    ...(trip.galleryImageUrls ?? []),
  ].filter((image, index, all) => all.indexOf(image) === index)

  return (
    <>
      <JsonLd data={tripSchema(trip, typed)} />
      <JsonLd
        data={breadcrumbSchema(
          [
            { name: shell('nav.home'), path: '/' },
            { name: shell('nav.trips'), path: '/trips' },
            { name: trip.name, path: `/trips/${trip.id}` },
          ],
          typed,
        )}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <ol className="flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
            <li>
              <Link href="/" className="hover:text-[var(--text-primary)]">
                {shell('nav.home')}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/trips" className="hover:text-[var(--text-primary)]">
                {shell('nav.trips')}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-[var(--text-primary)]">
              {trip.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-8">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {trip.category ? <Badge tone="accent">{trip.category}</Badge> : null}
                {trip.location ? <Badge tone="neutral">{trip.location}</Badge> : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{trip.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                <span>
                  {trip.durationDays} {t('card.days')}
                </span>
                <Rating
                  average={trip.ratingAverage}
                  count={trip.ratingCount}
                  locale={localeTags[typed]}
                />
              </div>
            </header>

            <Gallery images={gallery} label={catalog('detail.gallery')} />

            {trip.description ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  {catalog('detail.overview')}
                </h2>
                <p className="whitespace-pre-line text-[var(--text-secondary)]">
                  {trip.description}
                </p>
              </section>
            ) : null}

            {trip.itineraryDays && trip.itineraryDays.length > 0 ? (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">{t('detail.itinerary')}</h2>
                <ol className="space-y-4">
                  {trip.itineraryDays.map((day) => (
                    <li key={day.dayNumber} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent-subtle)] font-mono text-sm font-semibold text-[var(--accent-subtle-text)]"
                      >
                        {day.dayNumber}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <h3 className="font-medium">
                          <span className="sr-only">
                            {catalog('detail.day', { number: day.dayNumber })}:{' '}
                          </span>
                          {day.title}
                        </h3>
                        {day.description ? (
                          <p className="text-sm text-[var(--text-secondary)]">{day.description}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {trip.includedItems && trip.includedItems.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">{t('detail.included')}</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {trip.includedItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <span aria-hidden="true" className="mt-1 text-[var(--color-success-600)]">
                        ✓
                      </span>
                      <span className="text-[var(--text-secondary)]">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* Booking panel: sticky on desktop so the price and CTA stay in view. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="space-y-4 p-5">
              <div>
                <p className="text-2xl font-semibold">
                  <Price amountUsd={trip.priceUsd} />
                </p>
                <p className="text-sm text-[var(--text-tertiary)]">{t('card.perPerson')}</p>
              </div>

              <div className="space-y-2">
                <Link
                  href={`/booking/new?type=trip&id=${trip.id}`}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)]"
                >
                  {catalog('detail.bookNow')}
                </Link>
                <Link
                  href={`/chat?context=${encodeURIComponent(trip.name)}`}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--border-default)] px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)]"
                >
                  {catalog('detail.askConcierge')}
                </Link>
              </div>

              <ShareButton title={trip.name} />
            </Card>
          </aside>
        </div>

        {related.length > 0 ? (
          <section className="mt-12 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">{catalog('detail.related')}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <TripCard trip={item} locale={typed} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  )
}
