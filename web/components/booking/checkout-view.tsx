'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { AbaQrPanel } from '@/components/booking/aba-qr-panel'
import { StripeCardForm } from '@/components/booking/stripe-card-form'
import { Price } from '@/components/shared/price'
import { Badge, Button, EmptyState, LoadingRegion, Skeleton, buttonVariants } from '@/components/ui'
import { useSession } from '@/hooks/use-auth'
import {
  useBooking,
  useCancelBooking,
} from '@/hooks/use-bookings'
import { useCountdown } from '@/hooks/use-countdown'
import { useHydrated } from '@/hooks/use-hydrated'
import { usePaymentStatus } from '@/hooks/use-payment-status'
import { useStartPayment } from '@/hooks/use-payments'
import { bookingIcalUrl } from '@/lib/api/bookings'
import { ApiError, ApiErrorCode } from '@/lib/api/errors'
import {
  PAYMENT_INTENT_METHODS,
  type PaymentIntentMethod,
  type StartPaymentResult,
} from '@/lib/api/payments'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import {
  isAwaitingPayment,
  isCancellable,
  previewRefundPercentage,
  type Booking,
} from '@/schemas/booking'

/**
 * Booking review and payment.
 *
 * Implements NAVEL Travel UI Kit `Create Booking - Payment` and `Create Booking - Success`
 * with mobile-first cards, countdown timer, Cambodian ABA KHQR & Card payments, and celebration state.
 */
export function CheckoutView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout')
  const tCommon = useTranslations('common')

  const hydrated = useHydrated()
  const { user, ready } = useSession()
  const booking = useBooking(bookingId)

  const tAuth = useTranslations('auth')

  if (!hydrated || !ready) {
    return (
      <LoadingRegion label={tCommon('loading')}>
        <Skeleton className="h-64 w-full rounded-[28px]" />
      </LoadingRegion>
    )
  }

  if (!user) {
    return (
      <EmptyState
        title={tAuth('title')}
        description={t('confirmation.pendingDesc')}
        action={
          <Link
            href={`/login?next=/bookings/${bookingId}`}
            className={cn(buttonVariants({ variant: 'navelPrimary', size: 'sm' }))}
          >
            {tAuth('login')}
          </Link>
        }
      />
    )
  }

  if (booking.isPending) {
    return (
      <LoadingRegion label={t('confirmation.loading')}>
        <Skeleton className="h-64 w-full rounded-[28px]" />
      </LoadingRegion>
    )
  }

  if (booking.isError) {
    return (
      <EmptyState
        title={t('confirmation.errorTitle')}
        description={t('confirmation.errorDesc')}
        action={
          <Button variant="secondary" size="sm" onClick={() => booking.refetch()}>
            {t('confirmation.retry')}
          </Button>
        }
      />
    )
  }

  return <CheckoutBody booking={booking.data} />
}

