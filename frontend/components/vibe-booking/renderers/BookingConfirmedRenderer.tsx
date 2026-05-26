'use client'

import Image from 'next/image'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatDate } from '@/lib/format'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

interface ConfirmedData {
  bookingRef: string
  tripName: string
  travelDate: string
  qrCode?: string
  bookingId?: string
}

function buildICS(data: ConfirmedData): string {
  const start = new Date(data.travelDate)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DerLg//Travel Booking//EN',
    'BEGIN:VEVENT',
    `UID:${data.bookingRef}@derlg.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${data.tripName}`,
    `DESCRIPTION:Booking ref ${data.bookingRef}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function downloadFile(content: string, filename: string, mime: string) {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function BookingConfirmedRenderer({ item, onAction }: Props) {
  const data = item.data as ConfirmedData
  const t = useTranslations()
  const locale = useLanguageStore((s) => s.locale)

  const handleShare = async () => {
    const shareData = {
      title: `${t('booking.bookingConfirmed')} — ${data.tripName}`,
      text: `${t('booking.reference')}: ${data.bookingRef}`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        /* user cancelled — silent */
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`)
    }
  }

  return (
    <div className="p-6 text-center space-y-3">
      <div className="text-4xl">✅</div>
      <p className="font-bold text-lg">{t('booking.bookingConfirmed')}</p>
      <p className="text-sm text-muted-foreground">{data.tripName}</p>
      <p className="font-mono text-sm bg-muted rounded px-3 py-1 inline-block">
        {data.bookingRef}
      </p>
      <p className="text-xs text-muted-foreground">{formatDate(data.travelDate, locale)}</p>

      {data.qrCode && (
        <div className="relative w-32 h-32 mx-auto rounded-lg border bg-white p-2">
          <Image
            src={data.qrCode}
            alt="Check-in QR"
            fill
            loading="lazy"
            sizes="128px"
            className="object-contain p-2"
          />
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <button
          onClick={() =>
            onAction('download_receipt', item.id, { booking_id: data.bookingId ?? data.bookingRef })
          }
          className="border border-border rounded-md py-1.5 px-3 text-sm"
        >
          {t('booking.downloadReceipt')}
        </button>
        <button
          onClick={() =>
            downloadFile(buildICS(data), `${data.bookingRef}.ics`, 'text/calendar')
          }
          className="border border-border rounded-md py-1.5 px-3 text-sm"
        >
          {t('booking.addToCalendar')}
        </button>
        <button
          onClick={handleShare}
          className="border border-border rounded-md py-1.5 px-3 text-sm"
        >
          {t('common.share')}
        </button>
      </div>
    </div>
  )
}
