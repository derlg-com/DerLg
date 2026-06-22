import type { Metadata } from 'next'
import { HotelDetailView } from '@/components/hotels/HotelDetailView'

export const metadata: Metadata = {
  title: 'Hotel details — DerLg',
}

export default async function HotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <HotelDetailView id={id} />
}
