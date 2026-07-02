import type { Metadata } from 'next'
import { BookingShell } from '@/components/booking/BookingShell'
import { TripBookingForm } from '@/components/booking/TripBookingForm'

export const metadata: Metadata = {
  title: 'Book your trip — DerLg',
}

export default async function TripBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <BookingShell>
      <TripBookingForm tripId={id} />
    </BookingShell>
  )
}
