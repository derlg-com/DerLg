'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Star, MapPin, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import type { FavoriteType } from '@/stores/favorites.store'

const ASPECT = { '4/3': 'aspect-[4/3]', square: 'aspect-square', video: 'aspect-video' } as const

export interface EntityCardProps {
  href: string
  title: string
  favorite?: { type: FavoriteType; id: string }
  imageUrl?: string | null
  imageAspect?: keyof typeof ASPECT
  fallbackIcon?: LucideIcon
  /** Top-left pill (e.g. category, vehicle type). */
  badge?: { label: ReactNode; variant?: BadgeProps['variant'] }
  /** Bottom-left glass rating chip. */
  rating?: { average: number; count?: number }
  subtitle?: ReactNode
  priceLabel?: string
  priceSuffix?: string
  /** Right-aligned meta beside the price (duration, seats…). */
  meta?: ReactNode
}

/**
 * The single premium result card used across every vertical (trips, hotels,
 * transport, guides) and the Explore shelves. Image with hover-zoom + gradient
 * scrim, optional badge / favorite / rating chip, display-font title, price + meta.
 */
export function EntityCard({
  href,
  title,
  favorite,
  imageUrl,
  imageAspect = '4/3',
  fallbackIcon: Fallback = MapPin,
  badge,
  rating,
  subtitle,
  priceLabel,
  priceSuffix,
  meta,
}: EntityCardProps) {
  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card
        variant="interactive"
        className="h-full overflow-hidden group-focus-visible:ring-2 group-focus-visible:ring-ring"
      >
        <div className={cn('relative bg-muted', ASPECT[imageAspect])}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes="(max-width: 640px) 50vw, 300px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-brand text-white">
              <Fallback className="h-8 w-8" aria-hidden />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          {badge ? (
            badge.variant ? (
              <Badge variant={badge.variant} className="absolute left-2 top-2 shadow-sm">
                {badge.label}
              </Badge>
            ) : (
              <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                {badge.label}
              </span>
            )
          ) : null}
          {favorite ? (
            <div className="absolute right-2 top-2">
              <FavoriteButton type={favorite.type} id={favorite.id} />
            </div>
          ) : null}
          {rating && rating.average > 0 ? (
            <span className="glass absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-foreground">
              <Star className="h-3.5 w-3.5 fill-secondary text-secondary" aria-hidden />
              {rating.average.toFixed(1)}
              {rating.count != null ? (
                <span className="font-normal text-muted-foreground">({rating.count})</span>
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="space-y-1 p-3.5">
          <h3 className="line-clamp-1 font-display font-semibold text-foreground">{title}</h3>
          {subtitle ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
          {priceLabel || meta ? (
            <div className="flex items-center justify-between pt-1.5">
              {priceLabel ? (
                <p className="text-base">
                  <span className="font-bold text-foreground">{priceLabel}</span>
                  {priceSuffix ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      {' '}
                      {priceSuffix}
                    </span>
                  ) : null}
                </p>
              ) : (
                <span />
              )}
              {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  )
}
