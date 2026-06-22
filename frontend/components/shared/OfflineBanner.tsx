'use client'

import { useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { useShellStore } from '@/stores/shell.store'
import { useTranslations } from '@/lib/i18n'

export function OfflineBanner() {
  const online = useShellStore((s) => s.online)
  const setOnline = useShellStore((s) => s.setOnline)
  const t = useTranslations('shell')

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    // Initial sync deferred to a microtask so we never setState synchronously in an effect.
    queueMicrotask(() => setOnline(navigator.onLine))
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [setOnline])

  if (online) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-center text-sm text-warning"
    >
      <WifiOff className="h-4 w-4" aria-hidden />
      <span>{t('offline')}</span>
    </div>
  )
}
