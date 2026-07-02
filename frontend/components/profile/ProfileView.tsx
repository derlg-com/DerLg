'use client'

import Link from 'next/link'
import {
  ChevronRight,
  Heart,
  GraduationCap,
  SlidersHorizontal,
  UserPen,
  Sparkles,
  KeyRound,
  ScrollText,
} from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { useApiQuery } from '@/lib/use-api-query'
import { useLogout } from '@/hooks/use-auth'
import { useFavoritesStore } from '@/stores/favorites.store'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslations } from '@/lib/i18n'
import type { UserProfile } from '@/types/api'

const MENU = [
  { href: '/profile/edit', key: 'menu.edit', icon: UserPen },
  { href: '/profile/password', key: 'menu.password', icon: KeyRound },
  { href: '/profile/loyalty', key: 'menu.loyalty', icon: Sparkles },
  { href: '/profile/student', key: 'menu.student', icon: GraduationCap },
  { href: '/profile/preferences', key: 'menu.preferences', icon: SlidersHorizontal },
  { href: '/profile/wishlist', key: 'menu.wishlist', icon: Heart },
  { href: '/legal/privacy', key: 'menu.legal', icon: ScrollText },
] as const

function Inner() {
  const t = useTranslations('profile')
  const logout = useLogout()
  const { data: user, isLoading } = useApiQuery<UserProfile>('/v1/users/me')
  const wishlistCount = useFavoritesStore((s) => s.ids.length)

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-4">
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : (
        <div className="flex items-center gap-4">
          <Avatar src={user?.avatarUrl} name={user?.name} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight text-foreground">
              {user?.name ?? t('noName')}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            {user?.phone ? (
              <p className="truncate text-sm text-muted-foreground">{user.phone}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="muted">
                {t('loyaltyBadge', { points: user?.loyaltyPoints ?? 0 })}
              </Badge>
              {user?.isStudent ? (
                <Badge variant="success">
                  <GraduationCap className="h-3 w-3" aria-hidden /> {t('student')}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {MENU.map(({ href, key, icon: Icon }) => (
          <Link key={href} href={href} className="block focus-visible:outline-none">
            <Card variant="interactive" className="flex items-center gap-3 p-4">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <span className="flex-1 font-medium text-foreground">{t(key)}</span>
              {key === 'menu.wishlist' && wishlistCount > 0 ? (
                <Badge variant="muted">{wishlistCount}</Badge>
              ) : null}
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>

      <Button variant="outline" className="w-full" onClick={() => void logout()}>
        {t('logout')}
      </Button>
    </div>
  )
}

export function ProfileView() {
  return (
    <BookingShell>
      <Inner />
    </BookingShell>
  )
}
