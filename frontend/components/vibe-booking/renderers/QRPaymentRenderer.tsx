'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

interface QRData {
  qrUrl: string
  amount: { usd: number; khr?: number }
  expiry: string
  paymentIntentId: string
  bookingId?: string
  remaining_seconds?: number
  expired?: boolean
}

export default function QRPaymentRenderer({ item, onAction }: Props) {
  const data = item.data as QRData
  const t = useTranslations()
  const locale = useLanguageStore((s) => s.locale)

  const initialSeconds =
    typeof data.remaining_seconds === 'number'
      ? data.remaining_seconds
      : Math.max(0, Math.floor((new Date(data.expiry).getTime() - Date.now()) / 1000))

  const [seconds, setSeconds] = useState(initialSeconds)
  const [expired, setExpired] = useState(!!data.expired || initialSeconds <= 0)

  // Sync from updated item.data when WS pushes booking_hold_expiry
  useEffect(() => {
    if (typeof data.remaining_seconds === 'number') setSeconds(data.remaining_seconds)
    if (data.expired) setExpired(true)
  }, [data.remaining_seconds, data.expired])

  // Local fallback ticker
  useEffect(() => {
    if (expired || seconds <= 0) {
      setExpired(true)
      return
    }
    const t = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(t)
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
      <p
        className={`text-sm font-medium ${
          isUrgent ? 'text-destructive animate-pulse' : 'text-muted-foreground'
        }`}
      >
        {t('booking.expiresIn', { minutes, seconds: secs.toString().padStart(2, '0') })}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() =>
            onAction('cancel_booking', item.id, { booking_id: data.bookingId })
          }
          className="border border-border rounded-md py-1.5 px-3 text-sm"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() =>
            onAction('check_payment_status', item.id, { booking_id: data.bookingId })
          }
          className="bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-sm font-medium"
        >
          {t('common.retry')}
        </button>
      </div>
    </div>
  )
}
