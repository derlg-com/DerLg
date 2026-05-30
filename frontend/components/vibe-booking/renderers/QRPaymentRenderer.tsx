'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'

interface QRData {
  qrUrl: string
  amount: { usd: number; khr?: number }
  expiry: string
  paymentIntentId: string
  bookingId?: string
  remaining_seconds?: number
  expired?: boolean
}

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

function calcInitialSeconds(data: QRData): number {
  if (typeof data.remaining_seconds === 'number') return data.remaining_seconds
  return Math.max(0, Math.floor((new Date(data.expiry).getTime() - Date.now()) / 1000))
}

export default function QRPaymentRenderer({ item, onAction }: Props) {
  const data = item.data as QRData
  const t = useTranslations()
  const locale = useLanguageStore((s) => s.locale)

  // Lazy initializer — Date.now() runs once, not on every render
  const [prevRemaining, setPrevRemaining] = useState(data.remaining_seconds)
  const [seconds, setSeconds] = useState(() => calcInitialSeconds(data))
  // expired is derived: true if data says so, or if countdown reaches 0
  const [countdownExpired, setCountdownExpired] = useState(false)
  const expired = !!data.expired || countdownExpired

  // React getDerivedStateFromProps pattern: update state when prop changes
  if (data.remaining_seconds !== prevRemaining && typeof data.remaining_seconds === 'number') {
    setPrevRemaining(data.remaining_seconds)
    setSeconds(data.remaining_seconds)
  }

  // Local countdown ticker
  useEffect(() => {
    if (expired || seconds <= 0) {
      return
    }
    const timer = setTimeout(() => {
      const next = Math.max(0, seconds - 1)
      setSeconds(next)
      if (next === 0) setCountdownExpired(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [seconds, expired])

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const isUrgent = seconds <= 120

  if (expired) {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="text-3xl">⏰</div>
        <p className="font-semibold">{t('booking.expired')}</p>
        <button
          onClick={() => onAction('restart_booking', item.id, { booking_id: data.bookingId })}
          className="bg-primary text-primary-foreground rounded-md py-2 px-4 text-sm font-medium"
        >
          {t('common.tryAgain')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col items-center gap-3">
      <p className="font-semibold">{t('booking.scanQr')}</p>
      <div className="relative w-48 h-48 rounded-lg border bg-white p-2">
        <Image
          src={data.qrUrl}
          alt={t('booking.scanQr')}
          fill
          loading="lazy"
          sizes="192px"
          className="object-contain p-2"
        />
      </div>
      <p className="text-lg font-bold">{formatCurrency(data.amount.usd, locale)}</p>
      <p className={`text-sm font-medium ${isUrgent ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}>
        {t('booking.expiresIn', { minutes, seconds: secs.toString().padStart(2, '0') })}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onAction('cancel_booking', item.id, { booking_id: data.bookingId })}
          className="border border-border rounded-md py-1.5 px-3 text-sm"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() => onAction('check_payment_status', item.id, { booking_id: data.bookingId })}
          className="bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-sm font-medium"
        >
          {t('common.retry')}
        </button>
      </div>
    </div>
  )
}
