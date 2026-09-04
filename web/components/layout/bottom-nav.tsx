'use client'

import { CalendarCheck, Compass, Home, Sparkles, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/cn'
import { Link, usePathname } from '@/lib/i18n/navigation'

/**
 * Mobile bottom navigation — exactly five destinations, per the navigation rule
 * that a bottom bar must hold no more than five items to stay tappable.
 */
const ITEMS = [
  { href: '/', key: 'nav.home', Icon: Home },
  { href: '/explore', key: 'nav.explore', Icon: Compass },
  { href: '/chat', key: 'nav.chat', Icon: Sparkles },
  { href: '/bookings', key: 'nav.bookings', Icon: CalendarCheck },
  { href: '/profile', key: 'nav.profile', Icon: User },
] as const

export function BottomNav() {
  const t = useTranslations('shell')
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav
      aria-label={t('mobileNavLandmark')}
      // pb-safe keeps the bar clear of the iOS home indicator.
      className="sticky bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--canvas)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition-colors duration-[var(--duration-fast)]',
                  active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]',
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span className="max-w-full truncate">{t(key)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
