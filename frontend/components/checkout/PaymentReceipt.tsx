'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { useFormatCurrency } from '@/hooks/use-format-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import type { PaymentReceipt as PaymentReceiptData } from '@/types/domain'

interface PaymentReceiptProps {
  receipt: PaymentReceiptData
}

/**
 * Payment receipt (Task 12.5 — Requirement 6.9): "store the payment receipt and
 * allow users to download it as PDF".
 *
 * The receipt is derived from the confirmed booking (see `lib/receipt.ts`) and
 * rendered here as an itemized summary. "Download PDF" triggers the browser's
 * native print-to-PDF via {@link window.print}; the `receipt-printable` /
 * `print-receipt` classes (see `app/globals.css`) hide all other chrome so the
 * printed/saved page contains only the receipt. This needs no extra dependency
 * and works offline — important for the PWA / spotty-network audience.
 */
export function PaymentReceipt({ receipt }: PaymentReceiptProps) {
  const t = useTranslations('checkout')
  const tc = useTranslations('currency')
  const locale = useLanguageStore((s) => s.locale)
  const { currency, format: formatMoney, formatUsd } = useFormatCurrency()

  const statusLabel = t(`receipt.status.${receipt.status}`, undefined, 'receipt.status.succeeded')

  function handleDownload() {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <Card className="receipt-printable text-left" data-testid="payment-receipt">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              {t('receipt.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('receipt.reference')}:{' '}
              <span className="font-medium text-foreground">{receipt.bookingReference}</span>
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            {statusLabel}
          </span>
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('receipt.method')}</dt>
            <dd className="text-foreground">
              {t(`receipt.provider.${receipt.provider}`, undefined, 'receipt.provider.stripe')}
            </dd>
          </div>
          {receipt.paidAt ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('receipt.date')}</dt>
              <dd className="text-foreground">{formatDate(receipt.paidAt, locale)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t('receipt.items')}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {receipt.lineItems.map((item, i) => (
              <li key={i} className="flex items-center justify-between p-3 text-sm">
                <span className="text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{formatMoney(item.amountUsd)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="font-medium text-foreground">{t('receipt.total')}</span>
          <span className="text-right">
            <span className="block text-lg font-semibold text-foreground">
              {formatMoney(receipt.amountUsd)}
            </span>
            {currency !== 'USD' ? (
              <span className="block text-xs text-muted-foreground">
                {tc('originalUsd', { amount: formatUsd(receipt.amountUsd) })}
              </span>
            ) : null}
          </span>
        </div>

        {currency !== 'USD' ? (
          <p className="text-xs text-muted-foreground">{tc('disclaimer')}</p>
        ) : null}

        <Button
          type="button"
          variant="outline"
          onClick={handleDownload}
          className="print-hidden w-full"
        >
          <Download className="mr-1 h-4 w-4" aria-hidden />
          {t('receipt.download')}
        </Button>
      </CardContent>
    </Card>
  )
}
