import type { Metadata } from 'next'
import { PaymentMethodView } from '@/components/checkout/PaymentMethodView'

export const metadata: Metadata = {
  title: 'Choose payment method — DerLg',
}

export default async function PaymentMethodPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  return <PaymentMethodView bookingId={bookingId} />
}
