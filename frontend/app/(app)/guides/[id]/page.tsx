import type { Metadata } from 'next'
import { GuideDetailView } from '@/components/guides/GuideDetailView'
import { buildEntityMetadata, fetchEntityForMetadata } from '@/lib/og-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const guide = await fetchEntityForMetadata(`/v1/guides/${id}`)
  return buildEntityMetadata({
    entity: guide,
    path: `/guides/${id}`,
    fallbackTitle: 'Guide details — DerLg',
    fallbackDescription: 'Book trusted local tour guides for Cambodia on DerLg.',
  })
}

export default async function GuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GuideDetailView id={id} />
}
