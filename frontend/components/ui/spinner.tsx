import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZES = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' } as const

export interface SpinnerProps {
  size?: keyof typeof SIZES
  className?: string
  label?: string
}

function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      <Loader2 className={cn('animate-spin text-muted-foreground', SIZES[size], className)} />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export { Spinner }
