import { getTranslations } from 'next-intl/server'

import { Link } from '@/lib/i18n/navigation'

/**
 * Localised 404. Reached for unknown paths that still carry a valid locale
 * prefix, e.g. /km/does-not-exist.
 */
export default async function LocaleNotFound() {
  const shell = await getTranslations('shell')

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-sm tracking-widest text-[var(--text-tertiary)]">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">{shell('notFound')}</h1>
      <Link
        href="/"
        className="inline-flex min-h-10 items-center rounded-md border border-[var(--border-default)] px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
      >
        {shell('goHome')}
      </Link>
    </main>
  )
}
