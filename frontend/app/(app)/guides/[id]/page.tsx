import type { Metadata } from 'next'
import { GuideDetailView } from '@/components/guides/GuideDetailView'

export const metadata: Metadata = {
  title: 'Guide details — DerLg',
}

export default async function GuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GuideDetailView id={id} />
}
