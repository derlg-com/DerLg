import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Inline text painted with the brand emerald→gold (or gold) gradient. */
export function GradientText({
  children,
  variant = 'brand',
  className,
}: {
  children: ReactNode
  variant?: 'brand' | 'gold'
  className?: string
}) {
  return (
    <span className={cn(variant === 'gold' ? 'text-gradient-gold' : 'text-gradient-brand', className)}>
      {children}
    </span>
  )
}
