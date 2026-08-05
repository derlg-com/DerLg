import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * Card — structure comes from a hairline border, not a shadow. `interactive`
 * adds hover feedback for cards that are themselves links or buttons.
 */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  interactive?: boolean
  as?: 'div' | 'article' | 'section' | 'li'
}

export function Card({ className, interactive = false, as = 'div', ...props }: CardProps) {
  const Component = as
  return (
    <Component
      className={cn(
        'rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]',
        interactive &&
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quick)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1 p-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base leading-tight font-semibold tracking-tight', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-[var(--text-secondary)]', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 p-4 pt-0', className)} {...props} />
}
