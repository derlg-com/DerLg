'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Price } from '@/components/shared/price'
import { Badge, Button, buttonVariants } from '@/components/ui'
import { useCountdown } from '@/hooks/use-countdown'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import type { ContentPayload } from '@/schemas/vibe-payloads'

/**
 * Booking and payment blocks.
 *
 * These are the only blocks that move money, so they are deliberately the most
 * conservative:
 *  - a hold shows a LIVE countdown and disables its confirm button on expiry,
 *    because a button that silently fails is worse than a disabled one;
 *  - payment confirmation is offered only when the agent could actually accept it
 *    (signed in, with a booking reference), since the agent refuses unverifiable
 *    claims and a guest pressing "I've paid" would just get an error;
 *  - the card block does NOT render card inputs at all — see StripeCardFormBlock.
 */

export interface BookingBlockContext {
  onAsk: (text: string) => void
  /** Tells the agent payment finished. The agent re-verifies; it never trusts this. */
  onPaymentCompleted?: (bookingId: string) => void
  /** The agent rejects payment claims from unauthenticated sessions. */
  isAuthenticated?: boolean
}

function Panel({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'warning' | 'success' | 'danger'
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-[var(--border-default)] bg-[var(--tone-warning-bg)]'
      : tone === 'success'
        ? 'border-[var(--border-default)] bg-[var(--tone-success-bg)]'
        : tone === 'danger'
          ? 'border-[var(--border-default)] bg-[var(--tone-danger-bg)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface)]'

  return <div className={cn('rounded-[var(--radius-lg)] border p-3', toneClass)}>{children}</div>
}

/** Live hold countdown, or an expiry notice once it runs out. */
function HoldTimer({ expiresAt }: { expiresAt: string | undefined }) {
  const t = useTranslations('booking')
  const countdown = useCountdown(expiresAt)

  if (!countdown) return null

  if (countdown.expired) {
    return (
      <p className="text-xs font-medium text-[var(--tone-danger-text)]" role="status">
        {t('expired')}
      </p>
    )
  }

  return (
    <p
      className="text-xs font-medium text-[var(--text-secondary)]"
      // Polite: the number changes every second, so an assertive region would
      // interrupt the user continuously.
      aria-live="polite"
      aria-atomic="true"
    >
      {t('expiresIn', { minutes: countdown.minutes, seconds: countdown.seconds })}
    </p>
  )
}

/* --------------------------------------------------------- booking summary */

type BookingSummary = Extract<ContentPayload, { type: 'booking_summary' }>['data']

export function BookingSummaryBlock({
  data,
  context,
}: {
  data: BookingSummary
  context: BookingBlockContext
}) {
  const t = useTranslations('booking')
  const tCheckout = useTranslations('checkout')
  const countdown = useCountdown(data.holdExpiresAt)
  const expired = countdown?.expired ?? false

  return (
    <Panel>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t('summary')}</h4>
            <p className="text-sm text-[var(--text-secondary)]">{data.itemName}</p>
          </div>
          <HoldTimer expiresAt={data.holdExpiresAt} />
        </div>

        <dl className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-[var(--text-tertiary)]">{t('travelDate')}</dt>
            <dd className="text-sm text-[var(--text-secondary)]">{formatDate(data.travelDate)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-[var(--text-tertiary)]">
              {t('travellers', { count: data.peopleCount })}
            </dt>
            <dd className="sr-only">{data.peopleCount}</dd>
          </div>
        </dl>

        {data.priceBreakdown.length > 0 ? (
          <dl className="flex flex-col gap-1 border-t border-[var(--border-subtle)] pt-2">
            {data.priceBreakdown.map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-[var(--text-secondary)]">{line.label}</dt>
                <dd className="text-sm text-[var(--text-primary)]">
                  <Price amountUsd={line.amountUsd} />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{tCheckout('total')}</p>
          <p className="text-base font-semibold text-[var(--text-primary)]">
            <Price amountUsd={data.totalUsd} />
          </p>
        </div>

        {data.cancellationPolicy ? (
          <p className="text-xs text-[var(--text-tertiary)]">
            <span className="font-medium">{t('cancellationPolicy')}: </span>
            {data.cancellationPolicy}
          </p>
        ) : null}

        {expired ? (
          <p className="text-xs text-[var(--tone-danger-text)]">{t('holdExpiredDesc')}</p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            // An expired hold cannot be confirmed server-side, so do not offer it.
            disabled={expired}
            onClick={() => context.onAsk(`Confirm my booking for ${data.itemName}`)}
          >
            {t('confirmBooking')}
          </Button>
          <Link
            href={`/bookings/${data.bookingId}`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
          >
            {tCheckout('confirmation.viewBooking')}
          </Link>
        </div>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------- qr payment */

type QrPayment = Extract<ContentPayload, { type: 'qr_payment' }>['data']

export function QrPaymentBlock({
  data,
  context,
}: {
  data: QrPayment
  context: BookingBlockContext
}) {
  const t = useTranslations('booking')
  const tCheckout = useTranslations('checkout')

  const countdown = useCountdown(data.expiry)
  // The agent can also push `expired` directly on a hold-expiry update.
  const expired = data.expired === true || (countdown?.expired ?? false)

  const bookingId = data.bookingId
  const canConfirm = Boolean(bookingId) && context.isAuthenticated === true && !expired

  return (
    <Panel>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t('scanQr')}</h4>
          <HoldTimer expiresAt={data.expiry} />
        </div>

        <p className="text-xs text-[var(--text-secondary)]">{tCheckout('qr.scan')}</p>

        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              'relative size-40 overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-2',
              // A scannable-looking code that can no longer be paid is a trap.
              expired && 'opacity-40',
            )}
          >
            {/* Runtime URL from the agent, so a plain <img> rather than next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.qrUrl}
              alt={t('scanQr')}
              className="size-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>

          <p className="text-base font-semibold text-[var(--text-primary)]">
            <Price amountUsd={data.amount.usd} />
          </p>
        </div>

        {expired ? <p className="text-xs text-[var(--tone-danger-text)]">{t('qrExpiredDesc')}</p> : null}

        {/*
         * The "I've paid" affordance only appears when the agent could actually
         * accept it. It re-checks with the payment provider regardless — a client
         * claim is never trusted — but offering a button that is guaranteed to
         * return "Cannot verify payment." is worse than not offering it.
         */}
        {!expired && !bookingId ? (
          <p className="text-xs text-[var(--text-tertiary)]" role="note">
            {t('missingReference')}
          </p>
        ) : null}

        {!expired && bookingId && context.isAuthenticated !== true ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-[var(--text-tertiary)]">{t('signInToPayDesc')}</p>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'self-start')}
            >
              {t('signInToPay')}
            </Link>
          </div>
        ) : null}

        {canConfirm && bookingId ? (
          <Button
            size="sm"
            className="self-start"
            onClick={() => context.onPaymentCompleted?.(bookingId)}
          >
            {tCheckout('qr.paid')}
          </Button>
        ) : null}
      </div>
    </Panel>
  )
}

/* -------------------------------------------------------- stripe card form */

type StripeCardForm = Extract<ContentPayload, { type: 'stripe_card_form' }>['data']

/**
 * Card payment block.
 *
 * DELIBERATELY renders no card fields. No backend endpoint mints a PaymentIntent,
 * so `clientSecret` is always absent and there is nothing to submit a card to.
 * Presenting a card-number input that goes nowhere would invite people to type real
 * card details into a form that cannot protect or use them, which is worse than
 * having no form. Instead this is a clearly labelled sandbox confirmation.
 */
export function StripeCardFormBlock({
  data,
  context,
}: {
  data: StripeCardForm
  context: BookingBlockContext
}) {
  const t = useTranslations('booking')
  const tCheckout = useTranslations('checkout')

  const countdown = useCountdown(data.expiry)
  const expired = countdown?.expired ?? false
  const canConfirm = context.isAuthenticated === true && !expired

  return (
    <Panel tone="warning">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-[var(--tone-warning-text)]">
              {t('sandboxTitle')}
            </h4>
            <Badge tone="warning">{tCheckout('method.card')}</Badge>
          </div>
          <HoldTimer expiresAt={data.expiry} />
        </div>

        {/* Stated plainly, not buried: no card is charged here. */}
        <p className="text-xs text-[var(--tone-warning-text)]">{tCheckout('mockNotice')}</p>
        <p className="text-xs text-[var(--tone-warning-text)]">{t('sandboxDesc')}</p>

        <p className="text-base font-semibold text-[var(--tone-warning-text)]">
          <Price amountUsd={data.amount.usd} />
        </p>

        {context.isAuthenticated !== true ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-[var(--tone-warning-text)]">{t('signInToPayDesc')}</p>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'self-start')}
            >
              {t('signInToPay')}
            </Link>
          </div>
        ) : null}

        {canConfirm ? (
          <Button
            size="sm"
            className="self-start"
            onClick={() => context.onPaymentCompleted?.(data.bookingId)}
          >
            {tCheckout('confirmation.completePayment')}
          </Button>
        ) : null}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------- payment status */

type PaymentStatus = Extract<ContentPayload, { type: 'payment_status' }>['data']

const STATUS_TONE = {
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
} as const

export function PaymentStatusBlock({
  data,
  context,
}: {
  data: PaymentStatus
  context: BookingBlockContext
}) {
  const t = useTranslations('paymentStatus')
  const tBooking = useTranslations('booking')
  const tCheckout = useTranslations('checkout')

  const tone = STATUS_TONE[data.status]
  const label = t(
    data.status === 'PENDING'
      ? 'pending'
      : data.status === 'SUCCEEDED'
        ? 'succeeded'
        : data.status === 'FAILED'
          ? 'failed'
          : 'cancelled',
  )

  return (
    <Panel tone={tone === 'neutral' ? 'neutral' : tone}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={tone === 'neutral' ? 'neutral' : tone}>{label}</Badge>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              <Price amountUsd={data.amountUsd} />
            </p>
          </div>
          {data.method ? (
            <p className="text-xs text-[var(--text-tertiary)]">{data.method}</p>
          ) : null}
        </div>

        <p className="font-mono text-xs text-[var(--text-tertiary)]">
          <span className="font-sans">{tBooking('paymentReference')}: </span>
          {data.paymentIntentId}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {data.status === 'FAILED' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => context.onAsk('Retry my payment')}
            >
              {t('retry')}
            </Button>
          ) : null}

          {data.receiptUrl ? (
            <a
              href={data.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
            >
              {tBooking('viewReceipt')}
            </a>
          ) : null}

          <Link
            href={`/bookings/${data.bookingId}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            {tCheckout('confirmation.viewBooking')}
          </Link>
        </div>
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------- booking confirmed */

type BookingConfirmed = Extract<ContentPayload, { type: 'booking_confirmed' }>['data']

export function BookingConfirmedBlock({ data }: { data: BookingConfirmed }) {
  const t = useTranslations('booking')
  const tCheckout = useTranslations('checkout')

  return (
    <Panel tone="success">
      <div className="flex flex-col gap-2">
        {/* A confirmation is worth announcing, not just showing. */}
        <h4 className="text-sm font-semibold text-[var(--tone-success-text)]" role="status">
          {t('bookingConfirmed')}
        </h4>

        <p className="text-sm text-[var(--tone-success-text)]">{data.tripName}</p>

        <dl className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-[var(--tone-success-text)]">{t('reference')}</dt>
            <dd className="font-mono text-sm text-[var(--tone-success-text)]">
              {data.bookingRef}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-[var(--tone-success-text)]">{t('travelDate')}</dt>
            <dd className="text-sm text-[var(--tone-success-text)]">
              {formatDate(data.travelDate)}
            </dd>
          </div>
        </dl>

        {data.qrCode ? (
          <div className="size-32 self-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface)] p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.qrCode}
              alt={`${t('reference')} ${data.bookingRef}`}
              className="size-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}

        <Link
          href={`/bookings/${data.bookingRef}`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'self-start')}
        >
          {tCheckout('confirmation.viewBooking')}
        </Link>
      </div>
    </Panel>
  )
}

/** Readable date, falling back to the raw value when it is not parseable. */
function formatDate(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
