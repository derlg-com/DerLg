import { BookingShell } from '@/components/booking/BookingShell'
import { TripBookingForm } from '@/components/booking/TripBookingForm'

export default async function TripBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <BookingShell>
      <TripBookingForm tripId={id} />
    </BookingShell>
  )
}
