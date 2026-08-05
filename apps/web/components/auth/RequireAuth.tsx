'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useCurrentUser } from '@/hooks/use-auth';
import { useTranslations } from '@/lib/i18n';

/**
 * Client-side gate for routes that need a session. It waits for hydration to
 * finish before redirecting, otherwise a page reload would bounce a signed-in
 * user to /login before the refresh cookie has been exchanged.
 *
 * This is a UX guard, not a security boundary — the API authorises every request
 * independently.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tc = useTranslations('common');
  const { isAuthenticated, isHydrating } = useCurrentUser();

  useEffect(() => {
    if (!isHydrating && !isAuthenticated) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [isAuthenticated, isHydrating, router]);

  if (isHydrating) {
    return (
      <p className="px-6 py-16 text-ink-500" role="status" aria-live="polite">
        {tc('loading')}
      </p>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
