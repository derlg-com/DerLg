import type { Metadata } from 'next'
import { ConfirmationView } from '@/components/checkout/ConfirmationView'

export const metadata: Metadata = {
  title: 'Booking confirmed — DerLg',
}

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  return <ConfirmationView bookingId={bookingId} />
}
