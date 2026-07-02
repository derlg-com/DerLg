'use client'

import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { useTranslations } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

/**
 * PWA install affordance (task 19.4, Requirements 12.6, 12.7).
 *
 * A dismissable bottom banner that appears only when the app is installable and
 * the user hasn't already installed or dismissed it (logic in
 * {@link useInstallPrompt}). It deliberately sits above the bottom navigation
 * and is non-modal so it never blocks the app — keeping it from being "naggy".
 *
 *  - Chromium/Android/desktop: an "Install app" button that triggers the native
 *    prompt captured from `beforeinstallprompt`.
 *  - iOS Safari (no native prompt): manual "Add to Home Screen" instructions.
 */
export function InstallPrompt() {
  const { mode, install, dismiss } = useInstallPrompt()
  const t = useTranslations('install')

  if (mode === 'none') return null

  return (
    <div
      role="dialog"
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-md items-start gap-3 rounded-xl border border-border bg-background p-4 shadow-lg"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Download className="h-5 w-5" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-sora text-sm font-semibold">{t('title')}</p>

        {mode === 'ios' ? (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <span>{t('iosBefore')}</span>
            <Share className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t('iosShare')}</span>
            <SquarePlus className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t('iosAdd')}</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        )}

        {mode === 'prompt' ? (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void install()}>
              {t('install')}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t('notNow')}
            </Button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
