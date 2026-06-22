import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  /** Set to null to render a non-linked mark (e.g. inside another link). */
  href?: string | null
  withWordmark?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/** DerLg brand mark: gradient leaf tile + wordmark. */
export function Logo({ className, href = '/', withWordmark = true, size = 'md' }: LogoProps) {
  const tile = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
  const text = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'

  const mark = (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow',
          tile,
        )}
        aria-hidden
      >
        <Leaf className={icon} />
      </span>
      {withWordmark ? (
        <span className={cn('font-display font-extrabold tracking-tight text-foreground', text)}>
          DerLg
        </span>
      ) : null}
    </span>
  )

  if (href) {
    return (
      <Link href={href} aria-label="DerLg home" className={cn('inline-flex items-center', className)}>
        {mark}
      </Link>
    )
  }
  return <span className={cn('inline-flex items-center', className)}>{mark}</span>
}
