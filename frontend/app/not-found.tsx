'use client'

import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'

/**
 * Root 404 page (Requirement 1.3 / 16.8).
 *
 * Rendered for unmatched top-level routes and for any `notFound()` call that
 * is not caught by a more specific route-group `not-found.tsx`.
 */
export default function NotFound() {
  const t = useTranslations('shell')
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <Compass className="h-12 w-12 text-muted-foreground" aria-hidden />
      <h2 className="text-2xl font-bold text-foreground">404</h2>
      <p className="text-muted-foreground">{t('notFound')}</p>
      <Button asChild>
        <Link href="/">{t('goHome')}</Link>
      </Button>
    </div>
  )
}
