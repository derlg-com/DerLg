import { ConfirmationView } from '@/components/checkout/ConfirmationView'

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  return <ConfirmationView bookingId={bookingId} />
}
