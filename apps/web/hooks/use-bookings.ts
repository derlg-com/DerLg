'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { api } from '@/lib/api-client';
import type { Booking, CreateBookingInput } from '@/types/booking';

export const bookingKeys = {
  all: ['bookings'] as const,
  detail: (id: string) => ['booking', id] as const,
};

export function useBookings() {
  return useQuery({
    queryKey: bookingKeys.all,
    queryFn: () => api.get<Booking[]>('/bookings'),
  });
}

export function useBooking(bookingId: string | null) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId ?? 'none'),
    queryFn: () => api.get<Booking>(`/bookings/${bookingId}`),
    enabled: Boolean(bookingId),
    // A held booking is racing a clock, so keep it fresh while the page is open.
    refetchInterval: (query) =>
      query.state.data?.status === 'HOLD' || query.state.data?.status === 'PENDING_PAYMENT'
        ? 30_000
        : false,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookingInput) => api.post<Booking>('/bookings', input),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.detail(booking.id), booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}

export function useCancelBooking(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<Booking>(`/bookings/${bookingId}/cancel`),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.detail(booking.id), booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}

/** Subscribes to a once-per-second tick without storing derived state. */
function subscribeToSecond(onTick: () => void): () => void {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

/**
 * Epoch *seconds*, not milliseconds: useSyncExternalStore compares snapshots by
 * identity, so a value that changed on every call (Date.now()) would re-render
 * forever. Quantising to the second makes the snapshot stable between ticks.
 */
function getSecondSnapshot(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Live hold countdown, derived from the booking's absolute `holdExpiresAt` rather
 * than by decrementing a copy — so it stays correct across tab sleeps and server
 * refreshes. Returns null when the booking is not holding inventory.
 *
 * The clock is read through useSyncExternalStore so the ticking value never
 * becomes component state (which would mean setState inside an effect, and a
 * hydration mismatch between server and client renders).
 */
export function useHoldCountdown(booking: Booking | undefined): number | null {
  const expiresAtSeconds = booking?.holdExpiresAt
    ? Math.floor(new Date(booking.holdExpiresAt).getTime() / 1000)
    : null;

  const nowSeconds = useSyncExternalStore(
    subscribeToSecond,
    getSecondSnapshot,
    // Server render: fall back to the expiry itself so SSR and the first client
    // render agree, then the real clock takes over on the next tick.
    () => expiresAtSeconds ?? 0,
  );

  if (expiresAtSeconds === null) {
    return booking?.secondsRemaining ?? null;
  }

  return Math.max(0, expiresAtSeconds - nowSeconds);
}

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
