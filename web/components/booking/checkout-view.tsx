'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { AbaQrPanel } from '@/components/booking/aba-qr-panel'
import { StripeCardForm } from '@/components/booking/stripe-card-form'
import { Price } from '@/components/shared/price'
import { Badge, Button, EmptyState, LoadingRegion, Skeleton, buttonVariants } from '@/components/ui'
import { useSession } from '@/hooks/use-auth'
import { useBooking } from '@/hooks/use-bookings'
import { useCountdown } from '@/hooks/use-countdown'
import { useHydrated } from '@/hooks/use-hydrated'
import { usePaymentStatus } from '@/hooks/use-payment-status'
import { useStartPayment } from '@/hooks/use-payments'
import { ApiError, ApiErrorCode } from '@/lib/api/errors'
import {
  PAYMENT_INTENT_METHODS,
  type PaymentIntentMethod,
  type StartPaymentResult,
} from '@/lib/api/payments'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import { isAwaitingPayment, type Booking } from '@/schemas/booking'

/**
 * Booking review and payment.
 *
 * The hold is the thing under time pressure, so it leads: a live countdown, and once
 * it lapses the payment controls are replaced by an explanation rather than left
 * there to fail.
 */
export function CheckoutView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout')
  const tBookings = useTranslations('bookings')
  const tCommon = useTranslations('common')

  const hydrated = useHydrated()
  const { user, ready } = useSession()
  const booking = useBooking(bookingId)

  const tAuth = useTranslations('auth')

  if (!hydrated || !ready) {
    return (
      <LoadingRegion label={tCommon('loading')}>
        <Skeleton className="h-64 w-full" />
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
            className={cn(buttonVariants({ size: 'sm' }))}
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
        <Skeleton className="h-64 w-full" />
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

  /*
   * A 3DS card challenge leaves the page and returns with Stripe's query params.
   * Read once, on mount, and SSR-safe (guests and the server see `false`): on a
   * redirect return the local `intent` state is gone, so this keeps the poll alive
   * and shows a "completing" state instead of dropping the user back onto method
   * selection for a payment that may already be settling.
   */
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

  /*
   * Once the webhook (card) or credit alert (ABA) settles the payment, pull the
   * fresh — now confirmed — booking so the confirmation view replaces the payment
   * controls. The browser never marks it paid; it only reacts to the server's word.
   */
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

  /*
   * Payment cleared but the booking refetch is still in flight: announce it rather
   * than briefly re-show a pay button for a booking that is already paid.
   */
  if (succeeded) {
    return (
      <div className="flex flex-col gap-4">
        <BookingSummary booking={booking} />
        <div
          className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--tone-success-bg)] p-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-[var(--tone-success-text)]">{t('confirming')}</p>
        </div>
      </div>
    )
  }

  if (holdExpired) {
    return (
      <div className="flex flex-col gap-4">
        <BookingSummary booking={booking} />
        <div
          className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--tone-danger-bg)] p-4"
          role="alert"
        >
          <h2 className="text-sm font-semibold text-[var(--tone-danger-text)]">
            {t('review.expiredTitle')}
          </h2>
          {/* Reassurance first: nothing was taken. */}
          <p className="mt-1 text-sm text-[var(--tone-danger-text)]">{t('review.expiredDesc')}</p>
          <Link
            href="/trips"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3')}
          >
            {t('review.startOver')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('review.title')}</h1>
        {countdown ? (
          <p
            className="text-sm font-medium text-[var(--text-secondary)]"
            // Polite and atomic: the value changes every second.
            aria-live="polite"
            aria-atomic="true"
          >
            {tBooking('expiresIn', { minutes: countdown.minutes, seconds: countdown.seconds })}
          </p>
        ) : null}
      </div>

      <BookingSummary booking={booking} />

      {startPayment.isError ? (
        <div
          className="rounded-[var(--radius-md)] bg-[var(--tone-danger-bg)] px-3 py-2 text-sm text-[var(--tone-danger-text)]"
          role="alert"
        >
          {t(`errors.${startErrorKey(startPayment.error)}`)}
        </div>
      ) : null}

      {/* A payment that failed after a redirect return has no local form to own
          its own error, so surface it here and fall back to method selection. */}
      {!intent && failed ? (
        <div
          className="rounded-[var(--radius-md)] bg-[var(--tone-danger-bg)] px-3 py-2 text-sm text-[var(--tone-danger-text)]"
          role="alert"
        >
          {t('failed')}
        </div>
      ) : null}

      {intent ? (
        <PaymentInstrument
          intent={intent}
          onRegenerate={() => start('aba_qr')}
          regenerating={startPayment.isPending}
        />
      ) : returnedFromStripe && !failed ? (
        <div
          className="rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-secondary)]"
          role="status"
          aria-live="polite"
        >
          {t('completing')}
        </div>
      ) : (
        <MethodPicker
          method={method}
          onMethod={setMethod}
          onProceed={() => start(method)}
          starting={startPayment.isPending}
        />
      )}

      {intent ? (
        <Button variant="link" size="sm" className="self-start" onClick={changeMethod}>
          {t('changeMethod')}
        </Button>
      ) : null}

      <p className="text-xs text-[var(--text-tertiary)]">{t('review.holdNotice')}</p>
    </div>
  )
}

