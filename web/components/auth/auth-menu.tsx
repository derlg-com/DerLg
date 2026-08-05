'use client'

import { LogOut, User as UserIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Avatar, Button, Popover, usePopoverClose } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import { useHydrated } from '@/hooks/use-hydrated'
import { Link, useRouter } from '@/lib/i18n/navigation'

/**
 * Header auth slot: a sign-in link for guests, an account menu once signed in.
 *
 * Renders the guest state until hydration so the server output and first client
 * render agree; the session only exists in memory on the client.
 */
export function AuthMenu() {
  const account = useTranslations('account')
  const shell = useTranslations('shell')
  const { isAuthenticated, user, ready } = useAuth()
  const hydrated = useHydrated()

  if (!hydrated || !ready) {
    // Reserve the space so the header does not jump when the session resolves.
    return <div aria-hidden="true" className="h-10 w-20 pointer-coarse:h-11" />
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-10 items-center rounded-md border border-[var(--border-default)] px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
      >
        {shell('signIn')}
      </Link>
    )
  }

  const label = user?.name?.trim() || user?.email || account('signIn.title')

  return (
    <Popover
      label={label}
      align="end"
      trigger={
        <span className="inline-flex items-center gap-2">
          <Avatar name={label} size="sm" src={user?.avatarUrl ?? undefined} />
        </span>
      }
    >
      <AccountMenuItems label={label} />
    </Popover>
  )
}

function AccountMenuItems({ label }: { label: string }) {
  const profile = useTranslations('profile')
  const { logout } = useAuth()
  const router = useRouter()
  const close = usePopoverClose()

  return (
    <div className="space-y-1">
      <p className="truncate px-2 py-1 text-sm font-medium">{label}</p>

      <Link
        href="/profile"
        onClick={close}
        className="flex min-h-10 items-center gap-2 rounded-sm px-2 text-sm hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
      >
        <UserIcon aria-hidden="true" className="size-4" />
        {profile('menu.edit')}
      </Link>

      <Button
        variant="ghost"
        size="sm"
        block
        loading={logout.isPending}
        onClick={async () => {
          await logout.mutateAsync()
          close()
          router.replace('/')
        }}
        className="justify-start"
      >
        <LogOut aria-hidden="true" className="size-4" />
        {profile('logout')}
      </Button>
    </div>
  )
}
