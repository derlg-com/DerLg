'use client'

import { useTranslations } from 'next-intl'

import { RequireAuth } from '@/components/auth/require-auth'
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import { Link } from '@/lib/i18n/navigation'

/**
 * Profile summary.
 *
 * The user object comes from the session, which the bootstrap populated from
 * `GET /v1/users/me`, so this needs no extra request.
 */
export function ProfileView() {
  return (
    <RequireAuth>
      <ProfileBody />
    </RequireAuth>
  )
}

// A top-level component, not nested inside ProfileView: a component defined
// during render is a new type on every pass, so React remounts it and any state
// inside is lost.
function ProfileBody() {
  const profile = useTranslations('profile')
  const account = useTranslations('account')
  const shell = useTranslations('shell')
  const { user } = useAuth()

  const label = user?.name?.trim() || profile('noName')

  const links = [
    { href: '/bookings', label: shell('nav.bookings') },
    { href: '/loyalty', label: shell('nav.loyalty') },
    { href: '/safety', label: shell('nav.safety') },
    { href: '/explore', label: shell('nav.explore') },
  ] as const

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4">
        <Avatar name={label} size="lg" src={user?.avatarUrl ?? undefined} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{label}</h1>
          {user?.email ? (
            <p className="truncate text-sm text-[var(--text-secondary)]">{user.email}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {user?.isStudent ? <Badge tone="accent">{profile('student')}</Badge> : null}
        {typeof user?.loyaltyPoints === 'number' ? (
          <Badge tone="success">
            {profile('loyalty.balanceLabel')}: {user.loyaltyPoints}
          </Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{profile('menu.edit')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-tertiary)]">{account('fields.email')}</dt>
              <dd>{user?.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-tertiary)]">{account('fields.phone')}</dt>
              <dd>{user?.phone ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <nav aria-label={profile('menu.preferences')} className="grid gap-2 sm:grid-cols-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-12 items-center rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
