import type { Metadata } from 'next';

import { DraftSession } from '@/components/journey/DraftSession';

export const metadata: Metadata = {
  title: 'Your trip — DerLg',
  robots: { index: false, follow: false },
};

/**
 * Edit a saved plan directly by its id.
 *
 * This is where the concierge hands a traveller over: the itinerary panel links
 * here, and from this point the plan is theirs to reorder, swap and price with
 * the same editor the manual flow uses. Ownership is enforced by the API — a
 * draft belonging to someone else answers 403 and the page says so.
 */
export default async function JourneyPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <DraftSession draftId={draftId} />
    </main>
  );
}
