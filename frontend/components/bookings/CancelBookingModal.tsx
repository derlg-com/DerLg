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
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { cancelBooking } from '@/lib/bookings-api'
import { refundTier, refundAmount } from '@/lib/bookings-display'
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
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tier = refundTier(startDate)
  const amount = refundAmount(totalUsd, startDate)

  function confirm() {
    setSubmitting(true)
    cancelBooking(bookingId, reason)
      .then(() => {
        toast({ title: t('cancel.success'), variant: 'success' })
        onCancelled()
        onOpenChange(false)
      })
      .catch(() => {
        setSubmitting(false)
        toast({ title: t('cancel.error'), variant: 'error' })
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancel.title')}</DialogTitle>
          <DialogDescription>{t('cancel.policy')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
          <p className="text-muted-foreground">{t('cancel.refundTier', { percent: tier.percentage })}</p>
          <p className="font-semibold text-foreground">
            {t('cancel.refundAmount')}: {formatCurrency(amount, locale, currency)}
          </p>
        </div>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('cancel.reasonPlaceholder')}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel.keep')}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={submitting}>
            {submitting ? <Spinner size="sm" className="text-destructive-foreground" /> : t('cancel.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
