'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'

import { Composer } from '@/components/chat/composer'
import { BlockedPanel, ConnectionStatusBar } from '@/components/chat/connection-status'
import {
  AgentBubble,
  StreamingBubble,
  SuggestionChips,
  UserBubble,
} from '@/components/chat/message-bubble'
import { PayloadBlocks } from '@/components/chat/payloads/block-renderer'
import { ToolStatusChips } from '@/components/chat/tool-status'
import { Button, buttonVariants } from '@/components/ui'
import { useSession } from '@/hooks/use-auth'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useVibeSocket } from '@/hooks/use-vibe-socket'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import type { InboundFrame } from '@/lib/vibe/protocol'
import { resetSessionId } from '@/lib/vibe/session-id'
import {
  initialTranscript,
  transcriptReducer,
  type NoticeTurn,
  type Turn,
} from '@/lib/vibe/transcript'

/**
 * The concierge conversation.
 *
 * Owns the transcript and the socket. Payload blocks are rendered by a registry
 * added in Tasks 15-17; until then a block's presence is acknowledged rather than
 * silently dropped, so an unrendered result is never mistaken for no result.
 */
export function ChatView() {
  const t = useTranslations('chat')
  const online = useOnlineStatus()
  const searchParams = useSearchParams()
  const { user } = useSession()

  const [state, dispatch] = React.useReducer(transcriptReducer, initialTranscript)

  // A stable identity so the socket effect is not torn down on every render.
  const onFrame = React.useCallback((frame: InboundFrame) => {
    dispatch({ type: 'frame', frame })
  }, [])

  const { status, rejectedCode, send, reconnect, queueLength } = useVibeSocket({ onFrame })

  /** Page the user came from, carried as provenance for the agent. */
  const context = searchParams.get('context') ?? undefined

  const sendMessage = React.useCallback(
    (text: string) => {
      dispatch({ type: 'send', text, ...(context ? { context } : {}) })
      send({ type: 'user_message', content: text, ...(context ? { context } : {}) })
    },
    [context, send],
  )

  const handleFeedback = React.useCallback(
    (id: string, helpful: boolean) => {
      dispatch({ type: 'feedback', id, helpful })
      // `id` is the agent's own `message_id` when it sent one (the transcript
      // reducer prefers it), which is what lets the agent resolve the vote to a
      // stored turn and persist it. Older agent builds send no id; the locally
      // minted fallback still round-trips, it just cannot be persisted.
      send({ type: 'feedback', message_id: id, helpful })
    },
    [send],
  )

  const handlePaymentCompleted = React.useCallback(
    (bookingId: string) => {
      /*
       * A notification, not a claim: the agent re-checks with the payment provider
       * and answers "Cannot verify payment." for anything it cannot confirm.
       */
      send({ type: 'payment_completed', booking_id: bookingId })
    },
    [send],
  )

  const startNewConversation = React.useCallback(() => {
    resetSessionId()
    dispatch({ type: 'reset' })
    // The socket picks up the new id on its next connection.
    reconnect()
  }, [reconnect])

  /*
   * The agent's greeting is itself a turn, so an empty-transcript check would hide
   * the opening prompts the moment the handshake completes. What matters is whether
   * the USER has said anything yet.
   */
  const hasUserTurn = state.turns.some((turn) => turn.kind === 'user')
  const isStreaming = state.typing || Boolean(state.streaming) || state.tools.length > 0
  const blocked = status === 'rejected'

  const notice = !online ? t('offlineNotice') : status !== 'connected' ? t('sendFailed') : undefined

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <h1 className="text-base font-semibold text-[var(--text-primary)]">{t('title')}</h1>
        {hasUserTurn ? (
          <Button variant="ghost" size="sm" onClick={startNewConversation}>
            {t('newChat')}
          </Button>
        ) : null}
      </header>

      <ConnectionStatusBar status={status} queueLength={queueLength} onRetry={reconnect} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Transcript
          turns={state.turns}
          streaming={state.streaming}
          reasoning={state.reasoning}
          isStreaming={isStreaming}
          tools={state.tools}
          onFeedback={handleFeedback}
          onSuggestion={sendMessage}
          onPaymentCompleted={handlePaymentCompleted}
          isAuthenticated={Boolean(user)}
        />

        {!hasUserTurn && state.suggestedPrompts.length > 0 ? (
          <div className="px-4 pb-3">
            <SuggestionChips
              label={t('welcomeTitle')}
              suggestions={state.suggestedPrompts}
              onSelect={sendMessage}
            />
          </div>
        ) : null}
      </div>

      {blocked ? (
        <BlockedPanel code={rejectedCode} />
      ) : (
        <Composer onSend={sendMessage} notice={notice} />
      )}
    </div>
  )
}

