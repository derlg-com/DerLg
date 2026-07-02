'use client'

import { Heart } from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { useApiQuery } from '@/lib/use-api-query'
import { useFavoritesStore, type FavoriteType } from '@/stores/favorites.store'
import { SearchResultCard } from '@/components/search/SearchResultCard'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslations } from '@/lib/i18n'

const ENDPOINT: Record<FavoriteType, (id: string) => string> = {
  trip: (id) => `/v1/trips/${id}`,
  hotel: (id) => `/v1/hotels/${id}`,
  guide: (id) => `/v1/guides/${id}`,
  transport: (id) => `/v1/transportation/vehicles/${id}`,
  festival: (id) => `/v1/festivals/${id}`,
}
const HREF: Record<FavoriteType, (id: string) => string> = {
  trip: (id) => `/trips/${id}`,
  hotel: (id) => `/hotels/${id}`,
  guide: (id) => `/guides/${id}`,
  transport: (id) => `/transportation/${id}`,
  festival: (id) => `/festivals/${id}`,
}

interface WishlistEntity {
  name?: string
  coverImageUrl?: string | null
  coverImage?: string | null
  profilePicture?: string | null
  imageUrls?: string[]
}

function WishlistItem({ type, id }: { type: FavoriteType; id: string }) {
  const { data, isLoading } = useApiQuery<WishlistEntity>(ENDPOINT[type](id))
  if (isLoading) return <Skeleton className="h-20 w-full rounded-lg" />
  const name = data?.name ?? id
  const image =
    data?.coverImageUrl ?? data?.coverImage ?? data?.profilePicture ?? data?.imageUrls?.[0] ?? null
  return (
    <div className="relative">
      <SearchResultCard href={HREF[type](id)} imageUrl={image} title={name} subtitle={type} />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <FavoriteButton type={type} id={id} />
      </div>
    </div>
  )
}

function Inner() {
  const t = useTranslations('profile')
  const ids = useFavoritesStore((s) => s.ids)
  const items = ids.map((k) => {
    const i = k.indexOf(':')
    return { type: k.slice(0, i) as FavoriteType, id: k.slice(i + 1) }
  })

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <EmptyState
          icon={Heart}
          title={t('wishlist.empty')}
          description={t('wishlist.emptyDesc')}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
      <h1 className="text-xl font-bold text-foreground">{t('wishlist.title')}</h1>
      {items.map((it) => (
        <WishlistItem key={`${it.type}:${it.id}`} type={it.type} id={it.id} />
      ))}
    </div>
  )
}

export function WishlistView() {
  return (
    <BookingShell>
      <Inner />
    </BookingShell>
  )
}
