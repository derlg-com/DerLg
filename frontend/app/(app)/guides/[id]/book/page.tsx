import type { Metadata } from 'next'
import { BookingShell } from '@/components/booking/BookingShell'
import { GuideBookingForm } from '@/components/booking/GuideBookingForm'

export const metadata: Metadata = {
  title: 'Book a guide — DerLg',
}

export default async function GuideBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <BookingShell>
      <GuideBookingForm guideId={id} />
    </BookingShell>
  )
}
