import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/LoginForm';
import { translate } from '@/lib/i18n';

export const metadata: Metadata = {
  title: translate('auth.signInTitle'),
  description: translate('auth.signInBody'),
};

/** Only same-site paths are honoured, so `?next=` cannot become an open redirect. */
function safeRedirect(next: string | string[] | undefined): string {
  const candidate = Array.isArray(next) ? next[0] : next;
  return candidate && candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Reading searchParams here (rather than useSearchParams in a client
  // component) keeps the whole page server-rendered instead of blank until hydration.
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink-900">{translate('auth.signInTitle')}</h1>
        <p className="text-sm text-ink-600">{translate('auth.signInBody')}</p>
      </div>
      <LoginForm redirectTo={safeRedirect(params.next)} />
    </div>
  );
}
