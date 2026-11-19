'use client'

import {
  ArrowRight,
  CalendarCheck,
  Compass,
  Gift,
  ShieldCheck,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { RequireAuth } from '@/components/auth/require-auth'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { Avatar } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import { Link } from '@/lib/i18n/navigation'

export function ProfileView() {
  return (
    <RequireAuth>
      <ProfileBody />
    </RequireAuth>
  )
}

function ProfileBody() {
  const profile = useTranslations('profile')
  const account = useTranslations('account')
  const shell = useTranslations('shell')
  const { user } = useAuth()

  const label = user?.name?.trim() || profile('noName')

  const links = [
    {
      href: '/bookings',
      label: shell('nav.bookings'),
      icon: CalendarCheck,
      color: 'text-[var(--color-navel-jade)]',
    },
    {
      href: '/loyalty',
      label: shell('nav.loyalty'),
      icon: Gift,
      color: 'text-[var(--color-navel-gold)]',
    },
    {
      href: '/safety',
      label: shell('nav.safety'),
      icon: ShieldCheck,
      color: 'text-[#3D9676]',
    },
    {
      href: '/explore',
      label: shell('nav.explore'),
      icon: Compass,
      color: 'text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]',
    },
  ] as const

  return (
    <div className="space-y-6 px-4 py-4 sm:px-6">
      {/* Header Profile Card */}
      <div className="flex items-center gap-4 rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] p-5 shadow-sm">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full ring-4 ring-[var(--color-navel-jade)]/20 shadow-md">
          <Avatar name={label} size="lg" src={user?.avatarUrl ?? undefined} className="size-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-dela truncate text-xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
              {label}
            </h1>
            {user?.isStudent ? (
              <span className="rounded-full bg-[var(--color-navel-gold)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--color-navel-gold)] uppercase tracking-wider">
                {profile('student')}
              </span>
            ) : null}
          </div>
          {user?.email ? (
            <p className="truncate text-xs text-[var(--text-secondary)] mt-0.5">{user.email}</p>
          ) : null}

          {typeof user?.loyaltyPoints === 'number' ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-navel-cream)] dark:bg-[var(--surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-gold)] border border-[var(--border-subtle)]">
              <Gift className="size-3 text-[var(--color-navel-gold)]" />
              <span>{user.loyaltyPoints} points</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Account Details Card */}
      <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] p-5 shadow-sm space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
          {profile('menu.edit')}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="space-y-0.5">
            <dt className="text-xs text-[var(--text-tertiary)]">{account('fields.email')}</dt>
            <dd className="font-medium text-[var(--text-primary)]">{user?.email ?? '—'}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-[var(--text-tertiary)]">{account('fields.phone')}</dt>
            <dd className="font-medium text-[var(--text-primary)]">{user?.phone ?? '—'}</dd>
          </div>
        </dl>
      </div>

      {/* Navigation Quick Links */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
          {profile('menu.preferences')}
        </h2>
        <nav aria-label={profile('menu.preferences')} className="grid gap-2 sm:grid-cols-2">
          {links.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex min-h-12 items-center justify-between rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] px-4 py-3 text-sm font-semibold transition-all hover:border-[var(--color-navel-jade)] hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-[var(--color-navel-cream)]/70 dark:bg-[var(--surface)]">
                    <Icon className={`size-4 ${item.color}`} />
                  </div>
                  <span className="text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
                    {item.label}
                  </span>
                </div>
                <ArrowRight className="size-4 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--color-navel-jade)]" />
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Settings / App Options */}
      <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] p-5 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
          App Settings
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-primary)]">Appearance</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-sm font-medium text-[var(--text-primary)]">Language</span>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </div>
  )
}
