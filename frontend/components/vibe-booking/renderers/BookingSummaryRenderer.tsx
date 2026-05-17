'use client'
import { useEffect, useState } from 'react'
import type { ContentItem } from '@/stores/vibe-booking.store'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function BookingSummaryRenderer({ item, onAction }: Props) {
  const { bookingId, tripName, travelDate, totalUsd, guestCount, reservedUntil } = item.data as {
    bookingId: string; tripName: string; travelDate: string; totalUsd: number; guestCount: number; reservedUntil: string
  }
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor((new Date(reservedUntil).getTime() - Date.now()) / 1000)))

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
        <p className="font-semibold">{tripName}</p>
        <p className="text-sm text-muted-foreground">{travelDate} · {guestCount} guest{guestCount !== 1 ? 's' : ''}</p>
        <p className="text-xl font-bold">${totalUsd} USD</p>
      </div>
      <div className={`text-sm font-medium ${secondsLeft < 120 ? 'text-destructive' : 'text-muted-foreground'}`}>
        Hold expires in {mins}:{secs.toString().padStart(2, '0')}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onAction('confirm_booking', bookingId, { bookingId })} className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium">
          Confirm & Pay
        </button>
        <button onClick={() => onAction('cancel_booking', bookingId, { bookingId })} className="flex-1 border border-border rounded-md py-2 text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}
