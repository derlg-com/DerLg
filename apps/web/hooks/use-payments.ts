'use client';

import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export interface PaymentIntentView {
  paymentId: string;
  clientSecret: string;
  amountCents: number;
  currency: string;
  bookingReference: string;
  publishableKey: string | null;
}

export interface RefundQuote {
  tier: 'FULL' | 'HALF' | 'NONE';
  percentage: number;
  amountCents: number;
  daysUntilDeparture: number;
  reason: string;
}

/**
 * Asks the API to start (or resume) payment. The amount is decided server-side
 * from the booking's frozen snapshot; the browser only ever receives a client
 * secret plus the publishable key.
 */
export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.post<PaymentIntentView>(`/payments/${bookingId}/intent`),
  });
}

export function useRefundQuote() {
  return useMutation({
    mutationFn: (bookingId: string) => api.post<RefundQuote>(`/payments/${bookingId}/refund-quote`),
  });
}