function CheckoutBody({ booking }: { booking: Booking }) {
  const t = useTranslations('checkout')
  const tBooking = useTranslations('booking')

  const queryClient = useQueryClient()
  const startPayment = useStartPayment()

  const [method, setMethod] = React.useState<PaymentIntentMethod>('card')
  const [intent, setIntent] = React.useState<StartPaymentResult | null>(null)

  const [returnedFromStripe] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('redirect_status')
  })

  const paymentStarted = Boolean(intent) || returnedFromStripe

  const paymentStatus = usePaymentStatus({
    bookingId: booking.id,
    enabled: paymentStarted,
  })
  const state = paymentStatus.data?.state
  const succeeded = state === 'SUCCEEDED'
  const failed = state === 'FAILED' || state === 'CANCELLED'

  const countdown = useCountdown(booking.holdExpiresAt ?? undefined)
  const holdExpired = countdown?.expired ?? false
  const awaitingPayment = isAwaitingPayment(booking.status)

  React.useEffect(() => {
    if (succeeded) queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }, [succeeded, queryClient])

  function start(nextMethod: PaymentIntentMethod) {
    startPayment.mutate(
      { bookingId: booking.id, method: nextMethod },
      { onSuccess: (result) => setIntent(result) },
    )
  }

  function changeMethod() {
    setIntent(null)
    startPayment.reset()
  }

  // Already settled server-side: show the outcome, not a payment form.
  if (!awaitingPayment) {
    return <SettledBooking booking={booking} />
  }

  if (succeeded) {
    return (
      <div className="flex flex-col gap-4">
        <BookingSummary booking={booking} />
        <div
          className="rounded-[24px] border border-[var(--color-navel-jade)]/30 bg-[var(--color-navel-jade)]/10 p-5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-[var(--color-navel-jade)] shrink-0" />
            <p className="text-sm font-semibold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
              {t('confirming')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (holdExpired) {
    return (
      <div className="flex flex-col gap-4">
        <BookingSummary booking={booking} />
        <div
          className="rounded-[24px] border border-[var(--tone-danger-border,#f87171)]/30 bg-[var(--tone-danger-bg)] p-5"
          role="alert"
        >
          <h2 className="text-base font-bold text-[var(--tone-danger-text)]">
            {t('review.expiredTitle')}
          </h2>
          <p className="mt-1 text-sm text-[var(--tone-danger-text)]">{t('review.expiredDesc')}</p>
          <Link
            href="/trips"
            className={cn(buttonVariants({ variant: 'navelSecondary', size: 'sm' }), 'mt-4 inline-flex')}
          >
            {t('review.startOver')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[var(--color-navel-jade)]">
            DerLg Checkout
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
            {t('review.title')}
          </h1>
        </div>
        {countdown ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-navel-cream)]/80 dark:bg-[var(--surface-sunken)] px-3 py-1.5 text-xs font-semibold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-gold)] border border-[var(--border-subtle)]"
            aria-live="polite"
            aria-atomic="true"
          >
            <Clock className="size-3.5 text-[var(--color-navel-gold)]" />
            {tBooking('expiresIn', { minutes: countdown.minutes, seconds: countdown.seconds })}
          </div>
        ) : null}
      </div>

      <BookingSummary booking={booking} />

      {startPayment.isError ? (
        <div
          className="rounded-2xl bg-[var(--tone-danger-bg)] px-4 py-3 text-sm text-[var(--tone-danger-text)] border border-[var(--tone-danger-border,#f87171)]/30"
          role="alert"
        >
          {t(`errors.${startErrorKey(startPayment.error)}`)}
        </div>
      ) : null}

      {!intent && failed ? (
        <div
          className="rounded-2xl bg-[var(--tone-danger-bg)] px-4 py-3 text-sm text-[var(--tone-danger-text)] border border-[var(--tone-danger-border,#f87171)]/30"
          role="alert"
        >
          {t('failed')}
        </div>
      ) : null}

      {intent ? (
        <>
          <PaymentInstrument
            intent={intent}
            onRegenerate={() => start('aba_qr')}
            regenerating={startPayment.isPending}
          />
          <Button variant="link" size="sm" className="self-start text-[var(--color-navel-jade)]" onClick={changeMethod}>
            {t('changeMethod')}
          </Button>
        </>
      ) : returnedFromStripe && !failed ? (
        <div
          className="rounded-2xl bg-[var(--surface-sunken)] px-4 py-3 text-sm text-[var(--text-secondary)]"
          role="status"
          aria-live="polite"
        >
          {t('completing')}
        </div>
      ) : (
        <MethodPicker
          method={method}
          onMethod={setMethod}
          onPay={() => start(method)}
          paying={startPayment.isPending}
        />
      )}

      <p className="text-xs text-center text-[var(--text-tertiary)]">{t('review.holdNotice')}</p>
    </div>
  )
}

