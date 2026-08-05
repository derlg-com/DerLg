'use client';

import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/types/booking';

const TONE: Record<BookingStatus, string> = {
  HOLD: 'bg-amber-50 text-amber-800 ring-amber-200',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-800 ring-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  EXPIRED: 'bg-ink-100 text-ink-600 ring-ink-200',
  CANCELLED: 'bg-ink-100 text-ink-600 ring-ink-200',
  COMPLETED: 'bg-brand-50 text-brand-800 ring-brand-200',
};

/**
 * Status pill. Carries a text label as well as colour, so the state is legible
 * to colour-blind travellers and screen readers (Requirement 21.7).
 */
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations('bookings');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1',
        TONE[status],
      )}
      data-testid="booking-status"
    >
      {t(`status${status}`)}
    </span>
  );
}
