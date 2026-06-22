import { PaymentMethodView } from '@/components/checkout/PaymentMethodView'

export default async function PaymentMethodPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  return <PaymentMethodView bookingId={bookingId} />
}
