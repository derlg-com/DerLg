import type { Metadata } from 'next'
import { FestivalDetailView } from '@/components/festivals/FestivalDetailView'
import { buildEntityMetadata, fetchEntityForMetadata } from '@/lib/og-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const festival = await fetchEntityForMetadata(`/v1/festivals/${id}`)
  return buildEntityMetadata({
    entity: festival,
    path: `/festivals/${id}`,
    fallbackTitle: 'Festival details — DerLg',
    fallbackDescription: 'Discover Cambodia festivals and plan your visit on DerLg.',
  })
}

export default async function FestivalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FestivalDetailView id={id} />
}
