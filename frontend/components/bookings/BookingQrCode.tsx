'use client'

import { useMemo, useState } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'
import { encodeQrMatrix, qrMatrixToSvg } from '@/lib/qr-code'

interface BookingQrCodeProps {
  /**
   * Value encoded into the QR. Prefer the booking confirmation URL so a scan
   * opens the booking; falls back to the reference string when no URL is given.
   */
  value: string
  /** Human label shown beneath the QR (e.g. the booking reference). */
  caption?: string
  className?: string
}

/**
 * Offline-capable QR code for sharing a booking (task 27.4 / Requirement 33.9).
 *
 * Generates the QR on-device via the dependency-free encoder in
 * `lib/qr-code.ts` (no network image), so it works offline — important for the
 * PWA. Rendered as inline SVG. Hidden behind a "Show QR" affordance to keep the
 * confirmation focused; degrades gracefully (renders nothing) if encoding fails
 * for an unexpectedly large payload.
 */
export function BookingQrCode({ value, caption, className }: BookingQrCodeProps) {
  const t = useTranslations('share')
  const [open, setOpen] = useState(false)

  const svg = useMemo(() => {
    if (!value) return null
    try {
      return qrMatrixToSvg(encodeQrMatrix(value), { size: 192, margin: 4 })
    } catch {
      // Payload too large / encode failure — degrade gracefully.
      return null
    }
  }, [value])

  if (!svg) return null

  return (
    <div className={className}>
      {open ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div
            className="h-48 w-48 [&>svg]:h-full [&>svg]:w-full"
            // SVG is generated locally from trusted booking data — safe to inline.
            dangerouslySetInnerHTML={{ __html: svg }}
            role="img"
            aria-label={t('qr.alt')}
          />
          {caption ? <p className="text-sm font-medium text-foreground">{caption}</p> : null}
          <p className="text-center text-xs text-muted-foreground">{t('qr.hint')}</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {t('qr.hide')}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <QrCode className="mr-1 h-4 w-4" aria-hidden />
          {t('qr.show')}
        </Button>
      )}
    </div>
  )
}
