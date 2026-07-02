import type { Metadata } from 'next'
import { HotelDetailView } from '@/components/hotels/HotelDetailView'
import { buildEntityMetadata, fetchEntityForMetadata } from '@/lib/og-metadata'
import { StructuredData } from '@/components/shared/StructuredData'
import { buildHotelJsonLd, type HotelLike } from '@/lib/structured-data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const hotel = await fetchEntityForMetadata(`/v1/hotels/${id}`)
  return buildEntityMetadata({
    entity: hotel,
    path: `/hotels/${id}`,
    fallbackTitle: 'Hotel details — DerLg',
    fallbackDescription: 'Find and book hotels for your Cambodia trip on DerLg.',
  })
}

export default async function HotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Re-fetch for JSON-LD (deduped by Next's fetch cache with the metadata call).
  const hotel = (await fetchEntityForMetadata(`/v1/hotels/${id}`)) as HotelLike | null
  const jsonLd = buildHotelJsonLd(hotel ? { ...hotel, id } : null)
  return (
    <>
      <StructuredData data={jsonLd} />
      <HotelDetailView id={id} />
    </>
  )
}