function Transcript({
  turns,
  streaming,
  reasoning,
  isStreaming,
  tools,
  onFeedback,
  onSuggestion,
  onPaymentCompleted,
  isAuthenticated,
}: {
  turns: Turn[]
  streaming: string
  reasoning: string
  isStreaming: boolean
  tools: { name: string; status: string }[]
  onFeedback: (id: string, helpful: boolean) => void
  onSuggestion: (text: string) => void
  onPaymentCompleted: (bookingId: string) => void
  isAuthenticated: boolean
}) {
  const t = useTranslations('chat')
  const endRef = React.useRef<HTMLDivElement>(null)

  // Follow the conversation as it grows.
  React.useEffect(() => {
    /*
     * Instant, not smooth. A smooth scroll keeps animating while the next chunk
     * arrives, so the transcript is still moving when the user reaches for a
     * control — the press lands on a moving target and never becomes a click.
     * Instant scrolling also avoids fighting prefers-reduced-motion.
     */
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
  }, [turns.length, streaming, tools.length])

  return (
    <div className="flex-1 overflow-y-auto px-4">
      {turns.length === 0 && !isStreaming ? (
        <p className="py-8 text-center text-sm text-[var(--text-secondary)]">{t('emptyHint')}</p>
      ) : null}

      <ul className="flex flex-col gap-4 py-2" aria-label={t('transcript')}>
        {turns.map((turn) =>
          turn.kind === 'user' ? (
            <UserBubble key={turn.id} turn={turn} />
          ) : turn.kind === 'agent' ? (
            <AgentBubble
              key={turn.id}
              turn={turn}
              onFeedback={onFeedback}
              onSuggestion={onSuggestion}
            >
              <PayloadBlocks
                blocks={turn.blocks}
                onAsk={onSuggestion}
                onPaymentCompleted={onPaymentCompleted}
                isAuthenticated={isAuthenticated}
              />
            </AgentBubble>
          ) : (
            <NoticeBubble key={turn.id} turn={turn} />
          ),
        )}

        {isStreaming ? (
          <>
            {tools.length > 0 ? (
              <li>
                <ToolStatusChips tools={tools} />
              </li>
            ) : null}
            <StreamingBubble text={streaming} reasoning={reasoning} />
          </>
        ) : null}
      </ul>

      <div ref={endRef} />
    </div>
  )
}

function NoticeBubble({ turn }: { turn: NoticeTurn }) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')
  const tAccount = useTranslations('account')

  if (turn.tone === 'login') {
    return (
      <li>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--accent-subtle)] p-3">
          <p className="text-sm font-medium text-[var(--accent-subtle-text)]">
            {t('requiresLoginTitle')}
          </p>
          <p className="mt-1 text-sm text-[var(--accent-subtle-text)]">{t('requiresLoginDesc')}</p>
          <Link href="/login" className={cn(buttonVariants({ size: 'sm' }), 'mt-2')}>
            {tAccount('signIn.submit')}
          </Link>
        </div>
      </li>
    )
  }

  if (turn.tone === 'payment') {
    return (
      <li>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--tone-warning-bg)] p-3">
          <p className="text-sm font-medium text-[var(--tone-warning-text)]">
            {tBooking('paymentMethod')}
          </p>
          {turn.amountUsd !== undefined ? (
            <p className="mt-1 text-sm text-[var(--tone-warning-text)]">
              {tBooking('total')}: ${turn.amountUsd.toFixed(2)}
            </p>
          ) : null}
          {turn.bookingId ? (
            <Link
              href={`/bookings/${turn.bookingId}`}
              className={cn(buttonVariants({ size: 'sm' }), 'mt-2')}
            >
              {tBooking('confirmBooking')}
            </Link>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <li>
      <p
        className="rounded-[var(--radius-md)] bg-[var(--tone-danger-bg)] px-3 py-2 text-sm text-[var(--tone-danger-text)]"
        role="alert"
      >
        {turn.message ?? tCommon('error')}
      </p>
    </li>
  )
}
