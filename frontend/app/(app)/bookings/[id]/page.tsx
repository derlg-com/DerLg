import type { Metadata } from 'next'
import { BookingDetailView } from '@/components/bookings/BookingDetailView'

export const metadata: Metadata = {
  title: 'Booking details — DerLg',
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <BookingDetailView id={id} />
}
