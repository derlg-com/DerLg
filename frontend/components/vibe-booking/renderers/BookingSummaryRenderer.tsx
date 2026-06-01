'use client'
import { useEffect, useState } from 'react'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useLanguageStore } from '@/lib/i18n'
import { formatCurrency, formatDate } from '@/lib/format'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function BookingSummaryRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const { bookingId, itemName, travelDate, totalUsd, peopleCount, holdExpiresAt } = item.data as {
    bookingId: string; itemName: string; travelDate: string; totalUsd: number; peopleCount: number; holdExpiresAt: string
  }
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000)))

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [secondsLeft])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="p-4 space-y-3">
      <div className="space-y-1">
        <p className="font-semibold">{itemName || 'Your booking'}</p>
        <p className="text-sm text-muted-foreground">{travelDate ? formatDate(travelDate, locale) + ' · ' : ''}{peopleCount} guest{peopleCount !== 1 ? 's' : ''}</p>
        <p className="text-xl font-bold">{formatCurrency(totalUsd, locale)}</p>
      </div>
      {holdExpiresAt && (
        <div className={`text-sm font-medium ${secondsLeft < 120 ? 'text-destructive' : 'text-muted-foreground'}`}>
          Hold expires in {mins}:{secs.toString().padStart(2, '0')}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => onAction('generate_payment_qr', bookingId, { booking_id: bookingId, provider: 'BAKONG' })} className="flex-1 bg-primary text-primary-foreground rounded-md min-h-[44px] px-3 text-sm font-medium transition-colors hover:opacity-90 active:opacity-80">
          Pay with Bakong
        </button>
        <button onClick={() => onAction('cancel_booking', bookingId, { bookingId })} className="flex-1 border border-border rounded-md min-h-[44px] px-3 text-sm transition-colors hover:bg-muted active:bg-muted/70">
          Cancel
        </button>
      </div>
    </div>
  )
}
