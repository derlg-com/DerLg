'use client'

import { useEffect, useRef, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { ContentPayloadSchema } from '@/schemas/vibe-booking'
import type { ContentItem, ContentAction, ContentMetadata } from '@/stores/vibe-booking.store'
import type { WsOutbound } from '@/types/vibe-booking'

const AI_WS_URL = process.env.NEXT_PUBLIC_AI_WS_URL ?? 'ws://localhost:8000'
const MAX_RETRIES = 5

export function useWebSocket(userId: string, language: 'EN' | 'ZH' | 'KH' = 'EN') {
  const ws = useRef<WebSocket | null>(null)
  const retries = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const store = useVibeBookingStore()

  const send = useCallback((msg: WsOutbound) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }, [])

  const connect = useCallback(() => {
    const sid = store.sessionId ?? uuid()
    if (!store.sessionId) store.setSessionId(sid)

    store.setConnectionStatus('connecting')
    const socket = new WebSocket(`${AI_WS_URL}/ws/${sid}`)
    ws.current = socket

    socket.onopen = () => {
      retries.current = 0
      store.setConnectionStatus('connected')
      send({ type: 'auth', user_id: userId, preferred_language: language })
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data as string)

      switch (data.type) {
        case 'typing_start':
          store.setTyping(true)
          store.setStreaming(true)
          break

        case 'typing_end':
          store.setTyping(false)
          store.setStreaming(false)
          break

        case 'agent_message': {
          store.setTyping(false)
          store.setStreaming(false)

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

        case 'payment_status': {
          const payload = data.payload ?? {}
          if (payload.status === 'SUCCEEDED') {
            store.setBooking({
              status: 'confirmed',
              bookingId: payload.booking_id ?? '',
              bookingRef: payload.booking_ref ?? '',
            })
          }
          break
        }

        case 'booking_hold_expiry':
          store.setBooking({ status: 'idle' })
          break

        case 'error':
          store.addMessage({
            id: uuid(),
            role: 'system',
            content: data.payload?.message ?? 'An error occurred.',
            type: 'error',
            timestamp: new Date().toISOString(),
          })
          break
      }
    }

    socket.onclose = () => {
      store.setConnectionStatus('disconnected')
      if (retries.current < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** retries.current, 30000)
        retries.current++
        retryTimer.current = setTimeout(connect, delay)
      }
    }

    socket.onerror = () => store.setConnectionStatus('error')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, language])

  useEffect(() => {
    connect()
    return () => {
      retryTimer.current && clearTimeout(retryTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((text: string) => {
    store.addMessage({
      id: uuid(),
      role: 'user',
      content: text,
      type: 'text',
      timestamp: new Date().toISOString(),
    })
    send({ type: 'user_message', content: text })
  }, [store, send])

  const sendAction = useCallback((actionType: string, itemId?: string, payload?: Record<string, unknown>) => {
    send({ type: 'user_action', action_type: actionType, item_id: itemId, payload })
  }, [send])

  return { sendMessage, sendAction }
}
