'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'

/**
 * Root route error boundary (Requirements 16.8, 16.9 / Property 39, 40).
 *
 * Catches uncaught errors thrown anywhere in the route tree below the root
 * layout and renders a graceful fallback with navigation options: `reset()`
 * re-renders the failed segment, while "Go home" offers an escape hatch.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')
  const tShell = useTranslations('shell')

  useEffect(() => {
    // Surface the error for monitoring. In production this is the hook point
    // for Sentry (Requirement 16.9); in dev it aids debugging.
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unhandled application error:', error)
    }
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
      <h2 className="text-lg font-semibold text-foreground">{t('error')}</h2>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>{t('tryAgain')}</Button>
        <Button asChild variant="outline">
          <Link href="/">{tShell('goHome')}</Link>
        </Button>
      </div>
    </div>
  )
}
