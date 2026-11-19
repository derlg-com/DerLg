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
      className="sticky bottom-0 z-30 border-t border-[var(--border-subtle)]/60 bg-white/95 dark:bg-[#121E1E]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] transition-colors"
    >
      <ul className="grid grid-cols-5 h-16 items-center px-1">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(href)
          const isConcierge = key === 'nav.chat'
          return (
            <li key={href} className="flex justify-center">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-0.5 py-1 px-1 text-[11px] font-semibold transition-all duration-200',
                  active
                    ? 'text-[#1B3232] dark:text-[#52C199]'
                    : 'text-[var(--text-secondary)] hover:text-[#1B3232] dark:text-[#A1B0B0] dark:hover:text-[#F5EADD]',
                )}
              >
                <div
                  className={cn(
                    'relative flex items-center justify-center size-8 rounded-xl transition-all duration-200',
                    active
                      ? 'bg-[#1B3232] text-white dark:bg-[#205743] dark:text-[#E8F1EE] shadow-xs scale-105'
                      : isConcierge
                        ? 'bg-[var(--color-navel-jade)]/10 text-[#3D9676] dark:text-[#52C199]'
                        : 'group-hover:bg-[var(--surface-hover)]',
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      'size-4.5 transition-transform duration-200',
                      active ? 'stroke-[2.5px]' : 'stroke-[2px]',
                      isConcierge && !active && 'text-[#3D9676] dark:text-[#52C199]',
                    )}
                  />
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[#1B3232] dark:bg-[#52C199]"
                    />
                  )}
                  {isConcierge && !active && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-1 size-1.5 rounded-full bg-[#E7B171] animate-pulse"
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'max-w-full truncate text-[10px] leading-tight transition-colors',
                    active
                      ? 'font-bold text-[#1B3232] dark:text-[#52C199]'
                      : 'font-medium text-[var(--text-secondary)] dark:text-[#A1B0B0]',
                  )}
                >
                  {t(key)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
