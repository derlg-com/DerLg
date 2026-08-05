import { CheckoutView } from '@/components/checkout/CheckoutView';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <CheckoutView bookingId={bookingId} />;
}
