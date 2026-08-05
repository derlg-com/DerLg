'use client'

import { useLocale } from 'next-intl'
import * as React from 'react'

import { useAccessToken, useSession } from '@/hooks/use-auth'
import { toAgentLanguage, type Locale } from '@/lib/i18n/config'
import { getOrCreateGuestId, getOrCreateSessionId, resetSessionId } from '@/lib/vibe/session-id'
import { VibeSocket, type ConnectionStatus, type InboundFrame } from '@/lib/vibe/socket'
import type { OutboundFrame } from '@/lib/vibe/protocol'

const AGENT_URL = `${process.env.NEXT_PUBLIC_AI_WS_URL ?? 'ws://localhost:8000'}/ws/chat`

export interface UseVibeSocketResult {
  status: ConnectionStatus
  /** Close code when the connection was terminally rejected. */
  rejectedCode: number | null
  send: (frame: OutboundFrame) => void
  reconnect: () => void
  /** Abandons the current conversation and starts a new one. */
  startNewConversation: () => void
  queueLength: number
}

/**
 * Owns the agent connection for the lifetime of the chat view.
 *
 * The socket is created once and torn down on unmount. The auth details are read
 * lazily at handshake time, so a token acquired after mount (the user signs in
 * mid-conversation) is used on the next connection without recreating anything.
 */
export function useVibeSocket({
  onFrame,
}: {
  onFrame: (frame: InboundFrame) => void
}): UseVibeSocketResult {
  const locale = useLocale() as Locale
  const token = useAccessToken()
  const { ready: sessionReady } = useSession()

  const [status, setStatus] = React.useState<ConnectionStatus>('idle')
  const [rejectedCode, setRejectedCode] = React.useState<number | null>(null)
  const [queueLength, setQueueLength] = React.useState(0)

  const socketRef = React.useRef<VibeSocket | null>(null)

  // Latest values without forcing the socket to be rebuilt when they change.
  const onFrameRef = React.useRef(onFrame)
  const tokenRef = React.useRef(token)
  const localeRef = React.useRef(locale)
  React.useEffect(() => {
    onFrameRef.current = onFrame
    tokenRef.current = token
    localeRef.current = locale
  })

  React.useEffect(() => {
    // Wait for the session bootstrap to settle: connecting first would hand the
    // agent a guest handshake and leave booking locked for a signed-in user.
    if (!sessionReady) return

    const socket = new VibeSocket({
      url: AGENT_URL,
      getAuth: () => ({
        // A verified token re-binds the session to the real user; otherwise the
        // stable guest id keeps the agent's rate limiting meaningful.
        user_id: getOrCreateGuestId(),
        session_id: getOrCreateSessionId(),
        ...(tokenRef.current ? { token: tokenRef.current } : {}),
        preferred_language: toAgentLanguage(localeRef.current),
      }),
      onFrame: (frame) => onFrameRef.current(frame),
      onStatusChange: (next, detail) => {
        setStatus(next)
        setRejectedCode(next === 'rejected' ? (detail?.code ?? null) : null)
        setQueueLength(socketRef.current?.queueLength ?? 0)
      },
    })

    socketRef.current = socket
    socket.connect()

    return () => {
      socket.dispose()
      socketRef.current = null
    }
  }, [sessionReady])

  const send = React.useCallback((frame: OutboundFrame) => {
    socketRef.current?.send(frame)
    setQueueLength(socketRef.current?.queueLength ?? 0)
  }, [])

  const reconnect = React.useCallback(() => {
    socketRef.current?.connect()
  }, [])

  const startNewConversation = React.useCallback(() => {
    resetSessionId()
    // Reconnecting with the new id makes the agent open a fresh conversation.
    socketRef.current?.dispose()
    socketRef.current = null
    setStatus('idle')
    // A full remount is triggered by the caller clearing its transcript state.
  }, [])

  return { status, rejectedCode, send, reconnect, startNewConversation, queueLength }
}
