/**
 * Task 18.2.6 — Integration tests for WebSocket content routing.
 *
 * Wires a fake WebSocket server into the browser global, drives the
 * `WebSocketManager` event API the way the real chat UI does, and asserts
 * that valid `agent_message` payloads are decoded and that the right
 * listener fires for every server-to-client message type.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketManager } from '@/lib/websocket'
import { ContentPayloadSchema } from '@/schemas/vibe-booking'

interface FakeFrame {
  ws: FakeWebSocket
  type: 'open' | 'message' | 'close' | 'error'
  data?: string
}

class FakeWebSocket {
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeWebSocket[] = []

  url: string
  readyState = 0
  onopen: ((ev: unknown) => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code: number; reason: string; wasClean: boolean }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  sent: string[] = []

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  close(code = 1000, reason = 'normal') {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason, wasClean: code === 1000 })
  }

  // helpers used by the test driver
  _open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.({})
  }

  _push(frame: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(frame) })
  }
}

let originalWebSocket: typeof WebSocket | undefined

beforeEach(() => {
  originalWebSocket = (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket
  ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket
  ;(FakeWebSocket as unknown as { OPEN: number }).OPEN = 1
  ;(globalThis as { WebSocket: typeof WebSocket }).WebSocket = FakeWebSocket as unknown as typeof WebSocket
  FakeWebSocket.instances = []
})

afterEach(() => {
  if (originalWebSocket) {
    ;(globalThis as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket
  }
})

const TRIP_CARDS_FRAME = {
  type: 'agent_message',
  text: 'Found 1 trip',
  content_payload: {
    type: 'trip_cards',
    data: {
      trips: [
        {
          id: 't-1',
          name: 'Angkor Sunrise',
          durationDays: 2,
          priceUsd: 189,
        },
      ],
    },
  },
}

const QR_FRAME = {
  type: 'requires_payment',
  booking_id: 'b-1',
  hold_expires_at: '2026-05-25T13:00:00Z',
  content_payload: {
    type: 'qr_payment',
    data: {
      qrUrl: 'https://qr.example/abc',
      amount: { usd: 100 },
      expiry: '2026-05-25T13:00:00Z',
      paymentIntentId: 'pi_1',
    },
  },
}

describe('WebSocketManager — content routing', () => {
  it('flushes the offline queue after the socket opens', () => {
    const mgr = new WebSocketManager('ws://test', 'tok')
    // queued before connect — must replay on open
    mgr.send({ type: 'user_message', content: 'hi' })
    mgr.connect()
    const sock = FakeWebSocket.instances[0]
    expect(sock.sent).toEqual([])

    sock._open()

    expect(sock.sent).toHaveLength(1)
    expect(JSON.parse(sock.sent[0])).toMatchObject({ type: 'user_message', content: 'hi' })
  })

  it('routes a typed event to its named listener', () => {
    const mgr = new WebSocketManager('ws://test', 'tok')
    const onAgentMessage = vi.fn()
    mgr.on('agent_message', onAgentMessage)
    mgr.connect()
    FakeWebSocket.instances[0]._open()
    FakeWebSocket.instances[0]._push(TRIP_CARDS_FRAME)

    expect(onAgentMessage).toHaveBeenCalledTimes(1)
    const arg = onAgentMessage.mock.calls[0][0] as { type: string; content_payload: unknown }
    expect(arg.type).toBe('agent_message')
    // The payload that arrives at the listener must validate against the schema
    const parsed = ContentPayloadSchema.safeParse(arg.content_payload)
    expect(parsed.success).toBe(true)
  })

  it('also fans out every message via the generic "message" listener', () => {
    const mgr = new WebSocketManager('ws://test', 'tok')
    const onAny = vi.fn()
    mgr.on('message', onAny)
    mgr.connect()
    FakeWebSocket.instances[0]._open()

    FakeWebSocket.instances[0]._push({ type: 'typing_start' })
    FakeWebSocket.instances[0]._push({ type: 'typing_end' })

    expect(onAny).toHaveBeenCalledTimes(2)
    expect((onAny.mock.calls[0][0] as { type: string }).type).toBe('typing_start')
    expect((onAny.mock.calls[1][0] as { type: string }).type).toBe('typing_end')
  })

  it('routes requires_payment so a qr_payment payload validates', () => {
    const mgr = new WebSocketManager('ws://test', 'tok')
    const onRequiresPayment = vi.fn()
    mgr.on('requires_payment', onRequiresPayment)
    mgr.connect()
    FakeWebSocket.instances[0]._open()
    FakeWebSocket.instances[0]._push(QR_FRAME)

    expect(onRequiresPayment).toHaveBeenCalled()
    const arg = onRequiresPayment.mock.calls[0][0] as { content_payload: unknown }
    const parsed = ContentPayloadSchema.safeParse(arg.content_payload)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.type).toBe('qr_payment')
    }
  })

  it('drops malformed JSON frames without crashing the manager', () => {
    const mgr = new WebSocketManager('ws://test', 'tok')
    const onAny = vi.fn()
    mgr.on('message', onAny)
    mgr.connect()
    const sock = FakeWebSocket.instances[0]
    sock._open()

    // Hand a non-JSON string to onmessage directly
    sock.onmessage?.({ data: '<<not-json>>' })
    sock._push({ type: 'agent_message', text: 'ok', content_payload: undefined })

    expect(onAny).toHaveBeenCalledTimes(1)
    expect(onAny.mock.calls[0][0]).toMatchObject({ type: 'agent_message', text: 'ok' })
  })

  it('rejects payloads whose schema validation fails', () => {
    // `trip_cards.data.trips[].priceUsd` is required — missing it should fail
    const bad = {
      type: 'trip_cards',
      data: {
        trips: [{ id: 't-1', name: 'broken', durationDays: 1 }],
      },
    }
    const result = ContentPayloadSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('disconnect prevents auto-reconnect even on close', () => {
    const mgr = new WebSocketManager('ws://test', 'tok')
    const onDisconnected = vi.fn()
    mgr.on('disconnected', onDisconnected)
    mgr.connect()
    const sock = FakeWebSocket.instances[0]
    sock._open()
    mgr.disconnect()
    // After disconnect(), the manager should not spawn a new socket on close
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(onDisconnected).toHaveBeenCalled()
  })
})
