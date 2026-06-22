'use client'

import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFavoritesStore, type FavoriteType } from '@/stores/favorites.store'

export interface FavoriteButtonProps {
  type: FavoriteType
  id: string
  className?: string
}

export function FavoriteButton({ type, id, className }: FavoriteButtonProps) {
  const isFavorite = useFavoritesStore((s) => s.ids.includes(`${type}:${id}`))
  const toggle = useFavoritesStore((s) => s.toggle)

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Remove from wishlist' : 'Add to wishlist'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(type, id)
      }}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', isFavorite && 'fill-destructive text-destructive')} />
    </button>
  )
}
