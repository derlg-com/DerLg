import { CheckoutView } from '@/components/checkout/CheckoutView'
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments'

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ method?: string }>
}) {
  const { bookingId } = await params
  const { method } = await searchParams
  const resolved: PaymentMethod = PAYMENT_METHODS.includes(method as PaymentMethod)
    ? (method as PaymentMethod)
    : 'card'
  return <CheckoutView bookingId={bookingId} method={resolved} />
}
