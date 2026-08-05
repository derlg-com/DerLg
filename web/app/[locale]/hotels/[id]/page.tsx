import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { RoomSelector } from '@/components/hotels/room-selector'
import { Gallery } from '@/components/shared/gallery'
import { Price } from '@/components/shared/price'
import { ShareButton } from '@/components/shared/share-button'
import { Badge, Card } from '@/components/ui'
import { ApiError } from '@/lib/api/errors'
import { hotelsApi } from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'
import { Link } from '@/lib/i18n/navigation'
import { JsonLd, absoluteUrl, breadcrumbSchema } from '@/lib/seo'

export const revalidate = 300

async function loadHotel(id: string, locale: Locale) {
  try {
    return await hotelsApi.detail(id, { locale })
  } catch (error) {
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
  const hotel = await loadHotel(id, typed)

  if (!hotel) {
    const t = await getTranslations({ locale, namespace: 'catalog' })
    return { title: t('detail.notFoundTitle'), robots: { index: false, follow: false } }
  }

  return {
    title: hotel.name,
    description: hotel.description ?? undefined,
    alternates: { canonical: absoluteUrl(`/hotels/${hotel.id}`, typed) },
    openGraph: {
      title: hotel.name,
      description: hotel.description ?? undefined,
      url: absoluteUrl(`/hotels/${hotel.id}`, typed),
      images: hotel.images?.[0] ? [hotel.images[0]] : undefined,
    },
  }
}

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale as Locale)
  const typed = locale as Locale

  const hotel = await loadHotel(id, typed)
  if (!hotel) notFound()

  const t = await getTranslations('hotels')
  const catalog = await getTranslations('catalog')
  const shell = await getTranslations('shell')

  // Detail returns `images`; the list returns `coverImage`. Accept either.
  const gallery = [...(hotel.images ?? []), ...(hotel.coverImage ? [hotel.coverImage] : [])].filter(
    (image, index, all) => all.indexOf(image) === index,
  )

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Hotel',
          name: hotel.name,
          url: absoluteUrl(`/hotels/${hotel.id}`, typed),
          ...(hotel.address ? { address: hotel.address } : {}),
          ...(typeof hotel.starRating === 'number'
            ? { starRating: { '@type': 'Rating', ratingValue: hotel.starRating } }
            : {}),
          ...(hotel.latitude != null && hotel.longitude != null
            ? {
                geo: {
                  '@type': 'GeoCoordinates',
                  latitude: hotel.latitude,
                  longitude: hotel.longitude,
                },
              }
            : {}),
        }}
      />
      <JsonLd
        data={breadcrumbSchema(
          [
            { name: shell('nav.home'), path: '/' },
            { name: shell('nav.hotels'), path: '/hotels' },
            { name: hotel.name, path: `/hotels/${hotel.id}` },
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
              <Link href="/hotels" className="hover:text-[var(--text-primary)]">
                {shell('nav.hotels')}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-[var(--text-primary)]">
              {hotel.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-8">
            <header className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{hotel.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {typeof hotel.starRating === 'number' ? (
                  <span
                    className="text-[var(--color-warning-600)]"
                    aria-label={catalog('filters.starsValue', { count: hotel.starRating })}
                  >
                    {'★'.repeat(hotel.starRating)}
                  </span>
                ) : null}
                {hotel.address ? (
                  <span className="text-[var(--text-secondary)]">{hotel.address}</span>
                ) : null}
              </div>
            </header>

            <Gallery images={gallery} label={catalog('detail.gallery')} />

            {hotel.description ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  {catalog('detail.overview')}
                </h2>
                <p className="whitespace-pre-line text-[var(--text-secondary)]">
                  {hotel.description}
                </p>
              </section>
            ) : null}

            {hotel.amenities && hotel.amenities.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  {catalog('detail.amenities')}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {hotel.amenities.map((amenity) => (
                    <li key={amenity}>
                      <Badge tone="neutral">{amenity}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <RoomSelector hotelId={hotel.id} />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="space-y-4 p-5">
              {typeof hotel.priceFromUsd === 'number' ? (
                <div>
                  <p className="text-sm text-[var(--text-tertiary)]">{t('card.from')}</p>
                  <p className="text-2xl font-semibold">
                    <Price amountUsd={hotel.priceFromUsd} />
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">{t('card.perNight')}</p>
                </div>
              ) : null}

              <Link
                href={`/chat?context=${encodeURIComponent(hotel.name)}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--border-default)] px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)]"
              >
                {catalog('detail.askConcierge')}
              </Link>

              <ShareButton title={hotel.name} />
            </Card>
          </aside>
        </div>
      </div>
    </>
  )
}
