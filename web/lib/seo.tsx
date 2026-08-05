import type { Locale } from '@/lib/i18n/config'
import { localeTags } from '@/lib/i18n/config'
import type { TripDetail, TripSummary } from '@/schemas/domain'

/**
 * JSON-LD structured data.
 *
 * Emitted as a script tag with type `application/ld+json`, which is data rather
 * than executable code — search engines read it to build rich results. Values are
 * serialised with JSON.stringify so no user content can break out of the block.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002'

export function absoluteUrl(path: string, locale: Locale): string {
  return `${SITE_URL.replace(/\/$/, '')}/${locale}${path.startsWith('/') ? path : `/${path}`}`
}

/** Escapes the closing script sequence, the only way JSON-LD can break out. */
function serialise(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Structured data, not executable script. Serialised and escaped above.
      dangerouslySetInnerHTML={{ __html: serialise(data) }}
    />
  )
}

export function organisationSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DerLg',
    url: absoluteUrl('/', locale),
    description:
      'Cambodia travel booking with an AI concierge. Trips, hotels, transport and verified guides.',
    areaServed: { '@type': 'Country', name: 'Cambodia' },
    availableLanguage: Object.values(localeTags),
  }
}

export function websiteSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DerLg',
    url: absoluteUrl('/', locale),
    inLanguage: localeTags[locale],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/search', locale)}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** Product schema for a trip, so prices and ratings can appear in results. */
export function tripSchema(trip: TripSummary | TripDetail, locale: Locale) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: trip.name,
    url: absoluteUrl(`/trips/${trip.id}`, locale),
    inLanguage: localeTags[locale],
    offers: {
      '@type': 'Offer',
      price: trip.priceUsd,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(`/trips/${trip.id}`, locale),
    },
  }

  if (trip.coverImageUrl) schema.image = trip.coverImageUrl
  if ('description' in trip && trip.description) schema.description = trip.description

  // Only claim a rating when one genuinely exists; a fabricated aggregateRating
  // is both misleading to users and a structured-data policy violation.
  if (typeof trip.ratingAverage === 'number' && (trip.ratingCount ?? 0) > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: trip.ratingAverage,
      reviewCount: trip.ratingCount,
    }
  }

  return schema
}

export function itemListSchema(
  items: { id: string; name: string }[],
  pathPrefix: string,
  locale: Locale,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(`${pathPrefix}/${item.id}`, locale),
    })),
  }
}

export function breadcrumbSchema(
  trail: { name: string; path: string }[],
  locale: Locale,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: absoluteUrl(entry.path, locale),
    })),
  }
}
