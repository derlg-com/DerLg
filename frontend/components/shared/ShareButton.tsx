'use client'

import { Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { useTranslations } from '@/lib/i18n'

export function ShareButton({ title, className }: { title?: string; className?: string }) {
  const t = useTranslations('trips')

  async function onShare() {
    if (typeof window === 'undefined') return
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        return // user dismissed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: t('detail.shareCopied'), variant: 'success' })
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label={t('detail.share')}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Share2 className="h-4 w-4" />
    </button>
  )
}
