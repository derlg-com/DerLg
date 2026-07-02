'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useTranslations } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

/**
 * Content of the custom offline fallback page (task 19.3, Requirement 12.8).
 *
 * Shown by the service worker when the user navigates to an uncached route
 * while offline. It is intentionally self-contained (no data fetching) so it
 * renders entirely from the precache. When connectivity returns, the "retry"
 * affordance lets the user reload the route they were heading to.
 */
export function OfflineFallback() {
  const online = useOnlineStatus()
  const t = useTranslations('offlinePage')

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-warning">
        <WifiOff className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="font-sora text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t('description')}</p>
      {online ? <p className="text-sm font-medium text-success">{t('backOnline')}</p> : null}
      <Button
        onClick={() => {
          // Reload the route the user was trying to reach; when back online the
          // network-first strategy will serve the live page.
          if (typeof window !== 'undefined') window.location.reload()
        }}
      >
        {t('retry')}
      </Button>
    </div>
  )
}
