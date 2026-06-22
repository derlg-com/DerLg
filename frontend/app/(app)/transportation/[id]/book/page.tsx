import { BookingShell } from '@/components/booking/BookingShell'
import { TransportBookingForm } from '@/components/booking/TransportBookingForm'

export default async function TransportBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <BookingShell>
      <TransportBookingForm vehicleId={id} />
    </BookingShell>
  )
}
