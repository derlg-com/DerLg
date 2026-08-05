'use client';

import { Elements } from '@stripe/react-stripe-js';
import { type Stripe, loadStripe } from '@stripe/stripe-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';

import { HoldCountdown } from '@/components/bookings/HoldCountdown';
import { PaymentForm } from '@/components/checkout/PaymentForm';
import { useBooking, useHoldCountdown } from '@/hooks/use-bookings';
import { useCreatePaymentIntent } from '@/hooks/use-payments';
import { ApiError } from '@/lib/api-client';
import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';

/** Cached per publishable key so the Stripe script loads once per session. */
const stripeCache = new Map<string, Promise<Stripe | null>>();

function stripeFor(publishableKey: string): Promise<Stripe | null> {
  const cached = stripeCache.get(publishableKey);
  if (cached) {
    return cached;
  }
  const promise = loadStripe(publishableKey);
  stripeCache.set(publishableKey, promise);
  return promise;
}

export function CheckoutView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout');
  const tb = useTranslations('bookings');
  const router = useRouter();
  const booking = useBooking(bookingId);
  const seconds = useHoldCountdown(booking.data);
  const createIntent = useCreatePaymentIntent();
  const requested = useRef(false);

  // Start the intent once the booking is known to be payable.
  useEffect(() => {
    if (requested.current || !booking.data) {
      return;
    }
    if (booking.data.status !== 'HOLD' && booking.data.status !== 'PENDING_PAYMENT') {
      return;
    }
    requested.current = true;
    createIntent.mutate(bookingId);
  }, [booking.data, bookingId, createIntent]);

  const intent = createIntent.data;
  const publishableKey =
    intent?.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;

  const stripePromise = useMemo(
    () => (publishableKey ? stripeFor(publishableKey) : null),
    [publishableKey],
  );

  if (booking.isLoading) {
    return (
      <p className="px-6 py-16 text-ink-500" role="status">
        {t('loading')}
      </p>
    );
  }

  if (!booking.data) {
    return (
      <p className="px-6 py-16 text-center text-ink-700" role="alert">
        {tb('notFound')}
      </p>
    );
  }

  const data = booking.data;

  if (data.status === 'CONFIRMED') {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-16 text-center">
        <p className="text-ink-800">{t('alreadyPaid')}</p>
        <Link href={`/bookings/${data.id}`} className="font-medium text-brand-700 underline">
          {t('viewBooking')}
        </Link>
      </main>
    );
  }

  if (data.status === 'EXPIRED' || data.status === 'CANCELLED') {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-16 text-center">
        <p className="text-ink-800" role="alert">
          {t('expired')}
        </p>
        <Link href="/packages" className="font-medium text-brand-700 underline">
          {tb('browseCta')}
        </Link>
      </main>
    );
  }

  const unavailable =
    createIntent.error instanceof ApiError && createIntent.error.status === 503;

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink-900">{t('title')}</h1>
        <p className="text-sm text-ink-600">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-1 rounded-2xl border border-ink-200 bg-white p-5">
        <p className="font-medium text-ink-900">{data.snapshot.title}</p>
        <p className="text-sm text-ink-600">
          {tb('reference')} {data.reference}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-ink-900" data-testid="checkout-total">
          {formatCents(data.totalCents)}
        </p>
      </section>

      <HoldCountdown seconds={seconds} />

      {unavailable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5" role="alert">
          <p className="text-sm font-medium text-amber-900">{t('notConfigured')}</p>
          <p className="mt-1 text-xs text-amber-800">{t('notConfiguredHint')}</p>
        </div>
      ) : createIntent.isPending || !intent ? (
        <p className="text-sm text-ink-500" role="status">
          {t('loading')}
        </p>
      ) : !stripePromise ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5" role="alert">
          <p className="text-sm font-medium text-amber-900">{t('notConfigured')}</p>
        </div>
      ) : (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret: intent.clientSecret, appearance: { theme: 'stripe' } }}
        >
          <PaymentForm
            amountCents={intent.amountCents}
            bookingId={bookingId}
            onSucceeded={() => router.push(`/checkout/${bookingId}/confirmation`)}
          />
        </Elements>
      )}

      <Link href={`/bookings/${bookingId}`} className="text-sm text-brand-700 hover:underline">
        ← {t('backToBooking')}
      </Link>
    </main>
  );
}
