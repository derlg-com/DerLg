'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { cancelBooking, type CancelResult } from '@/lib/bookings-api'
import {
  refundTier,
  refundAmount,
  CANCELLATION_REASONS,
  resolveCancellationReason,
  type CancellationReason,
} from '@/lib/bookings-display'
import { formatCurrency } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'

export interface CancelBookingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  startDate: string
  totalUsd: number
  onCancelled: () => void
}

export function CancelBookingModal({
  open,
  onOpenChange,
  bookingId,
  startDate,
  totalUsd,
  onCancelled,
}: CancelBookingModalProps) {
  const t = useTranslations('bookings')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const [reasonCode, setReasonCode] = useState<CancellationReason | ''>('')
  const [otherReason, setOtherReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CancelResult | null>(null)

  // Reset transient state when the dialog closes so reopening starts fresh.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setReasonCode('')
      setOtherReason('')
      setSubmitting(false)
      setResult(null)
    }
    onOpenChange(next)
  }

  const tier = refundTier(startDate)
  const amount = refundAmount(totalUsd, startDate)
  // Requirement 40.3: a reason must be selected before confirming.
  const canConfirm = reasonCode !== '' && (reasonCode !== 'other' || otherReason.trim().length > 0)

  function confirm() {
    if (reasonCode === '') return
    const reason = resolveCancellationReason(
      reasonCode,
      t(`cancel.reasons.${reasonCode}`),
      otherReason,
    )
    setSubmitting(true)
    cancelBooking(bookingId, reason)
      .then((res) => {
        // Requirement 40.5: show cancellation confirmation with refund timeline.
        setResult(res)
        setSubmitting(false)
        toast({ title: t('cancel.success'), variant: 'success' })
        // Requirement 40.6: refetch so the My Trip status badge updates to "cancelled".
        onCancelled()
      })
      .catch(() => {
        setSubmitting(false)
        toast({ title: t('cancel.error'), variant: 'error' })
      })
  }

  // Confirmation view (after a successful cancellation).
  if (result) {
    const refunded = result.refundAmountUsd ?? amount
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancel.confirmedTitle')}</DialogTitle>
            <DialogDescription>{t('cancel.confirmedDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
            <p className="font-semibold text-foreground">
              {t('cancel.refundAmount')}: {formatCurrency(refunded, locale, currency)}
            </p>
            <p className="text-muted-foreground">{t('cancel.refundTimeline')}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>{t('cancel.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancel.title')}</DialogTitle>
          <DialogDescription>{t('cancel.policy')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
          <p className="text-muted-foreground">
            {t('cancel.refundTier', { percent: tier.percentage })}
          </p>
          <p className="font-semibold text-foreground">
            {t('cancel.refundAmount')}: {formatCurrency(amount, locale, currency)}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="cancel-reason" className="text-sm font-medium text-foreground">
            {t('cancel.reasonLabel')}
          </label>
          <Select
            id="cancel-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as CancellationReason | '')}
          >
            <option value="" disabled>
              {t('cancel.reasonSelect')}
            </option>
            {CANCELLATION_REASONS.map((code) => (
              <option key={code} value={code}>
                {t(`cancel.reasons.${code}`)}
              </option>
            ))}
          </Select>
          {reasonCode === 'other' ? (
            <Textarea
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder={t('cancel.reasonPlaceholder')}
              aria-label={t('cancel.reasonPlaceholder')}
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('cancel.keep')}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={submitting || !canConfirm}>
            {submitting ? (
              <Spinner size="sm" className="text-destructive-foreground" />
            ) : (
              t('cancel.confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
