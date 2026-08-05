'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { ConnectionStatus } from '@/lib/vibe/socket'

/**
 * Connection state.
 *
 * Deliberately quiet while healthy: a permanent "Connected" badge is noise. The
 * failure states are the ones a user needs, and they are distinguished because the
 * remedies differ — reconnecting resolves itself, a rejected origin never will.
 */
export function ConnectionStatusBar({
  status,
  queueLength,
  onRetry,
}: {
  status: ConnectionStatus
  queueLength: number
  onRetry: () => void
}) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')

  const tone = status === 'rejected' ? 'danger' : status === 'connected' ? 'success' : 'warning'

  const label =
    status === 'connecting' || status === 'idle'
      ? tCommon('connecting')
      : status === 'connected'
        ? tCommon('connected')
        : status === 'reconnecting'
          ? t('reconnecting')
          : tCommon('disconnected')

  // Nothing to report once connected with an empty queue.
  if (status === 'connected' && queueLength === 0) {
    return (
      <p className="sr-only" role="status">
        {label}
      </p>
    )
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-2"
      role="status"
      aria-live="polite"
    >
      <Badge tone={tone}>
        <span
          className={cn(
            'mr-1.5 inline-block size-1.5 rounded-full bg-current',
            (status === 'connecting' || status === 'reconnecting' || status === 'idle') &&
              'motion-safe:animate-pulse',
          )}
          aria-hidden="true"
        />
        {label}
      </Badge>

      {queueLength > 0 ? (
        <span className="text-xs text-[var(--text-secondary)]">{t('queued', { count: queueLength })}</span>
      ) : null}

      {status === 'reconnecting' ? (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {tCommon('retry')}
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Terminal failure panel.
 *
 * Shown instead of the composer when reconnecting cannot help, so the user is not
 * left typing into a socket that will never open.
 */
export function BlockedPanel({ code }: { code: number | null }) {
  const t = useTranslations('chat')

  // 1008 is a rejected token (the session expired); 4403 is a rejected origin,
  // which is a deployment fault the user cannot fix.
  const description = code === 1008 ? t('blockedSession') : t('blockedOrigin')

  return (
    <div
      className="m-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--tone-danger-bg)] p-4"
      role="alert"
    >
      <h2 className="text-sm font-semibold text-[var(--tone-danger-text)]">{t('blockedTitle')}</h2>
      <p className="mt-1 text-sm text-[var(--tone-danger-text)]">{description}</p>
    </div>
  )
}
