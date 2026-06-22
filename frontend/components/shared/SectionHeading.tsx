import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

/** Marketing/section heading: small eyebrow + large display title + subtitle. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'space-y-3',
        align === 'center' && 'mx-auto max-w-2xl text-center',
        className,
      )}
    >
      {eyebrow ? (
        <span className="inline-block text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-base leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}
