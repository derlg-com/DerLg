'use client';

import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { formatCountdown } from '@/hooks/use-bookings';

/**
 * Live hold countdown. Renders the lapsed message once it reaches zero so the
 * traveller is never left staring at "0:00" wondering what happened.
 */
export function HoldCountdown({
  seconds,
  className,
}: {
  seconds: number | null;
  className?: string;
}) {
  const t = useTranslations('bookings');

  if (seconds === null) {
    return null;
  }

  if (seconds <= 0) {
    return (
      <div
        className={cn('rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-700', className)}
        role="status"
        data-testid="hold-countdown"
      >
        <p className="font-medium">{t('holdLapsed')}</p>
        <p className="text-xs text-ink-600">{t('holdLapsedHint')}</p>
      </div>
    );
  }

  const urgent = seconds <= 120;

  return (
    <p
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium',
        urgent ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800',
        className,
      )}
      role="status"
      aria-live={urgent ? 'assertive' : 'polite'}
      data-testid="hold-countdown"
    >
      {t('holdExpiring', { time: formatCountdown(seconds) })}
    </p>
  );
}
