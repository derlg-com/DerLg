'use client'

import { useEffect, useRef, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useChatStore } from '@/stores/chat.store'
import { useContentStore } from '@/stores/content.store'
import { ContentPayloadSchema } from '@/schemas/vibe-booking'
import type { WsOutbound, ContentPayload } from '@/types/vibe-booking'

const AI_WS_URL = process.env.NEXT_PUBLIC_AI_WS_URL ?? 'ws://localhost:8000'
const MAX_RETRIES = 5

export function useWebSocket(userId: string, language: 'EN' | 'ZH' | 'KH' = 'EN') {
  const ws = useRef<WebSocket | null>(null)
  const retries = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { addMessage, setTyping, setConnectionStatus, setAgentState, sessionId, setSessionId } =
    useChatStore()
  const { addItem, replaceLatest } = useContentStore()

  const send = useCallback((msg: WsOutbound) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }, [])

  const connect = useCallback(() => {
    const sid = sessionId ?? uuid()
    if (!sessionId) setSessionId(sid)

    setConnectionStatus('connecting')
    const socket = new WebSocket(`${AI_WS_URL}/ws/${sid}`)
    ws.current = socket

    socket.onopen = () => {
      retries.current = 0
      setConnectionStatus('connected')
      send({ type: 'auth', user_id: userId, preferred_language: language })
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data as string)

      switch (data.type) {
        case 'typing_start':
          setTyping(true)
          break
        case 'typing_end':
          setTyping(false)
          break
        case 'agent_message': {
          setTyping(false)
          if (data.state) setAgentState(data.state)
          addMessage({ id: uuid(), role: 'agent', text: data.text ?? '', timestamp: Date.now() })

          const raw = data.content_payload
          if (raw) {
            const parsed = ContentPayloadSchema.safeParse(raw)
            if (parsed.success) {
              const item = { id: uuid(), type: parsed.data.type, payload: parsed.data, timestamp: Date.now() }
              raw.metadata?.replace ? replaceLatest(item) : addItem(item)
            }
          }
          break
        }
        case 'payment_status':
          // handled by booking store if needed
          break
        case 'error':
          addMessage({ id: uuid(), role: 'agent', text: data.payload?.message ?? 'An error occurred.', timestamp: Date.now() })
          break
      }
    }

    socket.onclose = () => {
      setConnectionStatus('disconnected')
      if (retries.current < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** retries.current, 30000)
        retries.current++
        retryTimer.current = setTimeout(connect, delay)
      }
    }

    socket.onerror = () => setConnectionStatus('error')
  }, [userId, language, sessionId, setSessionId, send, addMessage, setTyping, setConnectionStatus, setAgentState, addItem, replaceLatest])

  useEffect(() => {
    connect()
    return () => {
      retryTimer.current && clearTimeout(retryTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((text: string) => {
    addMessage({ id: uuid(), role: 'user', text, timestamp: Date.now() })
    send({ type: 'user_message', content: text })
  }, [addMessage, send])

  const sendAction = useCallback((actionType: string, itemId?: string, payload?: Record<string, unknown>) => {
    send({ type: 'user_action', action_type: actionType, item_id: itemId, payload })
  }, [send])

  return { sendMessage, sendAction }
}
