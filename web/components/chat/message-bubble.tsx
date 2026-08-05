'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { ReasoningPanel } from '@/components/chat/reasoning-panel'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { AgentTurn, UserTurn } from '@/lib/vibe/transcript'

/**
 * A user's message.
 *
 * Right-aligned and tinted, but the role is ALSO given as a visually hidden label,
 * because alignment and colour convey nothing to a screen reader.
 */
export function UserBubble({ turn }: { turn: UserTurn }) {
  const t = useTranslations('chat')

  return (
    <li className="flex flex-col items-end gap-1">
      <span className="sr-only">{t('you')}</span>
      <div className="max-w-[85%] rounded-[var(--radius-lg)] rounded-br-sm bg-[var(--accent)] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-[var(--accent-text)]">
        {turn.text}
      </div>
      {turn.context ? (
        <p className="text-xs text-[var(--text-tertiary)]">
          {t('askedWhileViewing', { page: turn.context })}
        </p>
      ) : null}
    </li>
  )
}

/**
 * A completed agent reply: text, its retained reasoning, any rendered payload
 * blocks, follow-up suggestions and a feedback control.
 */
export function AgentBubble({
  turn,
  onFeedback,
  onSuggestion,
  children,
}: {
  turn: AgentTurn
  onFeedback: (id: string, helpful: boolean) => void
  onSuggestion: (text: string) => void
  /** Rendered payload blocks, supplied by the payload registry (Tasks 15-17). */
  children?: React.ReactNode
}) {
  const t = useTranslations('chat')

  return (
    <li className="flex flex-col items-start gap-2">
      <span className="sr-only">{t('assistant')}</span>

      {turn.reasoning ? (
        <div className="w-full max-w-[85%]">
          <ReasoningPanel text={turn.reasoning} />
        </div>
      ) : null}

      {turn.text ? (
        <div className="max-w-[85%] rounded-[var(--radius-lg)] rounded-bl-sm border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-[var(--text-primary)]">
          {turn.text}
        </div>
      ) : null}

      {children ? <div className="w-full">{children}</div> : null}

      {turn.suggestions.length > 0 ? (
        <SuggestionChips
          label={t('suggestionsLabel')}
          suggestions={turn.suggestions}
          onSelect={onSuggestion}
        />
      ) : null}

      <FeedbackControl turn={turn} onFeedback={onFeedback} />
    </li>
  )
}

/** Streaming reply, rendered as it arrives. */
export function StreamingBubble({ text, reasoning }: { text: string; reasoning: string }) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')

  const hasContent = Boolean(text.trim() || reasoning.trim())

  return (
    <li className="flex flex-col items-start gap-2">
      <span className="sr-only">{t('assistant')}</span>

      {reasoning ? (
        <div className="w-full max-w-[85%]">
          <ReasoningPanel text={reasoning} live />
        </div>
      ) : null}

      <div
        className="max-w-[85%] rounded-[var(--radius-lg)] rounded-bl-sm border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-[var(--text-primary)]"
        /*
         * The reply streams token by token. 'polite' with atomic=false means a
         * screen reader reads the additions rather than restarting the whole
         * paragraph on every chunk.
         */
        aria-live="polite"
        aria-atomic="false"
        aria-label={t('streamingLabel')}
      >
        {hasContent ? text : <TypingDots label={tCommon('thinking')} />}
      </div>
    </li>
  )
}

function TypingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-[var(--text-tertiary)] motion-safe:animate-bounce"
          style={{ animationDelay: `${index * 120}ms` }}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

export function SuggestionChips({
  label,
  suggestions,
  onSelect,
}: {
  label: string
  suggestions: string[]
  onSelect: (text: string) => void
}) {
  return (
    <div className="w-full">
      <p className="mb-1.5 text-xs font-medium text-[var(--text-tertiary)]">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              onClick={() => onSelect(suggestion)}
              className={cn(
                'rounded-full border border-[var(--border-default)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)]',
                'transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                'min-h-8 pointer-coarse:min-h-11',
              )}
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FeedbackControl({
  turn,
  onFeedback,
}: {
  turn: AgentTurn
  onFeedback: (id: string, helpful: boolean) => void
}) {
  const t = useTranslations('chat')

  if (turn.feedback) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]" role="status">
        {t('feedbackThanks')}
      </p>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-[var(--text-tertiary)]">{t('feedbackPrompt')}</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('feedbackYes')}
        onClick={() => onFeedback(turn.id, true)}
      >
        <ThumbIcon />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('feedbackNo')}
        onClick={() => onFeedback(turn.id, false)}
      >
        <ThumbIcon down />
      </Button>
    </div>
  )
}

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-3.5', down && 'rotate-180')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 14V7l3-5a2 2 0 0 1 2 2v3h2.5a1.5 1.5 0 0 1 1.46 1.86l-1 4A1.5 1.5 0 0 1 12.5 14H6Z" />
      <path d="M6 7H3.5A1.5 1.5 0 0 0 2 8.5v4A1.5 1.5 0 0 0 3.5 14H6" />
    </svg>
  )
}
