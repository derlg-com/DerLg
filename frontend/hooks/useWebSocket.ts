'use client'

import { useEffect, useRef, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { ContentPayloadSchema } from '@/schemas/vibe-booking'
import { resolveContentPayloads, sanitizeSuggestions } from '@/lib/vibe-content'
import { getStoredToken } from '@/lib/auth'
import type { ContentItem, ContentAction, ContentMetadata } from '@/stores/vibe-booking.store'
import type { WsOutbound } from '@/types/vibe-booking'

const AI_WS_URL = process.env.NEXT_PUBLIC_AI_WS_URL ?? 'ws://localhost:8000'
const MAX_RETRIES = 5
const HEARTBEAT_MS = 30000
// If a ping is not answered by a pong within this window the connection is
// considered dead (Req 28.5): we close it so onclose drives the backoff
// reconnect instead of leaving a silently-broken socket open.
const PONG_TIMEOUT_MS = 10000
const QUEUE_KEY = 'derlg:vibe-booking:outbox'
const MAX_QUEUE = 100

function loadQueue(): WsOutbound[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as WsOutbound[]) : []
  } catch {
    return []
  }
}

function saveQueue(queue: WsOutbound[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)))
  } catch {
    /* quota exceeded — drop silently */
  }
}

export function useWebSocket(userId: string, language: 'EN' | 'ZH' | 'KM' = 'EN') {
  const ws = useRef<WebSocket | null>(null)
  const retries = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const pongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const outbox = useRef<WsOutbound[]>(loadQueue())
  // Tracks the content item optimistically marked "streaming" by an action so
  // it can be cleared on the real response (typing_end), not a fixed timer.
  const pendingActionItem = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(
    null,
  )
  const store = useVibeBookingStore()

  const clearPendingAction = useCallback(() => {
    const pending = pendingActionItem.current
    if (!pending) return
    clearTimeout(pending.timer)
    useVibeBookingStore.getState().updateContentItem(pending.id, { status: 'ready' })
    pendingActionItem.current = null
  }, [])

  const flushOutbox = useCallback(() => {
    if (ws.current?.readyState !== WebSocket.OPEN) return
    while (outbox.current.length > 0) {
      const msg = outbox.current.shift()
      if (msg) ws.current.send(JSON.stringify(msg))
    }
    saveQueue(outbox.current)
  }, [])

  const send = useCallback((msg: WsOutbound, queueIfOffline = true) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    } else if (queueIfOffline && (msg.type === 'user_message' || msg.type === 'user_action')) {
      outbox.current.push(msg)
      saveQueue(outbox.current)
    }
  }, [])

  const connectRef = useRef<(() => void) | null>(null)

  const connect = useCallback(() => {
    store.setConnectionStatus('connecting')
    const socket = new WebSocket(`${AI_WS_URL}/ws/chat`)
    ws.current = socket

    socket.onopen = () => {
      retries.current = 0
      store.setConnectionStatus('connected')
      // Auth never queues — must always be the first message
      socket.send(
        JSON.stringify({
          type: 'auth',
          user_id: userId,
          preferred_language: language,
          ...(getStoredToken() ? { token: getStoredToken() } : {}),
          ...(store.sessionId ? { session_id: store.sessionId } : {}),
        }),
      )
      // Heartbeat
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
      heartbeatTimer.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }))
          // Arm a liveness deadline: a missing pong means the link is dead, so
          // force-close to trigger the onclose backoff reconnect (Req 28.5).
          if (pongTimer.current) clearTimeout(pongTimer.current)
          pongTimer.current = setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN) socket.close()
          }, PONG_TIMEOUT_MS)
        }
      }, HEARTBEAT_MS)
      // Drain queued offline messages
      flushOutbox()
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data as string)

      switch (data.type) {
        case 'pong':
          // Heartbeat ack — connection is alive, cancel the liveness deadline.
          if (pongTimer.current) {
            clearTimeout(pongTimer.current)
            pongTimer.current = null
          }
          break

        case 'typing_start':
          store.setTyping(true)
          store.setStreaming(true)
          store.clearReasoning()
          // New turn — clear last turn's follow-up chips until the answer lands.
          store.setSuggestions([])
          break

        case 'agent_reasoning_chunk': {
          const delta = String(data.delta ?? '')
          if (delta) store.appendReasoning(delta)
          break
        }

        case 'typing_end': {
          store.setTyping(false)
          store.setStreaming(false)
          store.setToolStatus(null)
          // Clear any action-triggered optimistic "streaming" card now that the
          // real response has arrived (replaces the fixed 8s timer — BUG-3).
          clearPendingAction()
          break
        }

        case 'conversation_started':
        case 'conversation_resumed': {
          const currentState = useVibeBookingStore.getState()
          const isNew = !currentState.sessionId && currentState.messages.length === 0
          if (data.session_id) store.setSessionId(data.session_id)
          if (Array.isArray(data.suggested_prompts)) {
            store.setWelcomePrompts(
              data.suggested_prompts.filter((p: unknown): p is string => typeof p === 'string'),
            )
          }
          if (data.text && isNew) {
            store.addMessage({
              id: uuid(),
              role: 'assistant',
              content: data.text,
              type: 'text',
              timestamp: new Date().toISOString(),
            })
          }
          break
        }

        case 'agent_stream_chunk': {
          const delta = String(data.delta ?? '')
          if (delta) store.appendToStreamingMessage(delta)
          break
        }

        case 'agent_message': {
          store.setTyping(false)
          store.setStreaming(false)

          if (data.session_id && !store.sessionId) {
            store.setSessionId(data.session_id)
          }

          // If streaming produced a message, update it instead of adding a duplicate
          const currentMessages = useVibeBookingStore.getState().messages
          const lastMsg = currentMessages[currentMessages.length - 1]
          let msgId: string
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.type === 'text') {
            // Reuse the streaming message ID and update its content
            msgId = lastMsg.id
            // Update the last message with the final text
            const newText = data.text ?? ''
            if (lastMsg.content !== newText) {
              store.finalizeStreamingMessage(newText)
            }
          } else {
            msgId = uuid()
            store.addMessage({
              id: msgId,
              role: 'assistant',
              content: data.text ?? '',
              type: 'text',
              timestamp: new Date().toISOString(),
            })
          }

          // Follow-up suggestion chips for this answer.
          if (data.suggestions !== undefined) {
            store.setSuggestions(sanitizeSuggestions(data.suggestions))
          }

          // Adds (or updates in place) a single content block, deduping by type
          // so a card type's React key stays stable across re-renders.
          const addPayloadItem = (raw: unknown) => {
            if (!raw) return
            const parsed = ContentPayloadSchema.safeParse(raw)
            if (!parsed.success) return
            const itemType = parsed.data.type as ContentItem['type']
            const existingItems = useVibeBookingStore.getState().contentItems
            const existingOfType = existingItems.filter((i) => i.type === itemType)
            const itemData = (parsed.data as { data?: unknown }).data ?? parsed.data
            const actions = (raw as { actions?: ContentAction[] }).actions ?? []
            const metadata = (raw as { metadata?: ContentMetadata }).metadata ?? {}
            if (existingOfType.length > 0) {
              const [keep, ...extras] = existingOfType
              for (const dup of extras) store.removeContentItem(dup.id)
              store.updateContentItem(keep.id, {
                data: itemData,
                actions,
                metadata,
                status: 'ready',
                linkedMessageId: msgId,
              })
            } else {
              store.addContentItem({
                id: uuid(),
                type: itemType,
                data: itemData,
                actions,
                metadata,
                status: 'ready',
                timestamp: new Date().toISOString(),
                linkedMessageId: msgId,
              })
            }
          }

          for (const raw of resolveContentPayloads(data)) {
            addPayloadItem(raw)
          }
          break
        }

        case 'requires_login': {
          store.setTyping(false)
          store.setStreaming(false)
          if (data.text) {
            store.addMessage({
              id: uuid(),
              role: 'assistant',
              content: data.text,
              type: 'text',
              timestamp: new Date().toISOString(),
            })
          }
          store.setAuthModalOpen(true)
          break
        }

        case 'requires_payment': {
          store.setBooking({
            status: 'holding',
            bookingId: data.booking_id ?? '',
            reservedUntil: data.hold_expires_at ?? '',
          })
          // Surface the QR / payment card via content payload if backend included one
          const raw = data.content_payload
          if (raw) {
            const parsed = ContentPayloadSchema.safeParse(raw)
            if (parsed.success) {
              store.addContentItem({
                id: uuid(),
                type: parsed.data.type as ContentItem['type'],
                data: (parsed.data as { data?: unknown }).data ?? parsed.data,
                actions: (raw.actions as ContentAction[]) ?? [],
                metadata: (raw.metadata as ContentMetadata) ?? {},
                status: 'ready',
                timestamp: new Date().toISOString(),
              })
            }
          }
          break
        }

        case 'payment_status': {
          const payload = data.payload ?? {}
          if (payload.status === 'SUCCEEDED') {
            store.setBooking({
              status: 'confirmed',
              bookingId: payload.booking_id ?? '',
              bookingRef: payload.booking_ref ?? '',
            })
          } else if (payload.status === 'FAILED') {
            store.setBooking({
              status: 'failed',
              bookingId: payload.booking_id ?? '',
              error: payload.error ?? 'Payment failed',
            })
          }
          break
        }

        case 'booking_hold_expiry': {
          // Find and update QR payment item with countdown
          const items = store.contentItems
          const qrItem = items.findLast?.((i) => i.type === 'qr_payment')
          if (qrItem) {
            store.updateContentItem(qrItem.id, {
              data: {
                ...(qrItem.data as Record<string, unknown>),
                remaining_seconds: data.remaining_seconds ?? 0,
                expired: !!data.expired,
              },
            })
          }
          if (data.expired) store.setBooking({ status: 'idle' })
          break
        }

        case 'agent_tool_status':
          // Surface the running tool name so the loading label can show
          // "Searching hotels…" instead of a static "Thinking…".
          store.setToolStatus(data.status === 'running' ? String(data.name ?? '') : null)
          break

        case 'error':
          store.addMessage({
            id: uuid(),
            role: 'system',
            content: data.payload?.message ?? data.message ?? 'An error occurred.',
            type: 'error',
            timestamp: new Date().toISOString(),
          })
          break
      }
    }

    socket.onclose = () => {
      store.setConnectionStatus('disconnected')
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
      if (pongTimer.current) {
        clearTimeout(pongTimer.current)
        pongTimer.current = null
      }
      if (retries.current < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** retries.current, 30000)
        retries.current++
        retryTimer.current = setTimeout(() => connectRef.current?.(), delay)
      }
    }

    socket.onerror = () => store.setConnectionStatus('error')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, language, flushOutbox])

  // Keep ref in sync so onclose can call the latest connect without capturing it
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
      if (pongTimer.current) clearTimeout(pongTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback(
    (text: string, context?: string) => {
      store.addMessage({
        id: uuid(),
        role: 'user',
        content: text,
        type: 'text',
        ...(context ? { context } : {}),
        timestamp: new Date().toISOString(),
      })
      send({ type: 'user_message', content: text, ...(context ? { context } : {}) })
    },
    [store, send],
  )

  const sendFeedback = useCallback(
    (messageId: string, helpful: boolean) => {
      store.setMessageFeedback(messageId, helpful ? 'up' : 'down')
      // Feedback is fire-and-forget; never queue it offline.
      send({ type: 'feedback', message_id: messageId, helpful }, false)
    },
    [store, send],
  )

  const sendAction = useCallback(
    (actionType: string, itemId?: string, payload?: Record<string, unknown>) => {
      // Optimistic UI: mark the source item streaming while the AI processes,
      // cleared on the real typing_end response (clearPendingAction). The timer
      // is only a safety fallback if no response arrives.
      if (itemId) {
        clearPendingAction()
        store.updateContentItem(itemId, { status: 'streaming' })
        const timer = setTimeout(() => {
          store.updateContentItem(itemId, { status: 'ready' })
          pendingActionItem.current = null
        }, 30000)
        pendingActionItem.current = { id: itemId, timer }
      }
      if (actionType === 'payment_completed') {
        send({ type: 'payment_completed', ...payload } as unknown as WsOutbound)
      } else {
        send({ type: 'user_action', action_type: actionType, item_id: itemId, payload })
      }
    },
    [send, store, clearPendingAction],
  )

  // Reconnect on the same session_id after login so the auth message carries
  // the freshly stored token and the agent re-binds the session to the user.
  const reauth = useCallback(() => {
    retries.current = 0
    ws.current?.close()
    connectRef.current?.()
  }, [])

  return { sendMessage, sendAction, sendFeedback, reauth }
}
