'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useTranslations } from '@/lib/i18n'

/**
 * Connectivity indicator (task 9.4, Requirement 11.9).
 *
 * Renders a banner whenever the browser reports it is offline. Connectivity is
 * tracked by {@link useOnlineStatus}, which also mirrors the value into the
 * shared shell store so other surfaces can degrade gracefully.
 *
 * Accessibility: the `aria-live="assertive"` region is rendered **persistently**
 * (it stays mounted whether online or offline) so assistive technologies have a
 * stable live region to announce into. If the banner were instead conditionally
 * mounted, screen readers could miss the transition because the live region
 * would not exist at the moment its content first appears. When online the
 * region simply has no visible content.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const t = useTranslations('shell')

  return (
    <div role="status" aria-live="assertive" aria-atomic="true">
      {online ? null : (
        <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-center text-sm text-warning">
          <WifiOff className="h-4 w-4" aria-hidden />
          <span>{t('offline')}</span>
        </div>
      )}
    </div>
  )
}
