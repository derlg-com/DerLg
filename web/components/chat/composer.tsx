'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

const MAX_LENGTH = 2000
/** Show the counter only once it is actually relevant. */
const COUNTER_THRESHOLD = MAX_LENGTH - 200

/**
 * Message composer.
 *
 * Enter sends and Shift+Enter inserts a newline, which is the convention users
 * expect from a chat. The textarea grows to a cap rather than scrolling from one
 * line, so a long question stays readable while being written.
 *
 * Sending is allowed while disconnected: the socket queues and replays, and
 * blocking input during a brief network dip loses the user's thought.
 */
export function Composer({
  onSend,
  disabled = false,
  notice,
}: {
  onSend: (text: string) => void
  disabled?: boolean
  notice?: string
}) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')

  const [value, setValue] = React.useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')

    // Reset the grown height, or the box keeps the previous message's size.
    const textarea = textareaRef.current
    if (textarea) textarea.style.height = 'auto'
  }

  const nearLimit = value.length >= COUNTER_THRESHOLD

  return (
    <form
      className="border-t border-[var(--border-subtle)] bg-[var(--surface)] p-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {notice ? (
        <p className="mb-2 text-xs text-[var(--text-tertiary)]" role="status">
          {notice}
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        <label htmlFor="chat-composer" className="sr-only">
          {t('inputLabel')}
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          name="message"
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          placeholder={t('placeholder')}
          disabled={disabled}
          aria-describedby={nearLimit ? 'chat-composer-count' : undefined}
          onChange={(event) => {
            setValue(event.target.value)
            const textarea = event.target
            textarea.style.height = 'auto'
            textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          className={cn(
            'min-h-10 flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--canvas)]',
            'px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
            'disabled:opacity-60',
            'pointer-coarse:min-h-11',
          )}
        />
        <Button type="submit" disabled={disabled || value.trim().length === 0}>
          {tCommon('send')}
        </Button>
      </div>

      {/*
       * Silent truncation at `maxLength` is the failure this prevents: without a
       * counter the last words of a long brief just stop appearing, with no
       * explanation. Announced politely so it does not interrupt typing.
       */}
      {nearLimit ? (
        <p
          id="chat-composer-count"
          className="mt-1.5 text-right text-xs tabular-nums text-[var(--text-tertiary)]"
          aria-live="polite"
        >
          {t('charactersLeft', { count: MAX_LENGTH - value.length })}
        </p>
      ) : null}
    </form>
  )
}
