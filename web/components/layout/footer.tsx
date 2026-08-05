import { getTranslations } from 'next-intl/server'

import { Link } from '@/lib/i18n/navigation'

const EXPLORE_LINKS = [
  { href: '/trips', key: 'nav.trips' },
  { href: '/hotels', key: 'nav.hotels' },
  { href: '/guides', key: 'nav.guides' },
  { href: '/transport', key: 'nav.transport' },
] as const

const SUPPORT_LINKS = [
  { href: '/safety', key: 'nav.safety' },
  { href: '/bookings', key: 'nav.bookings' },
] as const

export async function Footer() {
  const t = await getTranslations('shell')

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid size-7 place-items-center rounded-md bg-[var(--accent)] font-mono text-xs font-bold text-[var(--accent-text)]"
              >
                D
              </span>
              <span className="font-semibold tracking-tight">{t('brand')}</span>
            </div>
            <p className="max-w-xs text-sm text-[var(--text-secondary)]">{t('footer.rights', { year: new Date().getFullYear() })}</p>
          </div>

          <nav aria-label={t('footer.explore')}>
            <h2 className="mb-3 text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
              {t('footer.explore')}
            </h2>
            <ul className="space-y-2">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t('footer.support')}>
            <h2 className="mb-3 text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
              {t('footer.support')}
            </h2>
            <ul className="space-y-2">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}
