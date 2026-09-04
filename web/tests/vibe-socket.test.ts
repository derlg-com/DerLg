import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chunkText,
  CloseCode,
  isRetryableClose,
  parseInboundFrame,
} from '@/lib/vibe/protocol'
import { getOrCreateGuestId, getOrCreateSessionId, isUuid, resetSessionId } from '@/lib/vibe/session-id'
import { VibeSocket, type ConnectionStatus } from '@/lib/vibe/socket'

/**
 * Minimal WebSocket double.
 *
 * Records what the client sent and lets a test drive open/message/close, which is
 * what makes handshake, reconnect and replay behaviour testable without a server.
 */
class MockSocket {
  static instances: MockSocket[] = []

  readyState = 0
  sent: string[] = []
  private listeners = new Map<string, Set<(event: unknown) => void>>()

  constructor(public url: string) {
    MockSocket.instances.push(this)
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code = 1000) {
    this.readyState = 3
    this.emit('close', { code, reason: '' })
  }

  /* -------- test drivers -------- */

  open() {
    this.readyState = 1
    this.emit('open', {})
  }

  receive(frame: unknown) {
    this.emit('message', { data: JSON.stringify(frame) })
  }

  receiveRaw(data: string) {
    this.emit('message', { data })
  }

  serverClose(code: number) {
    this.readyState = 3
    this.emit('close', { code, reason: '' })
  }

  get frames(): Record<string, unknown>[] {
    return this.sent.map((entry) => JSON.parse(entry) as Record<string, unknown>)
  }

  private emit(type: string, event: unknown) {
    this.listeners.get(type)?.forEach((listener) => listener(event))
  }
}

function createSocket(overrides: Partial<Parameters<typeof buildOptions>[0]> = {}) {
  const frames: unknown[] = []
  const statuses: ConnectionStatus[] = []
  const options = buildOptions({ frames, statuses, ...overrides })
  const socket = new VibeSocket(options)
  return { socket, frames, statuses }
}

function buildOptions(config: {
  frames: unknown[]
  statuses: ConnectionStatus[]
  token?: string
}) {
  return {
    url: 'ws://localhost:8000/ws/chat',
    getAuth: () => ({
      user_id: 'guest-1',
      session_id: '11111111-1111-4111-8111-111111111111',
      ...(config.token ? { token: config.token } : {}),
      preferred_language: 'EN' as const,
    }),
    onFrame: (frame: unknown) => config.frames.push(frame),
    onStatusChange: (status: ConnectionStatus) => config.statuses.push(status),
    socketFactory: (url: string) => new MockSocket(url) as unknown as WebSocket,
  }
}

const HELLO = {
  type: 'conversation_started',
  text: 'Welcome to DerLg!',
  session_id: '11111111-1111-4111-8111-111111111111',
  suggested_prompts: ['Plan a 3-day Siem Reap temple tour'],
}

