'use client'

import * as React from 'react'

import { CardMedia } from '@/components/shared/card-media'
import { cn } from '@/lib/cn'

/**
 * Image gallery for detail pages.
 *
 * Thumbnails are real buttons in a labelled group with `aria-current` on the
 * active one, so the gallery is operable by keyboard and its state is announced
 * rather than being conveyed by border colour alone.
 */
export function Gallery({ images, label }: { images: string[]; label: string }) {
  const [active, setActive] = React.useState(0)

  if (images.length === 0) return null

  const current = images[Math.min(active, images.length - 1)]

  return (
    <div className="space-y-3">
      <CardMedia
        src={current}
        ratio="16/9"
        sizes="(min-width: 1024px) 66vw, 100vw"
        priority
        className="rounded-lg"
      />

      {images.length > 1 ? (
        <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              aria-current={index === active ? 'true' : undefined}
              aria-label={`${label} ${index + 1}`}
              className={cn(
                'relative size-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                index === active
                  ? 'border-[var(--accent)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
              )}
            >
              <CardMedia src={image} ratio="1/1" sizes="64px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
