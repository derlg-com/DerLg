'use client'

import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Button } from '@/components/ui'

/**
 * Copies the current page URL.
 *
 * Uses the Web Share sheet on devices that offer it (where users expect the
 * native share tray) and falls back to the clipboard elsewhere.
 */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations('catalog')
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function onShare() {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // The user dismissed the share sheet; fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied; there is nothing useful to show here.
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => void onShare()}>
      {copied ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      {copied ? t('detail.shareCopied') : t('detail.share')}
    </Button>
  )
}
