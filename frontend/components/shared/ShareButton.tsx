'use client'

import { useState } from 'react'
import { Share2, Link2, Mail, MessageCircle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { useTranslations } from '@/lib/i18n'
import { trackEvent } from '@/lib/analytics'

interface ShareButtonProps {
  /** Optional share-sheet title (falls back to the page title). */
  title?: string
  className?: string
  /**
   * When set, render a labeled <Button> (e.g. "Share booking") instead of the
   * default icon-only floating button. Used by the booking confirmation
   * actions; the share behaviour (Web Share API → fallback menu) is identical
   * in both forms.
   */
  label?: string
  /**
   * Optional analytics tag describing what is being shared (e.g. 'trip',
   * 'booking'). Sent as the `entity` prop on the `share` event (task 27.3).
   */
  entity?: string
}

function currentUrl(): string {
  return typeof window === 'undefined' ? '' : window.location.href
}

/** Copy the current URL to the clipboard; returns whether it succeeded. */
async function copyLink(url: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      return false
    }
  }
  return false
}

export function ShareButton({ title, className, label, entity }: ShareButtonProps) {
  const t = useTranslations('trips')
  const ts = useTranslations('share')
  const [fallbackOpen, setFallbackOpen] = useState(false)

  async function onShare() {
    const url = currentUrl()
    // Prefer the native Web Share API when available (mobile / PWA).
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
        trackEvent('share', { method: 'web_share', entity })
      } catch {
        // User dismissed the native sheet — no further action.
      }
      return
    }
    // No Web Share API: open the explicit fallback menu (copy/email/WhatsApp/FB).
    setFallbackOpen(true)
  }

  async function onCopy() {
    const ok = await copyLink(currentUrl())
    if (ok) {
      toast({ title: t('detail.shareCopied'), variant: 'success' })
      trackEvent('share', { method: 'copy', entity })
    }
    setFallbackOpen(false)
  }

  function openExternal(method: 'email' | 'whatsapp' | 'facebook') {
    if (typeof window === 'undefined') return
    const url = currentUrl()
    const shareTitle = title ?? document.title
    const encodedUrl = encodeURIComponent(url)
    const encodedText = encodeURIComponent(shareTitle ? `${shareTitle} ${url}` : url)
    let target = ''
    switch (method) {
      case 'email':
        target = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodedText}`
        break
      case 'whatsapp':
        target = `https://wa.me/?text=${encodedText}`
        break
      case 'facebook':
        target = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        break
    }
    window.open(target, '_blank', 'noopener,noreferrer')
    trackEvent('share', { method, entity })
    setFallbackOpen(false)
  }

  const trigger = label ? (
    <Button type="button" variant="outline" onClick={onShare} className={cn(className)}>
      <Share2 className="mr-1 h-4 w-4" aria-hidden />
      {label}
    </Button>
  ) : (
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

  return (
    <>
      {trigger}
      <Sheet open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <SheetContent side="bottom" title={ts('options.title')}>
          <div className="grid grid-cols-2 gap-2 pb-2 sm:grid-cols-4">
            <ShareOption icon={Link2} label={ts('options.copy')} onClick={onCopy} />
            <ShareOption
              icon={Mail}
              label={ts('options.email')}
              onClick={() => openExternal('email')}
            />
            <ShareOption
              icon={MessageCircle}
              label={ts('options.whatsapp')}
              onClick={() => openExternal('whatsapp')}
            />
            <ShareOption
              icon={ExternalLink}
              label={ts('options.facebook')}
              onClick={() => openExternal('facebook')}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function ShareOption({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Link2
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className="text-xs">{label}</span>
    </button>
  )
}
