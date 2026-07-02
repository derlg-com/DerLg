import { absoluteUrl } from '@/lib/site-url'

/**
 * JSON-LD structured-data builders (Task 30.2 — Section 30 SEO).
 *
 * These produce plain schema.org objects to be injected via a
 * `<script type="application/ld+json">` tag (see `StructuredData` component).
 * Every builder is tolerant of partial/missing data and returns `null` when
 * there is nothing meaningful to emit, so detail pages degrade gracefully and
 * never render an empty/invalid graph.
 */

/** Loose entity shapes — we read only the fields we need, all optional. */
export interface TripLike {
  id?: string
  name?: string
  title?: string
  description?: string
  summary?: string
  price?: number
  priceFrom?: number
  currency?: string
  coverImageUrl?: string
  imageUrl?: string
  images?: string[]
  rating?: number
  averageRating?: number
  reviewCount?: number
  durationDays?: number
}

export interface HotelLike {
  id?: string
  name?: string
  title?: string
  description?: string
  summary?: string
  coverImageUrl?: string
  imageUrl?: string
  images?: string[]
  rating?: number
  averageRating?: number
  reviewCount?: number
  address?: string
  city?: string
  priceFrom?: number
  currency?: string
}

export interface ReviewLike {
  id?: string
  rating?: number
  text?: string
  title?: string
  authorName?: string
  userName?: string
  createdAt?: string
}

type JsonLd = Record<string, unknown>

function firstImage(e: {
  coverImageUrl?: string
  imageUrl?: string
  images?: string[]
}): string | undefined {
  const raw = e.coverImageUrl ?? e.imageUrl ?? e.images?.[0]
  return raw ? absoluteUrl(raw) : undefined
}

function pickRating(e: { rating?: number; averageRating?: number }): number | undefined {
  const r = e.averageRating ?? e.rating
  return typeof r === 'number' && r > 0 ? r : undefined
}

/** Build an `AggregateRating` node, or `null` when there is no usable rating. */
export function buildAggregateRating(e: {
  rating?: number
  averageRating?: number
  reviewCount?: number
}): JsonLd | null {
  const ratingValue = pickRating(e)
  if (ratingValue === undefined) return null
  const node: JsonLd = {
    '@type': 'AggregateRating',
    ratingValue,
    bestRating: 5,
  }
  if (typeof e.reviewCount === 'number' && e.reviewCount > 0) {
    node.reviewCount = e.reviewCount
  }
  return node
}

/** Build a single `Review` node, or `null` when there is no rating/text. */
export function buildReview(review: ReviewLike): JsonLd | null {
  const rating = typeof review.rating === 'number' && review.rating > 0 ? review.rating : undefined
  if (rating === undefined) return null
  const node: JsonLd = {
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: rating, bestRating: 5 },
  }
  const author = review.authorName ?? review.userName
  if (author) node.author = { '@type': 'Person', name: author }
  if (review.text) node.reviewBody = review.text
  if (review.title) node.name = review.title
  if (review.createdAt) node.datePublished = review.createdAt
  return node
}

/**
 * Build a `TouristTrip` graph for a trip detail page (Task 30.2). Includes
 * `offers` when a price is known and `aggregateRating` when a rating exists.
 * Returns `null` when there is no name to anchor the graph.
 */
export function buildTripJsonLd(trip: TripLike | null): JsonLd | null {
  if (!trip) return null
  const name = trip.name ?? trip.title
  if (!name) return null

  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name,
  }
  const description = trip.description ?? trip.summary
  if (description) node.description = description
  if (trip.id) node.url = absoluteUrl(`/trips/${trip.id}`)
  const image = firstImage(trip)
  if (image) node.image = image

  const price = trip.price ?? trip.priceFrom
  if (typeof price === 'number' && price > 0) {
    node.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: trip.currency ?? 'USD',
      availability: 'https://schema.org/InStock',
    }
  }

  const aggregateRating = buildAggregateRating(trip)
  if (aggregateRating) node.aggregateRating = aggregateRating

  return node
}

/**
 * Build a `Hotel` graph for a hotel detail page (Task 30.2). Includes address,
 * price range, and aggregate rating when available. Returns `null` when there
 * is no name.
 */
export function buildHotelJsonLd(hotel: HotelLike | null): JsonLd | null {
  if (!hotel) return null
  const name = hotel.name ?? hotel.title
  if (!name) return null

  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name,
  }
  const description = hotel.description ?? hotel.summary
  if (description) node.description = description
  if (hotel.id) node.url = absoluteUrl(`/hotels/${hotel.id}`)
  const image = firstImage(hotel)
  if (image) node.image = image

  if (hotel.address || hotel.city) {
    node.address = {
      '@type': 'PostalAddress',
      ...(hotel.address ? { streetAddress: hotel.address } : {}),
      ...(hotel.city ? { addressLocality: hotel.city } : {}),
      addressCountry: 'KH',
    }
  }
  if (typeof hotel.priceFrom === 'number' && hotel.priceFrom > 0) {
    node.priceRange = `${hotel.currency ?? 'USD'} ${hotel.priceFrom}+`
  }

  const aggregateRating = buildAggregateRating(hotel)
  if (aggregateRating) node.aggregateRating = aggregateRating

  return node
}

/**
 * Attach `Review` nodes to an already-built entity graph. Returns the graph
 * unchanged when there are no valid reviews. Pure — does not mutate input.
 */
export function withReviews(
  graph: JsonLd | null,
  reviews: ReviewLike[] | undefined,
): JsonLd | null {
  if (!graph || !reviews || reviews.length === 0) return graph
  const built = reviews.map(buildReview).filter((r): r is JsonLd => r !== null)
  if (built.length === 0) return graph
  return { ...graph, review: built }
}
