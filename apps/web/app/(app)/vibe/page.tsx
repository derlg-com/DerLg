import type { Metadata } from 'next';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { VibeSession } from '@/components/vibe/VibeSession';

export const metadata: Metadata = {
  title: 'Vibe Booking — DerLg',
  description:
    'Plan and book a Cambodia trip by chatting with the DerLg concierge. Real hotels, real guides, real prices.',
  robots: { index: false, follow: false },
};

/**
 * Accepts an opening line from elsewhere in the app:
 *   /vibe?package=angkor-essentials-3-day  — "tell me about this trip"
 *   /vibe?draft=<id>                       — carry a plan in from the editor
 *   /vibe?q=...                            — a typed question from the hero
 */
export default async function VibePage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string; draft?: string; q?: string }>;
}) {
  const params = await searchParams;
  const opener = openingMessage(params);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-stone-900">Plan with the concierge</h1>
        <p className="mt-1 text-sm text-stone-600">
          Tell it what you want. It only suggests places, hotels, transport and guides that really
          exist, at the prices we actually charge.
        </p>
      </header>

      <RequireAuth>
        <VibeSession initialMessage={opener} />
      </RequireAuth>
    </main>
  );
}

function openingMessage(params: {
  package?: string;
  draft?: string;
  q?: string;
}): string | undefined {
  if (params.q) {
    return params.q.slice(0, 2000);
  }
  if (params.package) {
    return `Tell me about the ${params.package.replace(/-/g, ' ')} trip, and whether it suits me.`;
  }
  if (params.draft) {
    // The concierge reads it with get_journey_draft; the id is mentioned so it
    // knows which plan, and the tool checks ownership before returning anything.
    return `I have a trip already saved. Please look at my plan ${params.draft} and tell me what you think.`;
  }
  return undefined;
}
