'use client'

import { useEffect, useRef, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { ContentPayloadSchema } from '@/schemas/vibe-booking'
import type { ContentItem, ContentAction, ContentMetadata } from '@/stores/vibe-booking.store'
import type { WsOutbound } from '@/types/vibe-booking'

const AI_WS_URL = process.env.NEXT_PUBLIC_AI_WS_URL ?? 'ws://localhost:8000'
const MAX_RETRIES = 5
const HEARTBEAT_MS = 30000
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

export function useWebSocket(userId: string, language: 'EN' | 'ZH' | 'KH' = 'EN') {
  const ws = useRef<WebSocket | null>(null)
  const retries = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const outbox = useRef<WsOutbound[]>(loadQueue())
  const store = useVibeBookingStore()

  const flushOutbox = useCallback(() => {
    if (ws.current?.readyState !== WebSocket.OPEN) return
    while (outbox.current.length > 0) {
      const msg = outbox.current.shift()
      if (msg) ws.current.send(JSON.stringify(msg))
    }
    saveQueue(outbox.current)
  }, [])

  const send = useCallback(
    (msg: WsOutbound, queueIfOffline = true) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(msg))
      } else if (queueIfOffline && (msg.type === 'user_message' || msg.type === 'user_action')) {
        outbox.current.push(msg)
        saveQueue(outbox.current)
      }
    },
    [],
  )

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
          ...(store.sessionId ? { session_id: store.sessionId } : {}),
        }),
      )
      // Heartbeat
      heartbeatTimer.current && clearInterval(heartbeatTimer.current)
      heartbeatTimer.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }))
        }
      }, HEARTBEAT_MS)
      // Drain queued offline messages
      flushOutbox()
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data as string)

      switch (data.type) {
        case 'pong':
          // Heartbeat ack — nothing to do
          break

        case 'typing_start':
          store.setTyping(true)
          store.setStreaming(true)
          break

        case 'typing_end':
          store.setTyping(false)
          store.setStreaming(false)
          break

        case 'conversation_started':
        case 'conversation_resumed':
          if (data.session_id) store.setSessionId(data.session_id)
          if (data.text) {
            store.addMessage({
              id: uuid(),
              role: 'assistant',
              content: data.text,
              type: 'text',
              timestamp: new Date().toISOString(),
            })
          }
          break

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

          const msgId = uuid()
          store.addMessage({
            id: msgId,
            role: 'assistant',
            content: data.text ?? '',
            type: 'text',
            timestamp: new Date().toISOString(),
          })

          const raw = data.content_payload
          if (raw) {
            const parsed = ContentPayloadSchema.safeParse(raw)
            if (parsed.success) {
              const item: ContentItem = {
                id: uuid(),
                type: parsed.data.type as ContentItem['type'],
                data: (parsed.data as { data?: unknown }).data ?? parsed.data,
                actions: (raw.actions as ContentAction[]) ?? [],
                metadata: (raw.metadata as ContentMetadata) ?? {},
                status: 'ready',
                timestamp: new Date().toISOString(),
                linkedMessageId: msgId,
              }
              if (raw.metadata?.replace) {
                const last = store.contentItems.at(-1)
                if (last) store.removeContentItem(last.id)
              }
              store.addContentItem(item)
            }
          }
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
          // Optional: surface tool execution status in UI later
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
      if (retries.current < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** retries.current, 30000)
        retries.current++
        retryTimer.current = setTimeout(connect, delay)
      }
    }

    socket.onerror = () => store.setConnectionStatus('error')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, language, flushOutbox])

  useEffect(() => {
    connect()
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback(
    (text: string) => {
      store.addMessage({
        id: uuid(),
        role: 'user',
        content: text,
        type: 'text',
        timestamp: new Date().toISOString(),
      })
      send({ type: 'user_message', content: text })
    },
    [store, send],
  )

  const sendAction = useCallback(
    (actionType: string, itemId?: string, payload?: Record<string, unknown>) => {
      // Optimistic UI: mark the source item as streaming while AI processes
      if (itemId) {
        store.updateContentItem(itemId, { status: 'streaming' })
        setTimeout(() => store.updateContentItem(itemId, { status: 'ready' }), 8000)
      }
      if (actionType === 'payment_completed') {
        send({ type: 'payment_completed', ...payload } as unknown as WsOutbound)
      } else {
        send({ type: 'user_action', action_type: actionType, item_id: itemId, payload })
      }
    },
    [send, store],
  )

  return { sendMessage, sendAction }
}
