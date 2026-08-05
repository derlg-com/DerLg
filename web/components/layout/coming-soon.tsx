import { Construction } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/lib/i18n/navigation'

/**
 * Placeholder for routes whose feature task has not landed yet.
 *
 * Reachable from navigation on purpose: a labelled "coming soon" screen is a
 * better answer than a 404 for a section the user can see in the menu.
 */
export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations('shell')

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <Construction aria-hidden="true" className="size-8 text-[var(--text-tertiary)]" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-[var(--text-secondary)]">{t('comingSoonDesc')}</p>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-10 items-center rounded-md border border-[var(--border-default)] px-4 text-sm font-medium hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
      >
        {t('goHome')}
      </Link>
    </div>
  )
}
