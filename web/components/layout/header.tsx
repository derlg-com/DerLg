'use client'

import { Menu, Search, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { AuthMenu } from '@/components/auth/auth-menu'
import { CommandPalette, useCommandPalette } from '@/components/layout/command-palette'
import { CurrencySwitcher } from '@/components/layout/currency-switcher'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button, Sheet } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Link, usePathname } from '@/lib/i18n/navigation'

/** Desktop navigation targets. The mobile bottom bar uses its own five. */
const NAV_ITEMS = [
  { href: '/trips', key: 'nav.trips' },
  { href: '/hotels', key: 'nav.hotels' },
  { href: '/guides', key: 'nav.guides' },
  { href: '/transport', key: 'nav.transport' },
  { href: '/explore', key: 'nav.explore' },
] as const

export function Header() {
  const t = useTranslations('shell')
  const pathname = usePathname()
  const { open, setOpen } = useCommandPalette()
  const [menuOpen, setMenuOpen] = React.useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--canvas)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={t('brand')}>
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-md bg-[var(--accent)] font-mono text-sm font-bold text-[var(--accent-text)]"
          >
            D
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            {t('brand')}
          </span>
        </Link>

        <nav aria-label={t('navLandmark')} className="hidden min-w-0 flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
                    isActive(item.href)
                      ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">
          {/* Search opens the palette. Keyboard users get the same via Cmd/Ctrl+K.
              The visible label collapses on small screens, so the aria-label is
              always present — otherwise this is an unnamed icon-only button. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('searchHint')}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-primary)] pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
          >
            <Search aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{t('searchHint')}</span>
            <kbd className="hidden rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-1.5 font-mono text-xs text-[var(--text-secondary)] lg:inline">
              ⌘K
            </kbd>
          </button>

          <Link
            href="/chat"
            aria-label={t('nav.chat')}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)] pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{t('nav.chat')}</span>
          </Link>

          <div className="hidden items-center gap-2 xl:flex">
            <CurrencySwitcher />
            <LanguageSwitcher />
            <AuthMenu />
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label={t('openMenu')}
            onClick={() => setMenuOpen(true)}
            className="xl:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>

      <CommandPalette open={open} onOpenChange={setOpen} />

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t('menu')}
        side="right"
      >
        <div className="space-y-6">
          <nav aria-label={t('navLandmark')}>
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center rounded-md px-3 text-sm font-medium',
                      isActive(item.href)
                        ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)]',
                    )}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
            <AuthMenu />
            <CurrencySwitcher />
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </Sheet>
    </header>
  )
}
