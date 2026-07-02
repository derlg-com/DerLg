import type { Metadata } from 'next'
import { BookingShell } from '@/components/booking/BookingShell'
import { HotelBookingForm } from '@/components/booking/HotelBookingForm'

export const metadata: Metadata = {
  title: 'Book your stay — DerLg',
}

export default async function HotelBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ room?: string }>
}) {
  const { id } = await params
  const { room } = await searchParams
  return (
    <BookingShell>
      <HotelBookingForm hotelId={id} roomId={room ?? null} />
    </BookingShell>
  )
}
