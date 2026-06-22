'use client'

import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBookingHold } from '@/hooks/use-booking-hold'
import { useTranslations } from '@/lib/i18n'

export function HoldTimer({ holdExpiresAt }: { holdExpiresAt?: string | null }) {
  const { expired, totalSeconds, minutes, seconds } = useBookingHold(holdExpiresAt)
  const t = useTranslations('checkout')
  if (!holdExpiresAt || totalSeconds === null) return null

  return (
    <div
      role="timer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        expired ? 'bg-destructive/15 text-destructive' : 'bg-muted text-foreground',
      )}
    >
      <Clock className="h-4 w-4" aria-hidden />
      {expired
        ? t('hold.expired')
        : t('hold.remaining', { time: `${minutes}:${String(seconds).padStart(2, '0')}` })}
    </div>
  )
}