beforeEach(() => {
  MockSocket.instances = []
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('protocol parsing', () => {
  it('accepts the real conversation_started frame', () => {
    const frame = parseInboundFrame(JSON.stringify(HELLO))
    expect(frame?.type).toBe('conversation_started')
  })

  it('accepts an agent_message carrying content_payloads and suggestions', () => {
    const frame = parseInboundFrame(
      JSON.stringify({
        type: 'agent_message',
        text: 'Here are three trips',
        content_payloads: [{ type: 'trip_cards', data: { trips: [] } }],
        suggestions: ['Show hotels'],
      }),
    )
    expect(frame?.type).toBe('agent_message')
  })

  it('accepts the singular content_payload for backward compatibility', () => {
    const frame = parseInboundFrame(
      JSON.stringify({
        type: 'agent_message',
        text: 'One block',
        content_payload: { type: 'text_summary', data: { text: 'hi' } },
      }),
    )
    expect(frame?.type).toBe('agent_message')
  })

  it('drops malformed and unknown frames rather than throwing', () => {
    expect(parseInboundFrame('not json')).toBeNull()
    expect(parseInboundFrame(JSON.stringify({ type: 'who_knows' }))).toBeNull()
    // A known type with a missing required field is still invalid.
    expect(parseInboundFrame(JSON.stringify({ type: 'agent_message' }))).toBeNull()
  })

  it('normalises the several field names used for streamed text', () => {
    const withContent = parseInboundFrame(
      JSON.stringify({ type: 'agent_stream_chunk', content: 'a' }),
    )!
    const withText = parseInboundFrame(JSON.stringify({ type: 'agent_stream_chunk', text: 'b' }))!
    const withDelta = parseInboundFrame(JSON.stringify({ type: 'agent_stream_chunk', delta: 'c' }))!

    expect(chunkText(withContent)).toBe('a')
    expect(chunkText(withText)).toBe('b')
    expect(chunkText(withDelta)).toBe('c')
  })

  it('classifies close codes so hopeless reconnects are avoided', () => {
    expect(isRetryableClose(1006)).toBe(true)
    expect(isRetryableClose(CloseCode.HANDSHAKE_FAILED)).toBe(true)

    // Retrying these would loop forever with the same outcome.
    expect(isRetryableClose(CloseCode.NORMAL)).toBe(false)
    expect(isRetryableClose(CloseCode.INVALID_TOKEN)).toBe(false)
    expect(isRetryableClose(CloseCode.ORIGIN_REJECTED)).toBe(false)
    expect(isRetryableClose(CloseCode.HANDSHAKE_REJECTED)).toBe(false)
  })
})

describe('VibeSocket handshake', () => {
  it('sends the auth frame immediately on open', () => {
    const { socket } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()

    expect(mock.frames[0]).toMatchObject({
      type: 'auth',
      user_id: 'guest-1',
      preferred_language: 'EN',
    })
  })

  it('includes the token when one is available, so booking unlocks', () => {
    const { socket } = createSocket({ token: 'jwt-token' })
    socket.connect()

    MockSocket.instances[0]!.open()
    expect(MockSocket.instances[0]!.frames[0]).toMatchObject({ token: 'jwt-token' })
  })

  it('omits the token entirely for a guest', () => {
    const { socket } = createSocket()
    socket.connect()

    MockSocket.instances[0]!.open()
    expect(MockSocket.instances[0]!.frames[0]).not.toHaveProperty('token')
  })

  it('reports connected only once the agent acknowledges', () => {
    const { socket, statuses } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()
    expect(statuses).not.toContain('connected')

    mock.receive(HELLO)
    expect(statuses).toContain('connected')
  })

  it('closes the socket when the handshake is never acknowledged', () => {
    const { socket } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()

    // The agent gives 10s; the client gives up just before that.
    vi.advanceTimersByTime(9_500)
    expect(mock.readyState).toBe(3)
  })

  it('does not open a second socket under StrictMode double-invocation', () => {
    const { socket } = createSocket()
    socket.connect()
    socket.connect()

    expect(MockSocket.instances).toHaveLength(1)
  })
})

describe('VibeSocket messaging', () => {
  it('forwards validated frames to the consumer', () => {
    const { socket, frames } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()
    mock.receive(HELLO)
    mock.receive({ type: 'agent_message', text: 'Hello there' })

    expect(frames).toHaveLength(2)
  })

  it('drops invalid frames without forwarding them', () => {
    const { socket, frames } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()
    mock.receive(HELLO)
    mock.receiveRaw('{ not json')
    mock.receive({ type: 'unknown_frame' })

    expect(frames).toHaveLength(1)
  })

  it('sends user messages once ready', () => {
    const { socket } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()
    mock.receive(HELLO)

    socket.send({ type: 'user_message', content: 'Find me a temple tour' })
    expect(mock.frames.at(-1)).toMatchObject({
      type: 'user_message',
      content: 'Find me a temple tour',
    })
  })

  it('sends a heartbeat so a dead connection is noticed', () => {
    const { socket } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()
    mock.receive(HELLO)

    vi.advanceTimersByTime(26_000)
    expect(mock.frames.some((frame) => frame.type === 'ping')).toBe(true)
  })
})

describe('VibeSocket offline queue', () => {
  it('queues a message sent before the handshake completes', () => {
    const { socket } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()

    socket.send({ type: 'user_message', content: 'queued' })
    expect(socket.queueLength).toBe(1)
    expect(mock.frames.some((frame) => frame.type === 'user_message')).toBe(false)
  })

  it('replays queued messages once connected', () => {
    const { socket } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()
    socket.send({ type: 'user_message', content: 'queued' })

    mock.receive(HELLO)

    expect(socket.queueLength).toBe(0)
    expect(mock.frames.some((frame) => frame.content === 'queued')).toBe(true)
  })

  it('never queues auth or ping frames', () => {
    const { socket } = createSocket()
    socket.connect()
    MockSocket.instances[0]!.open()

    // A stale handshake would authenticate with an outdated token.
    socket.send({ type: 'ping' })
    expect(socket.queueLength).toBe(0)
  })

  it('bounds the queue so a long outage cannot exhaust memory', () => {
    const { socket } = createSocket()
    socket.connect()
    MockSocket.instances[0]!.open()

    for (let index = 0; index < 80; index += 1) {
      socket.send({ type: 'user_message', content: `message ${index}` })
    }

    expect(socket.queueLength).toBeLessThanOrEqual(50)
  })
})

describe('VibeSocket reconnection', () => {
  it('reconnects after an abnormal close', () => {
    const { socket, statuses } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()
    mock.receive(HELLO)

    mock.serverClose(1006)
    expect(statuses).toContain('reconnecting')

    // Backoff has jitter, so advance generously.
    vi.advanceTimersByTime(5_000)
    expect(MockSocket.instances.length).toBeGreaterThan(1)
  })

  it('replays the queue across a reconnect', () => {
    const { socket } = createSocket()
    socket.connect()

    const first = MockSocket.instances[0]!
    first.open()
    first.receive(HELLO)
    first.serverClose(1006)

    socket.send({ type: 'user_message', content: 'sent while offline' })
    expect(socket.queueLength).toBe(1)

    vi.advanceTimersByTime(5_000)
    const second = MockSocket.instances[1]!
    second.open()
    second.receive(HELLO)

    expect(second.frames.some((frame) => frame.content === 'sent while offline')).toBe(true)
  })

  it('does not reconnect when the origin was rejected', () => {
    const { socket, statuses } = createSocket()
    socket.connect()

    MockSocket.instances[0]!.serverClose(CloseCode.ORIGIN_REJECTED)

    expect(statuses).toContain('rejected')
    vi.advanceTimersByTime(60_000)
    expect(MockSocket.instances).toHaveLength(1)
  })

  it('does not reconnect when the token was invalid', () => {
    const { socket, statuses } = createSocket({ token: 'bad' })
    socket.connect()

    MockSocket.instances[0]!.serverClose(CloseCode.INVALID_TOKEN)

    expect(statuses).toContain('rejected')
    vi.advanceTimersByTime(60_000)
    expect(MockSocket.instances).toHaveLength(1)
  })

  it('stops everything on dispose', () => {
    const { socket } = createSocket()
    socket.connect()

    const mock = MockSocket.instances[0]!
    mock.open()
    mock.receive(HELLO)

    socket.dispose()
    expect(socket.getStatus()).toBe('closed')

    // No reconnect, and no further heartbeats.
    const before = mock.sent.length
    vi.advanceTimersByTime(60_000)
    expect(MockSocket.instances).toHaveLength(1)
    expect(mock.sent.length).toBe(before)
  })
})

describe('session identifiers', () => {
  it('creates and reuses a valid UUID session id', () => {
    const first = getOrCreateSessionId()
    expect(isUuid(first)).toBe(true)
    expect(getOrCreateSessionId()).toBe(first)
  })

  it('replaces a corrupted session id, since the agent rejects non-UUIDs', () => {
    localStorage.setItem('derlg-chat-session', 'not-a-uuid')
    const id = getOrCreateSessionId()
    expect(isUuid(id)).toBe(true)
  })

  it('resetSessionId starts a new conversation', () => {
    const first = getOrCreateSessionId()
    const second = resetSessionId()
    expect(second).not.toBe(first)
    expect(isUuid(second)).toBe(true)
  })

  it('reuses a stable guest id so agent rate limiting stays meaningful', () => {
    const first = getOrCreateGuestId()
    expect(first.startsWith('guest-')).toBe(true)
    expect(getOrCreateGuestId()).toBe(first)
  })
})
