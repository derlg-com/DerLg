'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Home,
  Compass,
  Ticket,
  MessageCircle,
  User,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { TABS, getActiveTab, shouldShowBack, type TabKey } from '@/lib/nav'
import { Logo } from '@/components/shared/Logo'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

const NAV_ICONS: Record<TabKey, LucideIcon> = {
  home: Home,
  explore: Compass,
  bookings: Ticket,
  chat: MessageCircle,
  profile: User,
}

const TITLE_KEYS: Record<string, string> = {
  '/search': 'nav.explore',
  '/bookings': 'nav.bookings',
  '/profile': 'nav.profile',
}

const SEGMENT_LABELS: Record<string, string> = {
  trips: 'Trips',
  hotels: 'Hotels',
  transportation: 'Transport',
  guides: 'Guides',
  checkout: 'Checkout',
}

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('shell')
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      if (y > lastY.current && y > 80) setHidden(true)
      else setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const showBack = shouldShowBack(pathname)
  const isHome = pathname === '/'
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? ''

  let title = t('brand')
  if (!isHome) {
    if (TITLE_KEYS[pathname]) title = t(TITLE_KEYS[pathname])
    else title = SEGMENT_LABELS[firstSegment] ?? t('brand')
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 glass border-b border-border/60 transition-transform duration-200',
        hidden && '-translate-y-full',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        {/* Mobile: back button slot */}
        <div className="flex min-w-10 items-center md:hidden">
          {showBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label={t('back')}
              className="-ml-2 rounded-lg p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        {/* Mobile: Logo on home, page title otherwise */}
        <div className="flex flex-1 items-center justify-center md:hidden">
          {isHome ? (
            <Logo href="/" size="sm" />
          ) : (
            <h1 className="truncate font-display text-base font-semibold text-foreground">
              {title}
            </h1>
          )}
        </div>

        {/* Desktop: Logo + inline nav */}
        <div className="hidden items-center gap-6 md:flex">
          <Logo href="/" size="sm" />
          <nav className="flex items-center gap-1" aria-label="Primary">
            {TABS.map((tab) => {
              const Icon = NAV_ICONS[tab.key]
              const isActive = getActiveTab(pathname) === tab.key
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {isActive ? (
                    <span
                      className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-gradient-brand"
                      aria-hidden
                    />
                  ) : null}
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(tab.labelKey)}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: language selector + notifications + search icon */}
        <div className="ml-auto flex min-w-10 items-center justify-end gap-1">
          <LanguageSwitcher />
          <NotificationCenter />
          {getActiveTab(pathname) !== 'explore' ? (
            <Link
              href="/search"
              aria-label={t('search')}
              className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-5 w-5" />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}
