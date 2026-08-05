'use client';

import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Status = 'checking' | 'ok' | 'degraded' | 'unreachable';

interface HealthPayload {
  status: 'ok' | 'degraded';
  dependencies: { database: 'up' | 'down'; redis: 'up' | 'down' };
}

/**
 * Small live indicator that the API, Postgres and Redis are reachable.
 * Doubles as the Task 1 acceptance demo from inside the browser.
 */
export function ApiStatusBadge() {
  const t = useTranslations('home');
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const controller = new AbortController();
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3101/v1';

    async function check() {
      try {
        const response = await fetch(`${base}/health`, { signal: controller.signal });
        const body: { data: HealthPayload | null } = await response.json();
        setStatus(body.data?.status === 'ok' ? 'ok' : 'degraded');
      } catch {
        if (!controller.signal.aborted) {
          setStatus('unreachable');
        }
      }
    }

    void check();
    return () => controller.abort();
  }, []);

  const label: Record<Status, string> = {
    checking: t('statusChecking'),
    ok: t('statusOk'),
    degraded: t('statusDegraded'),
    unreachable: t('statusUnreachable'),
  };

  const dotClass: Record<Status, string> = {
    checking: 'bg-ink-400',
    ok: 'bg-emerald-600',
    degraded: 'bg-amber-600',
    unreachable: 'bg-red-600',
  };

  return (
    <p
      className="flex items-center gap-2 text-sm text-ink-600"
      role="status"
      aria-live="polite"
      data-testid="api-status"
    >
      <span className={cn('size-2 rounded-full', dotClass[status])} aria-hidden="true" />
      {label[status]}
    </p>
  );
}
