import type { Metadata } from 'next'
import { TripDetailView } from '@/components/trips/TripDetailView'
import { buildEntityMetadata, fetchEntityForMetadata } from '@/lib/og-metadata'
import { StructuredData } from '@/components/shared/StructuredData'
import { buildTripJsonLd, type TripLike } from '@/lib/structured-data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const trip = await fetchEntityForMetadata(`/v1/trips/${id}`)
  return buildEntityMetadata({
    entity: trip,
    path: `/trips/${id}`,
    fallbackTitle: 'Trip details — DerLg',
    fallbackDescription: 'Discover and book curated Cambodia trips on DerLg.',
  })
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Re-fetch for JSON-LD (deduped by Next's fetch cache with the metadata call).
  // Degrades gracefully: builder returns null when data is missing/partial.
  const trip = (await fetchEntityForMetadata(`/v1/trips/${id}`)) as TripLike | null
  const jsonLd = buildTripJsonLd(trip ? { ...trip, id } : null)
  return (
    <>
      <StructuredData data={jsonLd} />
      <TripDetailView id={id} />
    </>
  )
}
