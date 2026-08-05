'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

/**
 * The agent's reasoning, collapsed by default.
 *
 * Reasoning is useful for trust ("why did it pick this hotel?") but it is long and
 * arrives faster than anyone can read, so it must not push the answer off screen.
 * A native <details> keeps this keyboard accessible and announced without any
 * custom ARIA.
 */
export function ReasoningPanel({ text, live = false }: { text: string; live?: boolean }) {
  const t = useTranslations('common')

  if (!text.trim()) return null

  return (
    <details className="group rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center">
        <span className="inline-flex items-center gap-1.5">
          <svg
            viewBox="0 0 12 12"
            className="size-3 transition-transform group-open:rotate-90"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4.5 2.5 8 6l-3.5 3.5" />
          </svg>
          {t('thinkingProcess')}
        </span>
      </summary>
      <div
        className="max-h-64 overflow-y-auto whitespace-pre-wrap border-t border-[var(--border-subtle)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]"
        tabIndex={0}
        /*
         * Only the in-flight panel is a live region, and 'off' while collapsed:
         * announcing every reasoning token would drown out the actual answer.
         */
        aria-live={live ? 'polite' : 'off'}
      >
        {text}
      </div>
    </details>
  )
}
