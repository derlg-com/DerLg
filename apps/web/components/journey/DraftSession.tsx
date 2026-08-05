'use client';

import Link from 'next/link';

import { JourneyEditor } from '@/components/journey/JourneyEditor';
import { useCurrentUser } from '@/hooks/use-auth';
import { useDraft } from '@/hooks/use-journey-draft';
import { useTranslations } from '@/lib/i18n';

/**
 * Opens the editor on a draft that already exists, identified only by its id.
 *
 * This is the receiving end of the AI handoff. `CustomizeSession` cannot serve
 * it: that one resolves-or-creates a draft from a package slug and remembers it
 * in localStorage, which makes no sense for a plan the concierge composed from
 * scratch — there may be no package behind it at all.
 */
export function DraftSession({ draftId }: { draftId: string }) {
  const t = useTranslations('customize');
  const { isAuthenticated, isHydrating } = useCurrentUser();
  const draft = useDraft(isHydrating || !isAuthenticated ? null : draftId);

  if (isHydrating) {
    return (
      <p className="px-6 py-16 text-ink-500" role="status">
        {t('loading')}
      </p>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(`/journeys/${draftId}`);
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16 text-center">
        <p className="text-ink-700">{t('signInPrompt')}</p>
        <Link
          href={`/login?next=${next}`}
          className="rounded-full bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
        >
          {t('signInPrompt')}
        </Link>
      </div>
    );
  }

  if (draft.isError) {
    // A draft belonging to someone else, or one that has been deleted.
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 px-6 py-16 text-center">
        <p role="alert" className="text-red-700">
          {t('draftNotFound')}
        </p>
        <Link
          href="/packages"
          className="self-center rounded-full border border-ink-300 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-100"
        >
          {t('browseTrips')}
        </Link>
      </div>
    );
  }

  if (!draft.data) {
    return (
      <p className="px-6 py-16 text-ink-500" role="status">
        {t('loading')}
      </p>
    );
  }

  return (
    <>
      {draft.data.source === 'AI' ? (
        <p className="mx-auto mb-4 max-w-6xl rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('fromConcierge')}{' '}
          <Link href="/vibe" className="font-medium underline">
            {t('backToConcierge')}
          </Link>
        </p>
      ) : null}
      {/* No city filter: an AI plan has no package behind it, so the picker
          offers the whole catalogue rather than guessing a city. */}
      <JourneyEditor draft={draft.data} cityForPicker={null} />
    </>
  );
}