/** Method cards plus the demo notice and payment action button matching NAVEL Card/Payment. */
function MethodPicker({
  method,
  onMethod,
  onPay,
  paying,
}: {
  method: PaymentIntentMethod
  onMethod: (next: PaymentIntentMethod) => void
  onPay: () => void
  paying: boolean
}) {
  const t = useTranslations('checkout')
  const tBookings = useTranslations('bookings')

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-bold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          {t('method.title')}
        </legend>

        <div className="flex flex-col gap-3" role="radiogroup" aria-label={t('method.title')}>
          {PAYMENT_INTENT_METHODS.map((option) => {
            const isSelected = method === option

            if (option === 'card') {
              return (
                <label
                  key={option}
                  className={cn(
                    'relative block cursor-pointer rounded-[24px] p-5 transition-all shadow-sm',
                    isSelected
                      ? 'border-2 border-[var(--color-navel-jade)] ring-4 ring-[var(--color-navel-jade)]/15 shadow-md'
                      : 'border-2 border-transparent hover:border-[var(--border-subtle)] opacity-95',
                    'bg-gradient-to-br from-[#1B3232] via-[#244444] to-[#1B3232] text-white',
                  )}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option}
                    checked={isSelected}
                    onChange={() => onMethod(option)}
                    className="sr-only"
                  />

                  {/* Top Bar: Chips + Logos + Radio Check */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-6 rounded-md bg-gradient-to-tr from-[#E7B171] to-[#F5EADD] opacity-90 shadow-sm" />
                      <CreditCard className="size-4 text-[var(--color-navel-mint)]/70" />
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex -space-x-2">
                        <div className="size-5 rounded-full bg-[#EA001B] opacity-90" />
                        <div className="size-5 rounded-full bg-[#FFA200] opacity-90" />
                      </div>
                      <span className="text-xs font-black tracking-widest uppercase text-white/80">VISA</span>
                      <div
                        className={cn(
                          'size-5 rounded-full flex items-center justify-center border-2 transition-colors ml-1',
                          isSelected
                            ? 'bg-[var(--color-navel-jade)] border-[var(--color-navel-jade)] text-white'
                            : 'border-white/40 bg-white/10',
                        )}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                  {/* Masked Card Number */}
                  <div className="tracking-[0.25em] font-mono text-base font-semibold text-[var(--color-navel-mint)]/90 mb-4">
                    •••• •••• •••• 4242
                  </div>

                  {/* Footer Details */}
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Payment Method</div>
                      <div className="font-semibold text-white/95">{t('method.card')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Expires</div>
                      <div className="font-semibold text-white/95">12 / 28</div>
                    </div>
                  </div>
                </label>
              )
            }

            return (
              <label
                key={option}
                className={cn(
                  'relative flex items-center justify-between rounded-[24px] p-4 cursor-pointer transition-all border-2 bg-[var(--surface)] dark:bg-[var(--surface-sunken)]',
                  isSelected
                    ? 'border-[var(--color-navel-jade)] ring-4 ring-[var(--color-navel-jade)]/15 shadow-md'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]',
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option}
                  checked={isSelected}
                  onChange={() => onMethod(option)}
                  className="sr-only"
                />

                <div className="flex items-center gap-3.5">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[#004A6B]/10 dark:bg-[#004A6B]/30 text-[#004A6B] dark:text-[#53bde6]">
                    <QrCode className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
                        {t('method.aba_qr')}
                      </span>
                      <span className="rounded bg-[#E21A22] px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                        KHQR
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Instant scan with ABA Mobile, Bakong, or any bank
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    'size-5 rounded-full flex items-center justify-center border-2 transition-colors shrink-0',
                    isSelected
                      ? 'bg-[var(--color-navel-jade)] border-[var(--color-navel-jade)] text-white'
                      : 'border-[var(--border-strong)] bg-transparent',
                  )}
                >
                  {isSelected && <Check className="size-3 stroke-[3]" />}
                </div>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-navel-cream)]/70 dark:bg-[var(--surface-sunken)] p-3.5 text-xs text-[var(--text-secondary)] border border-[var(--border-subtle)]">
        <ShieldCheck className="size-4 text-[var(--color-navel-jade)] shrink-0" />
        <p>{t('mockNotice')}</p>
      </div>

      <div className="flex flex-col gap-2.5 pt-2">
        <Button
          variant="navelPrimary"
          size="xl"
          className="w-full py-4 text-base font-semibold shadow-lg shadow-[#1B3232]/20"
          loading={paying}
          onClick={onPay}
        >
          {t('card.pay')}
        </Button>
        <Link
          href="/bookings"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-center text-[var(--text-secondary)]')}
        >
          {tBookings('detail.cancel')}
        </Link>
      </div>
    </div>
  )
}

/** Renders the method-specific instrument once a payment has been started. */
function PaymentInstrument({
  intent,
  onRegenerate,
  regenerating,
}: {
  intent: StartPaymentResult
  onRegenerate: () => void
  regenerating: boolean
}) {
  if (intent.method === 'aba_qr') {
    return (
      <AbaQrPanel
        qrImageDataUrl={intent.qrImageDataUrl ?? undefined}
        amountUsd={intent.amountUsd}
        expiresAt={intent.expiresAt ?? undefined}
        onRegenerate={onRegenerate}
        regenerating={regenerating}
      />
    )
  }

  return <StripeCardForm clientSecret={intent.clientSecret ?? undefined} />
}

function startErrorKey(error: unknown): 'methodUnavailable' | 'rateLimited' | 'startFailed' {
  if (error instanceof ApiError) {
    if (error.code === ApiErrorCode.PAY_METHOD_NOT_SUPPORTED) return 'methodUnavailable'
    if (error.isRateLimited) return 'rateLimited'
  }
  return 'startFailed'
}

/** Shared summary of what is being paid for matching NAVEL card aesthetic. */
function BookingSummary({ booking }: { booking: Booking }) {
  const t = useTranslations('checkout')
  const tBookings = useTranslations('bookings')

  return (
    <section
      aria-label={tBookings('detail.items')}
      className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
        <div>
          <h2 className="text-base font-bold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
            {booking.name ?? booking.reference}
          </h2>
          {booking.location ? (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{booking.location}</p>
          ) : null}
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <dl className="mt-3 flex flex-col gap-2">
        <Row label={tBookings('detail.reference')} value={booking.reference} mono />
        {booking.startDate ? (
          <Row
            label={tBookings('detail.dates')}
            value={
              booking.endDate && booking.endDate !== booking.startDate
                ? `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`
                : formatDate(booking.startDate)
            }
          />
        ) : null}
      </dl>

      {booking.items && booking.items.length > 0 ? (
        <dl className="mt-3 flex flex-col gap-1.5 border-t border-[var(--border-subtle)] pt-3">
          {booking.items.map((item) => (
            <div key={item.id} className="flex items-baseline justify-between gap-2">
              <dt className="text-sm text-[var(--text-secondary)]">
                {item.name ?? booking.reference}
                {item.quantity && item.quantity > 1 ? (
                  <span className="text-[var(--text-tertiary)]"> × {item.quantity}</span>
                ) : null}
              </dt>
              <dd className="text-sm font-semibold text-[var(--text-primary)]">
                <Price amountUsd={item.totalPriceUsd ?? item.subtotalUsd ?? 0} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
        <p className="text-base font-bold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          {t('total')}
        </p>
        <p className="text-xl font-extrabold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-gold)]">
          <Price amountUsd={booking.totalPriceUsd} />
        </p>
      </div>

      {booking.specialRequests ? (
        <p className="mt-3 text-xs text-[var(--text-tertiary)] bg-[var(--surface-sunken)] dark:bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
          <span className="font-semibold text-[var(--text-secondary)]">{tBookings('detail.specialRequests')}: </span>
          {booking.specialRequests}
        </p>
      ) : null}
    </section>
  )
}

/** Confirmed, cancelled or expired: NAVEL celebration or status outcome. */
function SettledBooking({ booking }: { booking: Booking }) {
  const t = useTranslations('checkout')
  const tBookings = useTranslations('bookings')
  const [showCancelPrompt, setShowCancelPrompt] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const cancelBooking = useCancelBooking()

  const confirmed = booking.status === 'CONFIRMED' || booking.status === 'COMPLETED'
  const canCancel = isCancellable(booking.status)
  const refundPercent = booking.startDate ? previewRefundPercentage(booking.startDate) : 0

  return (
    <div className="flex flex-col gap-5">
      {confirmed ? (
        /* NAVEL Create Booking - Success Celebration */
        <div className="flex flex-col items-center text-center pt-4 pb-2">
          {/* Concentric Pulse Rings (Item/Booking/success) */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="size-36 rounded-full bg-[var(--color-navel-jade)]/10 animate-pulse flex items-center justify-center">
              <div className="size-24 rounded-full bg-[var(--color-navel-jade)]/20 flex items-center justify-center">
                <div className="size-14 rounded-full bg-[var(--color-navel-jade)] text-white flex items-center justify-center shadow-lg shadow-[var(--color-navel-jade)]/30">
                  <Check className="size-7 stroke-[3]" />
                </div>
              </div>
            </div>
            <Sparkles className="absolute top-0 right-2 size-5 text-[var(--color-navel-gold)] animate-bounce" />
          </div>

          <h1
            role="status"
            aria-live="polite"
            className="font-dela text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]"
          >
            {t('confirmation.title')}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-xs">
            {t('confirmation.message')}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'rounded-[24px] border border-[var(--border-default)] p-4',
            'bg-[var(--surface-sunken)]',
          )}
        >
          <h1 className="text-lg font-bold text-[var(--text-primary)]" role="status">
            {tBookings(`status.${statusKey(booking.status)}`)}
          </h1>

          {booking.refundPercentage !== null && booking.refundPercentage !== undefined ? (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {tBookings('detail.refunded')}:{' '}
              <Price amountUsd={booking.refundAmountUsd ?? 0} /> (
              {tBookings('cancel.refundTier', { percent: booking.refundPercentage })})
            </p>
          ) : null}
        </div>
      )}

      <BookingSummary booking={booking} />

      {booking.qrCodeUrl ? (
        <section
          aria-label={tBookings('detail.qrTitle')}
          className="flex flex-col items-center gap-3 rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] p-5 text-center shadow-sm"
        >
          <div>
            <h2 className="text-sm font-bold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
              {tBookings('detail.qrTitle')}
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Show this QR code at check-in or boarding
            </p>
          </div>
          <div className="size-44 overflow-hidden rounded-2xl bg-white p-2.5 shadow-inner border border-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={booking.qrCodeUrl}
              alt={`${tBookings('detail.reference')} ${booking.reference}`}
              className="size-full object-contain"
            />
          </div>
        </section>
      ) : null}

      {showCancelPrompt ? (
        <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface)] p-4 space-y-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {tBookings('cancel.title')}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">{tBookings('cancel.policy')}</p>
          <p className="text-xs font-semibold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
            {tBookings('cancel.refundTier', { percent: refundPercent })}
          </p>
          <input
            type="text"
            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface)] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-navel-jade)]"
            placeholder={tBookings('cancel.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {cancelBooking.isError ? (
            <p className="text-xs text-[var(--tone-danger-text)]">
              {tBookings('cancel.error')}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={cancelBooking.isPending}
              onClick={() =>
                cancelBooking.mutate(
                  { id: booking.id, reason: reason.trim() || undefined },
                  { onSuccess: () => setShowCancelPrompt(false) },
                )
              }
            >
              {tBookings('cancel.confirm')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={cancelBooking.isPending}
              onClick={() => setShowCancelPrompt(false)}
            >
              {tBookings('cancel.keep')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 pt-2">
        {confirmed ? (
          <a
            href={bookingIcalUrl(booking.id)}
            download={`booking-${booking.reference}.ics`}
            className={cn(buttonVariants({ variant: 'navelSecondary', size: 'lg' }), 'w-full justify-center')}
          >
            <Calendar className="size-4 mr-2" />
            {tBookings('detail.addToCalendar')}
          </a>
        ) : null}

        <Link
          href="/bookings"
          className={cn(buttonVariants({ variant: confirmed ? 'navelPrimary' : 'secondary', size: 'lg' }), 'w-full justify-center')}
        >
          {tBookings('list.title')}
        </Link>

        {confirmed && canCancel && !showCancelPrompt ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCancelPrompt(true)}
            className="text-[var(--tone-danger-text)] hover:bg-[var(--tone-danger-bg)] mt-1"
          >
            {tBookings('detail.cancel')}
          </Button>
        ) : null}

        <Link href="/trips" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-center')}>
          {t('confirmation.bookAnother')}
        </Link>
      </div>
    </div>
  )
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  CONFIRMED: 'success',
  COMPLETED: 'success',
  HOLD: 'warning',
  PENDING_PAYMENT: 'warning',
  PAYMENT_FAILED: 'danger',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  NO_SHOW: 'neutral',
}

export function StatusBadge({ status }: { status: string }) {
  const tBookings = useTranslations('bookings')
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'}>
      {tBookings(`status.${statusKey(status)}`)}
    </Badge>
  )
}

function statusKey(status: string): string {
  return status in STATUS_TONE ? status : 'HOLD'
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-[var(--text-tertiary)]">{label}</dt>
      <dd className={cn('text-sm font-medium text-[var(--text-secondary)]', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

function formatDate(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
