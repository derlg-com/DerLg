'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { useCurrentUser, useLogout } from '@/hooks/use-auth';
import { useTranslations } from '@/lib/i18n';

export function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const { user, isHydrating } = useCurrentUser();
  const logout = useLogout();

  return (
    <header className="border-b border-ink-200 bg-white">
      <nav
        aria-label={t('home')}
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4"
      >
        <Link href="/" className="text-lg font-semibold tracking-tight text-brand-700">
          {tc('appName')}
        </Link>

        <div className="flex items-center gap-1 text-sm">
          <Link href="/packages" className="rounded-full px-3 py-2 text-ink-700 hover:bg-ink-100">
            {t('packages')}
          </Link>
          <Link href="/vibe" className="rounded-full px-3 py-2 text-ink-700 hover:bg-ink-100">
            {t('vibe')}
          </Link>

          {isHydrating ? (
            <span className="px-3 py-2 text-ink-400" aria-hidden="true">
              …
            </span>
          ) : user ? (
            <>
              <Link
                href="/bookings"
                className="rounded-full px-3 py-2 text-ink-700 hover:bg-ink-100"
              >
                {t('bookings')}
              </Link>
              <span className="hidden px-2 text-ink-500 sm:inline" data-testid="current-user">
                {user.fullName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                {t('signOut')}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3 py-2 text-ink-700 hover:bg-ink-100">
                {t('signIn')}
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
              >
                {t('signUp')}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
