import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'

// A controllable fake WebSocket so we can drive open/message/close in tests.
// jsdom provides no WebSocket, so this also acts as the polyfill.
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  // Test helpers
  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
  receive(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
}

const OUTBOX_KEY = 'derlg:vibe-booking:outbox'

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
  window.localStorage.removeItem(OUTBOX_KEY)
  window.localStorage.removeItem('derlg:vibe-booking')
  // Reset the shared store between tests.
  useVibeBookingStore.setState({
    messages: [],
    connectionStatus: 'disconnected',
    sessionId: null,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function last() {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
}

describe('useWebSocket', () => {
  it('connects, sets connecting/connected status and sends auth on open (Req 28.1, 28.7)', () => {
    renderHook(() => useWebSocket('user-1', 'EN'))
    expect(useVibeBookingStore.getState().connectionStatus).toBe('connecting')

    act(() => last().open())
    expect(useVibeBookingStore.getState().connectionStatus).toBe('connected')

    const auth = JSON.parse(last().sent[0])
    expect(auth).toMatchObject({ type: 'auth', user_id: 'user-1', preferred_language: 'EN' })
  })

  it('queues messages while disconnected and flushes them after reconnect (Req 28.6, 28.9)', () => {
    const { result } = renderHook(() => useWebSocket('user-1', 'EN'))
    // Socket is created but NOT open yet -> message should be queued, not sent.
    act(() => result.current.sendMessage('hello offline'))
    expect(last().sent).toHaveLength(0)
    expect(JSON.parse(window.localStorage.getItem(OUTBOX_KEY) as string)).toHaveLength(1)

    // Open the socket: auth + flushed queued message should be sent.
    act(() => last().open())
    const types = last().sent.map((s) => JSON.parse(s).type)
    expect(types).toContain('user_message')
    expect(window.localStorage.getItem(OUTBOX_KEY)).toBe('[]')
  })

  it('reconnects with exponential backoff after an unexpected close (Req 28.2, 28.3)', () => {
    vi.useFakeTimers()
    renderHook(() => useWebSocket('user-1', 'EN'))
    act(() => last().open())
    const firstCount = FakeWebSocket.instances.length

    act(() => last().close())
    expect(useVibeBookingStore.getState().connectionStatus).toBe('disconnected')

    // First backoff is 1000ms (1s * 2^0).
    act(() => vi.advanceTimersByTime(1000))
    expect(FakeWebSocket.instances.length).toBe(firstCount + 1)
  })

  it('closes the socket when a heartbeat ping is not answered by a pong (Req 28.4, 28.5)', () => {
    vi.useFakeTimers()
    renderHook(() => useWebSocket('user-1', 'EN'))
    act(() => last().open())
    const socket = last()

    // Advance to the heartbeat interval -> a ping is sent.
    act(() => vi.advanceTimersByTime(30000))
    expect(socket.sent.some((s) => JSON.parse(s).type === 'ping')).toBe(true)
    expect(socket.readyState).toBe(FakeWebSocket.OPEN)

    // No pong arrives within the liveness window -> socket is force-closed.
    act(() => vi.advanceTimersByTime(10000))
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED)
  })

  it('keeps the connection alive when a pong answers the heartbeat (Req 28.4)', () => {
    vi.useFakeTimers()
    renderHook(() => useWebSocket('user-1', 'EN'))
    act(() => last().open())
    const socket = last()

    act(() => vi.advanceTimersByTime(30000))
    act(() => socket.receive({ type: 'pong' }))
    // Even past the liveness window the socket stays open because pong cleared it.
    act(() => vi.advanceTimersByTime(10000))
    expect(socket.readyState).toBe(FakeWebSocket.OPEN)
  })
})
