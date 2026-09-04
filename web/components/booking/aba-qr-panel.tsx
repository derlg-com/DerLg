'use client'

import { useTranslations } from 'next-intl'

import { Price } from '@/components/shared/price'
import { Button } from '@/components/ui'
import { useCountdown } from '@/hooks/use-countdown'

/**
 * ABA KHQR payment panel.
 *
 * ABA publishes no payment API, so there is no callback to await here: settlement
 * is detected SERVER-SIDE from the Telegram credit alert ABA's own bot posts when
 * money arrives. That is why the checkout POLLS for status rather than receiving a
 * result — this panel only presents the code and its deadline, and never learns
 * the outcome itself.
 */
export function AbaQrPanel({
  qrImageDataUrl,
  amountUsd,
  expiresAt,
  onRegenerate,
  regenerating,
}: {
  qrImageDataUrl: string | undefined
  amountUsd: number
  expiresAt: string | undefined
  onRegenerate: () => void
  regenerating: boolean
}) {
  const t = useTranslations('checkout')
  const countdown = useCountdown(expiresAt)
  const expired = countdown?.expired ?? false

  // A lapsed (or missing) code cannot take money — the backend matches only
  // unexpired QRs — so it is replaced with a way to mint a fresh one rather than
  // left as a dead image the customer might still try to scan.
  if (expired || !qrImageDataUrl) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium text-[var(--text-primary)]" role="alert">
          {t('aba.expired')}
        </p>
        <Button variant="secondary" onClick={onRegenerate} loading={regenerating}>
          {t('aba.regenerate')}
        </Button>
      </div>
    )
  }

  return (
    <section
      aria-label={t('aba.title')}
      className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
    >
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('aba.title')}</h2>
      <p className="text-center text-sm text-[var(--text-secondary)]">{t('aba.instructions')}</p>

      {/* A white quiet zone around the code is required for reliable scanning. */}
      <div className="size-56 overflow-hidden rounded-[var(--radius-md)] bg-white p-3">
        {/* Runtime PNG data URL from the API, so a plain <img>, not next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrImageDataUrl} alt={t('aba.title')} className="size-full object-contain" />
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        {t('aba.amount')}: <Price amountUsd={amountUsd} className="font-semibold" />
      </p>

      {countdown ? (
        <p
          className="text-sm font-medium text-[var(--text-secondary)]"
          // Polite and atomic: the value changes every second.
          aria-live="polite"
          aria-atomic="true"
        >
          {t('aba.expiresIn', { minutes: countdown.minutes, seconds: countdown.seconds })}
        </p>
      ) : null}

      {/*
       * Confirmation is out-of-band, so reassure the customer the page will react
       * on its own once the credit alert settles the payment server-side.
       */}
      <p
        className="text-center text-xs text-[var(--text-tertiary)]"
        role="status"
        aria-live="polite"
      >
        {t('aba.autoConfirm')}
      </p>
    </section>
  )
}
