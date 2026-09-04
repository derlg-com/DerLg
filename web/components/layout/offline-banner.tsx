'use client'

import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useOnlineStatus } from '@/hooks/use-online-status'

/**
 * Offline hint.
 *
 * Rendered as an assertive live region: losing connectivity mid-booking changes
 * what the user can do, so it should interrupt rather than wait politely.
 */
export function OfflineBanner() {
  const t = useTranslations('shell')
  const online = useOnlineStatus()

  return (
    <div role="status" aria-live="assertive" aria-atomic="true">
      {online ? null : (
        <div className="flex items-center justify-center gap-2 bg-[var(--tone-warning-bg)] px-4 py-2 text-sm text-[var(--tone-warning-text)]">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          <span>{t('offline')}</span>
        </div>
      )}
    </div>
  )
}
