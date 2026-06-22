'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { MarkdownText } from '@/components/shared/MarkdownText'
import type { FavoriteType } from '@/stores/favorites.store'

export interface ResultCardProps {
  favType: FavoriteType
  id: string
  name: string
  imageUrl?: string
  rating?: number
  reviewCount?: number
  subtitle?: string
  priceLabel: string
  priceSuffix?: string
  blurb?: string
  highlighted?: boolean
  onHoverChange?: (hovering: boolean) => void
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel: string
  onSecondary: () => void
}

function CardImage({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted px-2 text-center text-xs text-muted-foreground">
        {alt}
      </div>
    )
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      loading="lazy"
      sizes="(min-width: 640px) 192px, 100vw"
      className="object-cover"
      onError={() => setError(true)}
    />
  )
}

/**
 * TripAdvisor-style result card: large image, name, star rating + review count,
 * price, an opinionated blurb (bold-aware, line-clamped), a favorite heart, and
 * secondary + primary actions. Hovering syncs with the results map.
 */
export default function ResultCard({
  favType,
  id,
  name,
  imageUrl,
  rating,
  reviewCount,
  subtitle,
  priceLabel,
  priceSuffix,
  blurb,
  highlighted,
  onHoverChange,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: ResultCardProps) {
  return (
    <article
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={`flex flex-col gap-3 rounded-xl border p-3 transition-shadow sm:flex-row ${
        highlighted ? 'border-primary ring-2 ring-primary/40' : 'border-border'
      }`}
    >
      <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-auto sm:w-48 sm:self-stretch">
        <CardImage src={imageUrl} alt={name} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-foreground">{name}</h3>
          <FavoriteButton type={favType} id={id} className="h-8 w-8 shrink-0" />
        </div>
        {rating != null && (
          <div className="flex items-center gap-1 text-xs">
            <Star className="h-3.5 w-3.5 fill-secondary text-secondary" aria-hidden />
            <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
            {reviewCount != null && <span className="text-muted-foreground">({reviewCount})</span>}
          </div>
        )}
        {subtitle && <p className="line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>}
        <p className="text-sm font-semibold text-foreground">
          {priceLabel}
          {priceSuffix && <span className="text-xs font-normal text-muted-foreground"> {priceSuffix}</span>}
        </p>
        {blurb && (
          <p className="line-clamp-3 text-xs text-muted-foreground">
            <MarkdownText text={blurb} />
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onSecondary}
            className="min-h-[40px] flex-1 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-muted active:bg-muted/70"
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={onPrimary}
            className="min-h-[40px] flex-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </article>
  )
}
