'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { countdownTo } from '@/lib/festival-countdown'

export interface FestivalCountdownProps {
  /** Festival start date (ISO). */
  startDate: string
  className?: string
  /** Render a compact inline variant (no icon, smaller). */
  compact?: boolean
}

/**
 * Lightweight days/hours-until countdown for an upcoming festival
 * (Requirement 41.7). Unlike the 1-second emergency countdown
 * (hooks/use-countdown.ts), this ticks once per minute (days/hours
 * granularity), is SSR-safe (renders nothing until mounted to avoid hydration
 * mismatch), and renders nothing once the festival has started.
 */
export function FestivalCountdown({ startDate, className, compact }: FestivalCountdownProps) {
  const t = useTranslations('festivals')
  const [parts, setParts] = useState(() => countdownTo(startDate))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Mount-time sync from an external source (the wall clock) — intentionally
    // sets state once on mount to avoid SSR hydration mismatch, then ticks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    setParts(countdownTo(startDate))
    const id = setInterval(() => setParts(countdownTo(startDate)), 60_000)
    return () => clearInterval(id)
  }, [startDate])

  // Avoid hydration mismatch: the server can't know "now", so defer to client.
  if (!mounted || parts.isPast) return null

  const label =
    parts.days > 0
      ? t('countdown.daysHours', { days: parts.days, hours: parts.hours })
      : t('countdown.hours', { hours: Math.max(1, parts.hours) })

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-primary',
        compact ? '' : 'rounded-full bg-primary/10 px-2.5 py-1',
        className,
      )}
      aria-label={t('countdown.aria', { label })}
    >
      {compact ? null : <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {label}
    </span>
  )
}
