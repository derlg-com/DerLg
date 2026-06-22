'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-lg' } as const

export interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: keyof typeof SIZES
  className?: string
}

function initials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/** Circular avatar; renders the image when it loads, otherwise initials. */
function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const [errored, setErrored] = React.useState(false)
  const showImage = src && !errored
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-medium text-accent-foreground',
        SIZES[size],
        className,
      )}
      aria-label={name ?? undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar URLs are arbitrary user hosts not in next.config
        <img
          src={src}
          alt={name ?? 'Avatar'}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  )
}

export { Avatar }
