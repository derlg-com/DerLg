'use client';

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';

/**
 * Card form. The card number never touches DerLg — Stripe Elements renders it in
 * a cross-origin iframe and `confirmPayment` submits it directly to Stripe.
 */
export function PaymentForm({
  amountCents,
  bookingId,
  onSucceeded,
}: {
  amountCents: number;
  bookingId: string;
  onSucceeded: () => void;
}) {
  const t = useTranslations('checkout');
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setIsPaying(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/${bookingId}/confirmation`,
      },
      // Stay on the page when no redirect is required (most cards), so the
      // traveller sees the confirmation without a round trip.
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? '');
      setIsPaying(false);
      return;
    }

    onSucceeded();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-800">{t('cardLabel')}</span>
        <div className="rounded-lg border border-ink-300 bg-white p-3">
          <PaymentElement />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t('payError', { message: error })}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={!stripe || isPaying} data-testid="pay-button">
        {isPaying ? t('paying') : t('payButton', { amount: formatCents(amountCents) })}
      </Button>

      <p className="text-xs text-ink-500">{t('secureNote')}</p>
    </form>
  );
}
