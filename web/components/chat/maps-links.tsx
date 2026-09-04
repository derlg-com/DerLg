'use client'

import { ExternalLink, Navigation } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { buttonVariants } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * Google Maps handoff links.
 *
 * Shared by the transcript's map block, the detail blocks and the workspace panel,
 * so the handoff looks and behaves the same wherever a location appears.
 *
 * Both are real anchors (not buttons calling `window.open`), so middle-click,
 * long-press and "copy link" all work, and both announce that they leave the app.
 */

export function GoogleMapsLink({
  href,
  className,
  compact = false,
}: {
  href: string
  className?: string
  /** Icon-only, for tight card footers. */
  compact?: boolean
}) {
  const t = useTranslations('workspace')

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        buttonVariants({ variant: 'secondary', size: 'sm' }),
        compact && 'px-2',
        className,
      )}
      aria-label={compact ? `${t('openInGoogleMaps')} — ${t('opensNewTab')}` : undefined}
    >
      <ExternalLink aria-hidden="true" className="size-3.5" />
      {compact ? null : (
        <>
          {t('openInGoogleMaps')}
          <span className="sr-only"> — {t('opensNewTab')}</span>
        </>
      )}
    </a>
  )
}

export function DirectionsLink({ href, className }: { href: string; className?: string }) {
  const t = useTranslations('workspace')

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), className)}
    >
      <Navigation aria-hidden="true" className="size-3.5" />
      {t('directions')}
      <span className="sr-only"> — {t('opensNewTab')}</span>
    </a>
  )
}