/** Method radios plus the button that starts the payment. */
function MethodPicker({
  method,
  onMethod,
  onProceed,
  starting,
}: {
  method: PaymentIntentMethod
  onMethod: (next: PaymentIntentMethod) => void
  onProceed: () => void
  starting: boolean
}) {
  const t = useTranslations('checkout')
  const tBookings = useTranslations('bookings')

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
        <legend className="px-1 text-sm font-semibold text-[var(--text-primary)]">
          {t('method.title')}
        </legend>

        <div className="mt-1 flex flex-col gap-1.5">
          {PAYMENT_INTENT_METHODS.map((option) => (
            <label
              key={option}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
            >
              <input
                type="radio"
                name="paymentMethod"
                value={option}
                checked={method === option}
                onChange={() => onMethod(option)}
                className="size-4 accent-[var(--accent)]"
              />
              {t(`method.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button loading={starting} onClick={onProceed}>
          {t('proceed')}
        </Button>
        <Link href="/bookings" className={cn(buttonVariants({ variant: 'ghost' }))}>
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

/**
 * Maps a start-payment failure to a message key.
 *
 * `PAY_METHOD_NOT_SUPPORTED` means the provider is not configured on this server
 * (Stripe returns it as 503, ABA as 400) — a deployment state, not user error, so
 * it earns its own message. A 429 is the payment rate limit, worth its own "wait a
 * moment" rather than a generic failure.
 */
function startErrorKey(error: unknown): 'methodUnavailable' | 'rateLimited' | 'startFailed' {
  if (error instanceof ApiError) {
    if (error.code === ApiErrorCode.PAY_METHOD_NOT_SUPPORTED) return 'methodUnavailable'
    if (error.isRateLimited) return 'rateLimited'
  }
  return 'startFailed'
}

/** Shared summary of what is being paid for. */
function BookingSummary({ booking }: { booking: Booking }) {
  const t = useTranslations('checkout')
  const tBookings = useTranslations('bookings')

  return (
    <section
      aria-label={tBookings('detail.items')}
      className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {booking.name ?? booking.reference}
          </h2>
          {booking.location ? (
            <p className="text-xs text-[var(--text-tertiary)]">{booking.location}</p>
          ) : null}
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <dl className="mt-2 flex flex-col gap-1">
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
        <dl className="mt-2 flex flex-col gap-1 border-t border-[var(--border-subtle)] pt-2">
          {booking.items.map((item) => (
            <div key={item.id} className="flex items-baseline justify-between gap-2">
              <dt className="text-sm text-[var(--text-secondary)]">
                {item.name ?? booking.reference}
                {item.quantity && item.quantity > 1 ? (
                  <span className="text-[var(--text-tertiary)]"> × {item.quantity}</span>
                ) : null}
              </dt>
              <dd className="text-sm text-[var(--text-primary)]">
                <Price amountUsd={item.totalPriceUsd ?? item.subtotalUsd ?? 0} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{t('total')}</p>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          <Price amountUsd={booking.totalPriceUsd} />
        </p>
      </div>

      {booking.specialRequests ? (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          <span className="font-medium">{tBookings('detail.specialRequests')}: </span>
          {booking.specialRequests}
        </p>
      ) : null}
    </section>
  )
}

/** Confirmed, cancelled or expired: no payment controls, just the outcome. */
function SettledBooking({ booking }: { booking: Booking }) {
  const t = useTranslations('checkout')
  const tBookings = useTranslations('bookings')

  const confirmed = booking.status === 'CONFIRMED' || booking.status === 'COMPLETED'

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'rounded-[var(--radius-lg)] border border-[var(--border-default)] p-4',
          confirmed ? 'bg-[var(--tone-success-bg)]' : 'bg-[var(--surface-sunken)]',
        )}
      >
        {/* A confirmation is announced, not merely shown. */}
        <h1
          className={cn(
            'text-lg font-semibold',
            confirmed ? 'text-[var(--tone-success-text)]' : 'text-[var(--text-primary)]',
          )}
          role="status"
        >
          {confirmed ? t('confirmation.title') : tBookings(`status.${statusKey(booking.status)}`)}
        </h1>

        {confirmed ? (
          <p className="mt-1 text-sm text-[var(--tone-success-text)]">
            {t('confirmation.message')}
          </p>
        ) : null}

        {booking.refundPercentage !== null && booking.refundPercentage !== undefined ? (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {tBookings('detail.refunded')}:{' '}
            <Price amountUsd={booking.refundAmountUsd ?? 0} /> (
            {tBookings('cancel.refundTier', { percent: booking.refundPercentage })})
          </p>
        ) : null}
      </div>

      <BookingSummary booking={booking} />

      {booking.qrCodeUrl ? (
        <section
          aria-label={tBookings('detail.qrTitle')}
          className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {tBookings('detail.qrTitle')}
          </h2>
          {/* White quiet zone is required for reliable QR scanning. */}
          <div className="size-40 overflow-hidden rounded-[var(--radius-md)] bg-white p-2">
            {/* Runtime URL from the API, so a plain <img> rather than next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={booking.qrCodeUrl}
              alt={`${tBookings('detail.reference')} ${booking.reference}`}
              className="size-full object-contain"
            />
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/bookings" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
          {tBookings('list.title')}
        </Link>
        <Link href="/trips" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
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

/**
 * Guards the status lookup.
 *
 * The API returns uppercase statuses and the catalogue now has all eight, but an
 * unknown one must not render a raw enum or blow up on a missing key.
 */
function statusKey(status: string): string {
  return status in STATUS_TONE ? status : 'HOLD'
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-[var(--text-tertiary)]">{label}</dt>
      <dd className={cn('text-sm text-[var(--text-secondary)]', mono && 'font-mono')}>{value}</dd>
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
