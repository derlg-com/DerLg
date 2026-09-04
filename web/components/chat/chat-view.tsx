'use client'

import { ArrowDown, LayoutPanelLeft } from 'lucide-react'
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
import { VibeStarter } from '@/components/chat/vibe-starter'
import { WorkspacePanel } from '@/components/chat/workspace-panel'
import { Badge, Button, Sheet, buttonVariants } from '@/components/ui'
import { useSession } from '@/hooks/use-auth'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { usePaymentStatus } from '@/hooks/use-payment-status'
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
import { deriveWorkspace } from '@/lib/vibe/workspace'

/**
 * The concierge workspace.
 *
 * Two regions, not one (spec §19): the conversation, and a workspace that holds
 * the state the conversation has built up — the trip being considered, its map, the
 * active hold and its payment. The transcript is the record; the workspace is what
 * is true right now, and it does not scroll away.
 *
 * From `lg` up both are visible side by side. Below that the workspace lives in a
 * bottom sheet behind a summary pill, because a 375px-wide two-column layout is two
 * unusable columns.
 */
export function ChatView() {
  const t = useTranslations('chat')
  const tWorkspace = useTranslations('workspace')
  const online = useOnlineStatus()
  const searchParams = useSearchParams()
  const { user } = useSession()

  const [state, dispatch] = React.useReducer(transcriptReducer, initialTranscript)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null)

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
      // Asking something is a return to the conversation; get the sheet out of the way.
      setSheetOpen(false)
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

  /**
   * Bookings already reported to the agent as paid.
   *
   * Guards BOTH paths that can report a payment — the user pressing "I've paid"
   * and the poll observing success — so one payment produces exactly one agent
   * turn. Cleared on a new conversation so a reused booking id can notify again.
   */
  const notified = React.useRef<string | null>(null)

  const handlePaymentCompleted = React.useCallback(
    (bookingId: string) => {
      /*
       * A notification, not a claim: the agent re-checks the booking's payment
       * record and answers "Cannot verify payment." for anything it cannot confirm.
       *
       * Recorded in `notified` so the poll does not then send a SECOND frame for
       * the same booking when it observes the same success. Each frame costs a
       * full agent turn, and two turns for one payment is confusing to read back.
       */
      if (notified.current === bookingId) return
      notified.current = bookingId
      send({ type: 'payment_completed', booking_id: bookingId })
    },
    [send],
  )

  const startNewConversation = React.useCallback(() => {
    resetSessionId()
    dispatch({ type: 'reset' })
    setSheetOpen(false)
    setSelectedProductId(null)
    notified.current = null
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

  // Recomputed per render, but only from turns and selection — cheap, and always in step.
  const workspace = React.useMemo(
    () => deriveWorkspace(state.turns, selectedProductId),
    [state.turns, selectedProductId],
  )

  /*
   * ONE payment watcher for the whole view.
   *
   * WorkspacePanel is mounted twice (the CSS-hidden desktop rail and the mobile
   * sheet), so a watcher inside it would poll twice and — worse — send two
   * `payment_completed` frames for one payment, giving the agent two concurrent
   * turns mutating the same session. Watching here keeps it singular.
   */
  const watchedBookingId = workspace.payment?.bookingId
  const agentSettled =
    workspace.payment?.status !== undefined && workspace.payment.status !== 'PENDING'
  const { data: polled } = usePaymentStatus({
    bookingId: watchedBookingId,
    enabled: Boolean(watchedBookingId) && !agentSettled && !workspace.confirmation,
  })

  /*
   * When polling is the first to see success, tell the agent ONCE so it can run
   * its own check and produce the confirmation turn. A ref, not state: this must
   * fire once per booking and must not itself cause a render.
   */
  React.useEffect(() => {
    if (!watchedBookingId) return
    if (polled?.state !== 'SUCCEEDED') return
    // handlePaymentCompleted owns the once-per-booking guard.
    handlePaymentCompleted(watchedBookingId)
  }, [watchedBookingId, polled?.state, handlePaymentCompleted])
  /*
   * Memoised so the memo on WorkspacePanel can actually hold. A fresh props object
   * per render would defeat it, and ChatView re-renders on every stream chunk.
   * `sendMessage` and `handlePaymentCompleted` are already stable callbacks.
   */
  const workspaceProps = React.useMemo(
    () => ({
      state: workspace,
      onAsk: sendMessage,
      onPaymentCompleted: handlePaymentCompleted,
      isAuthenticated: Boolean(user),
      polledStatus: polled?.state,
      polledAmountUsd: polled?.amountUsd,
      selectedProductId,
      onSelectProduct: setSelectedProductId,
    }),
    [
      workspace,
      sendMessage,
      handlePaymentCompleted,
      user,
      polled?.state,
      polled?.amountUsd,
      selectedProductId,
    ],
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4 px-0 lg:px-4">
      {/* ------------------------------------------------------ conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">
              {t('title')}
            </h1>
            {workspace.subject ? (
              <Badge tone="accent" className="hidden sm:inline-flex">
                {workspace.subject.name}
              </Badge>
            ) : null}
          </div>
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
            starter={!hasUserTurn ? <VibeStarter onSend={sendMessage} /> : null}
            selectedProductId={selectedProductId}
            onSelectProduct={setSelectedProductId}
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

        {/* Below lg the workspace is one tap away rather than always on screen. */}
        {workspace.hasContent ? (
          <div className="border-t border-[var(--border-subtle)] px-4 py-2 lg:hidden">
            <Button
              variant="secondary"
              size="sm"
              block
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
            >
              <LayoutPanelLeft aria-hidden="true" className="size-4" />
              {tWorkspace('openSheet')}
              {workspace.hold || workspace.payment ? (
                <span className="ml-1 size-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              ) : null}
            </Button>
          </div>
        ) : null}

        {blocked ? (
          <BlockedPanel code={rejectedCode} />
        ) : (
          <Composer onSend={sendMessage} notice={notice} />
        )}
      </div>

      {/* ------------------------------------------- workspace rail, lg and up */}
      <aside
        aria-label={tWorkspace('title')}
        className="hidden w-80 shrink-0 py-3 lg:block xl:w-96"
      >
        <div className="sticky top-4 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1">
          <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">
            {tWorkspace('title')}
          </h2>
          <WorkspacePanel {...workspaceProps} />
        </div>
      </aside>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={tWorkspace('title')}
        side="bottom"
      >
        <WorkspacePanel {...workspaceProps} />
      </Sheet>
    </div>
  )
}

/**
 * Distance from the bottom, in px, still counted as "following the conversation".
 * Roughly one thumb-scroll of slack, so a small drift does not disable autoscroll.
 */
const FOLLOW_THRESHOLD_PX = 120

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
  starter,
  selectedProductId,
  onSelectProduct,
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
  /** Rendered above the transcript on the first turn only. */
  starter?: React.ReactNode
  selectedProductId?: string | null
  onSelectProduct?: (id: string | null) => void
}) {
  const t = useTranslations('chat')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const endRef = React.useRef<HTMLDivElement>(null)
  const [following, setFollowing] = React.useState(true)

  /*
   * Autoscroll ONLY while the user is already at the bottom.
   *
   * The previous behaviour scrolled on every chunk unconditionally, which meant
   * scrolling up to re-read an earlier trip card was undone by the next token —
   * you physically could not read history while the agent was replying. Tracking
   * intent fixes that, and the "jump to latest" button makes returning explicit.
   */
  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setFollowing(distance <= FOLLOW_THRESHOLD_PX)
  }, [])

  React.useEffect(() => {
    if (!following) return
    /*
     * Instant, not smooth. A smooth scroll keeps animating while the next chunk
     * arrives, so the transcript is still moving when the user reaches for a
     * control — the press lands on a moving target and never becomes a click.
     * Instant scrolling also avoids fighting prefers-reduced-motion.
     */
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
  }, [following, turns.length, streaming, tools.length])

  const jumpToLatest = React.useCallback(() => {
    setFollowing(true)
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
  }, [])

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4">
        {starter ? <div className="pt-2 pb-1">{starter}</div> : null}

        {turns.length === 0 && !isStreaming && !starter ? (
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
                  selectedProductId={selectedProductId}
                  onSelectProduct={onSelectProduct}
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

      {/* Only offered when it would actually do something. */}
      {!following && turns.length > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={jumpToLatest}
          className="absolute right-4 bottom-3 shadow-sm"
        >
          <ArrowDown aria-hidden="true" className="size-3.5" />
          {t('jumpToLatest')}
        </Button>
      ) : null}
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
