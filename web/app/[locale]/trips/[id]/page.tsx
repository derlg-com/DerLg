import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { NavelDetailView } from '@/components/destination/navel-detail-view'
import { ApiError } from '@/lib/api/errors'
import { tripsApi } from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'
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
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-2">
        <nav aria-label="Breadcrumb" className="text-sm">
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
            <li aria-current="page" className="truncate text-[var(--text-primary)] font-medium">
              {trip.name}
            </li>
          </ol>
        </nav>
      </div>

      <NavelDetailView
        trip={trip}
        relatedTrips={related}
        bookNowLabel={catalog('detail.bookNow')}
        askAiLabel={catalog('detail.askConcierge')}
        perPersonLabel={t('card.perPerson')}
        overviewLabel={catalog('detail.overview')}
        itineraryLabel={t('detail.itinerary')}
        includedLabel={t('detail.included')}
      />
    </>
  )
}
