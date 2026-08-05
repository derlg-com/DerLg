'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Button } from '@/components/ui'
import { Link } from '@/lib/i18n/navigation'

/**
 * Route-level error boundary.
 *
 * Shows recovery options rather than a raw stack trace. The underlying error is
 * logged for developers but never rendered, because backend messages can leak
 * internal detail and mean nothing to a traveller mid-booking.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('shell')
  const common = useTranslations('common')

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Route error boundary caught:', error)
    }
    // Production error reporting (Sentry) is wired in Task 23.
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('errorTitle')}</h1>
        <p className="text-[var(--text-secondary)]">{t('errorDesc')}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>{common('tryAgain')}</Button>
        <Link
          href="/"
          className="inline-flex min-h-10 items-center rounded-md border border-[var(--border-default)] px-4 text-sm font-medium hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
        >
          {t('goHome')}
        </Link>
      </div>

      {error.digest ? (
        <p className="font-mono text-xs text-[var(--text-tertiary)]">{error.digest}</p>
      ) : null}
    </div>
  )
}
