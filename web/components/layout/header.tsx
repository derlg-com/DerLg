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
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/cn'
import { Link, usePathname } from '@/lib/i18n/navigation'
import { NAVEL_ASSETS } from '@/lib/navel-assets'

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
  const { isAuthenticated, user } = useAuth()

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)]/60 bg-[var(--canvas)]/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={t('brand')}>
          {/* NAVEL Welcome Avatar Ring (Mobile) */}
          <div className="relative size-9 rounded-full ring-2 ring-[#3D9676]/50 dark:ring-[#3D9676] overflow-hidden bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0 lg:hidden shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user?.avatarUrl || NAVEL_ASSETS.avatars.evelyn}
              alt=""
              className="size-full object-cover"
            />
          </div>

          {/* Desktop Brand Icon */}
          <span
            aria-hidden="true"
            className="hidden lg:grid size-9 place-items-center rounded-xl bg-[#1B3232] dark:bg-[#3D9676] font-bold text-sm text-white shadow-xs"
          >
            D
          </span>

          <div className="flex flex-col text-left">
            <span className="lg:hidden text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider leading-none">
              Welcome 👋
            </span>
            <span className="text-base font-bold tracking-tight text-[#1B3232] dark:text-white leading-tight font-dela sm:font-sans">
              {isAuthenticated && user?.name ? user.name.split(' ')[0] : t('brand')}
            </span>
          </div>
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
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text-secondary)] transition-all duration-200 hover:text-[var(--text-primary)] hover:border-[#1B3232] dark:hover:border-[#3D9676] pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
          >
            <Search aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{t('searchHint')}</span>
            <kbd className="hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-1.5 font-mono text-xs text-[var(--text-secondary)] lg:inline">
              ⌘K
            </kbd>
          </button>

          <Link
            href="/chat"
            aria-label={t('nav.chat')}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#1B3232] px-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#244444] dark:bg-[#205743] dark:hover:bg-[#1B4B39] pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center shadow-xs active:scale-95"
          >
            <Sparkles aria-hidden="true" className="size-3.5 text-[#E7B171]" />
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
            className="rounded-full xl:hidden text-[#1B3232] dark:text-[#F5EADD] hover:bg-[var(--surface-hover)]"
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
