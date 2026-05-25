'use client'
import { Clock, CheckCircle2, XCircle } from 'lucide-react'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'

interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
type Status = 'PENDING' | 'SUCCEEDED' | 'FAILED'

const STATUS_META: Record<Status, { className: string; Icon: typeof Clock; labelKey: string }> = {
  PENDING:   { className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-700/40',    Icon: Clock,        labelKey: 'paymentStatus.pending'   },
  SUCCEEDED: { className: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-700/40', Icon: CheckCircle2, labelKey: 'paymentStatus.succeeded' },
  FAILED:    { className: 'bg-rose-100 text-rose-900 ring-1 ring-rose-700/40',         Icon: XCircle,      labelKey: 'paymentStatus.failed'    },
}

export default function PaymentStatusRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const t = useTranslations()
  const { status, paymentIntentId, amountUsd } = item.data as { status: Status; paymentIntentId: string; amountUsd: number }
  const meta = STATUS_META[status] ?? { className: 'bg-gray-100 text-gray-900 ring-1 ring-gray-700/40', Icon: Clock, labelKey: 'paymentStatus.pending' }
  const { Icon } = meta
  return (
    <div className="p-4 flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${meta.className}`}
        aria-label={t(meta.labelKey)}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{t(meta.labelKey)}</span>
      </span>
      <p className="text-lg font-bold">{formatCurrency(amountUsd, locale)}</p>
      {status === 'FAILED' && (
        <button onClick={() => onAction('retry_payment', paymentIntentId, { paymentIntentId })} className="text-sm bg-primary text-primary-foreground rounded-md px-4 py-2">
          {t('paymentStatus.retry')}
        </button>
      )}
    </div>
  )
}
