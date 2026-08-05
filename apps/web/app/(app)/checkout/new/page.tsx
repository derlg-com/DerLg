import { notFound } from 'next/navigation';

import { StartBooking } from '@/components/bookings/StartBooking';

/**
 * `/checkout/new?draft=<id>` — the step between the journey editor and payment.
 * The journey editor's "Continue to booking" button lands here.
 */
export default async function NewCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const draftId = Array.isArray(params.draft) ? params.draft[0] : params.draft;

  if (!draftId) {
    notFound();
  }

  return <StartBooking draftId={draftId} />;
}
