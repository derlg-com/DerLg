import { BookingShell } from '@/components/booking/BookingShell'
import { GuideBookingForm } from '@/components/booking/GuideBookingForm'

export default async function GuideBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <BookingShell>
      <GuideBookingForm guideId={id} />
    </BookingShell>
  )
}
