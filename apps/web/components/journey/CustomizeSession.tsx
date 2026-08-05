'use client';

import { JourneyEditor } from '@/components/journey/JourneyEditor';
import { useCurrentUser } from '@/hooks/use-auth';
import { useDraft, useJourneySessionId } from '@/hooks/use-journey-draft';
import { useTranslations } from '@/lib/i18n';

/**
 * Resolves which draft to edit, then hands over to the editor. The draft id is
 * remembered per package (localStorage) so returning to this page reopens the
 * same plan; `?draft=` overrides that, which is how the AI handoff (Task 18)
 * drops a generated itinerary into the manual editor.
 */
export function CustomizeSession({
  packageSlug,
  cityForPicker,
  draftIdFromQuery,
}: {
  packageSlug: string;
  cityForPicker: string | null;
  draftIdFromQuery: string | null;
}) {
  const t = useTranslations('customize');
  const { isAuthenticated, isHydrating } = useCurrentUser();

  const session = useJourneySessionId({
    packageSlug,
    draftIdFromQuery,
    enabled: !isHydrating && isAuthenticated,
  });
  const draft = useDraft(session.data ?? null);

  if (isHydrating) {
    return (
      <p className="px-6 py-16 text-ink-500" role="status">
        {t('loading')}
      </p>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(`/packages/${packageSlug}/customize`);
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16 text-center">
        <p className="text-ink-700">{t('signInPrompt')}</p>
        <a
          href={`/login?next=${next}`}
          className="rounded-full bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
        >
          {t('signInPrompt')}
        </a>
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 px-6 py-16 text-center">
        <p role="alert" className="text-red-700">
          {t('createError')}
        </p>
        <button
          type="button"
          onClick={() => void session.refetch()}
          className="self-center rounded-full border border-ink-300 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-100"
        >
          {t('pickerCancel')}
        </button>
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

  return <JourneyEditor draft={draft.data} cityForPicker={cityForPicker} />;
}
