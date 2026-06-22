'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, Ticket, MessageCircle, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { TABS, getActiveTab, type TabKey } from '@/lib/nav'

const ICONS: Record<TabKey, LucideIcon> = {
  home: Home,
  explore: Compass,
  bookings: Ticket,
  chat: MessageCircle,
  profile: User,
}

export function BottomNav() {
  const pathname = usePathname()
  const active = getActiveTab(pathname)
  const t = useTranslations('shell')

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 glass border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map((tab) => {
          const Icon = ICONS[tab.key]
          const isActive = active === tab.key
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isActive ? (
                  <span
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-gradient-brand"
                    aria-hidden
                  />
                ) : null}
                <Icon
                  className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')}
                  aria-hidden
                />
                <span className="truncate">{t(tab.labelKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
