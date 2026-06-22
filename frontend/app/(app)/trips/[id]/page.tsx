import type { Metadata } from 'next'
import { TripDetailView } from '@/components/trips/TripDetailView'

export const metadata: Metadata = {
  title: 'Trip details — DerLg',
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TripDetailView id={id} />
}
