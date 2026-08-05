/**
 * WebSocket client for the Vibe Booking agent.
 *
 * Responsibilities, in the order they matter:
 *  1. Complete the `auth` handshake inside the agent's 10-second window.
 *  2. Reconnect with exponential backoff and jitter, but ONLY for failures where
 *     retrying could help — a rejected origin or an invalid token would loop.
 *  3. Queue messages sent while disconnected and replay them on reconnect, since
 *     Cambodian mobile networks drop out regularly.
 *  4. Heartbeat, so a silently dead connection is noticed.
 *
 * Deliberately framework-agnostic: no React imports, so it can be unit tested
 * against a mock server without a renderer.
 */
import {
  CloseCode,
  chunkText,
  isRetryableClose,
  parseInboundFrame,
  type AuthFrame,
  type InboundFrame,
  type OutboundFrame,
} from './protocol'

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  /** Terminal: retrying cannot help (bad token, rejected origin). */
  | 'rejected'
  | 'closed'

export interface VibeSocketOptions {
  url: string
  /** Resolved lazily so a token acquired after construction is still used. */
  getAuth: () => Omit<AuthFrame, 'type'>
  onFrame: (frame: InboundFrame) => void
  onStatusChange: (status: ConnectionStatus, detail?: { code?: number }) => void
  /** Injectable for tests. */
  socketFactory?: (url: string) => WebSocket
}

const HEARTBEAT_INTERVAL_MS = 25_000
const HANDSHAKE_TIMEOUT_MS = 9_000
const MAX_RECONNECT_DELAY_MS = 30_000
const MAX_QUEUE_LENGTH = 50

export class VibeSocket {
  private socket: WebSocket | null = null
  private status: ConnectionStatus = 'idle'
  private attempts = 0
  private queue: OutboundFrame[] = []
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  /** True once the agent has acknowledged the handshake. */
  private ready = false

  constructor(private readonly options: VibeSocketOptions) {}

  getStatus(): ConnectionStatus {
    return this.status
  }

  get queueLength(): number {
    return this.queue.length
  }

  connect(): void {
    if (this.disposed) return
    // Never open a second socket: React StrictMode mounts effects twice in dev,
    // and a duplicate connection would double every message.
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) return

    this.setStatus(this.attempts === 0 ? 'connecting' : 'reconnecting')

    const factory = this.options.socketFactory ?? ((url: string) => new WebSocket(url))
    let socket: WebSocket
    try {
      socket = factory(this.options.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.socket = socket
    this.ready = false

    socket.addEventListener('open', () => this.onOpen())
    socket.addEventListener('message', (event) => this.onMessage(event))
    socket.addEventListener('close', (event) => this.onClose(event))
    socket.addEventListener('error', () => {
      // 'error' carries no detail by design; 'close' always follows, so the
      // reconnect decision is made there where the code is available.
    })
  }

  /** Closes the socket and stops all timers. Not resumable. */
  dispose(): void {
    this.disposed = true
    this.clearTimers()
    this.queue = []

    const socket = this.socket
    this.socket = null
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
      socket.close(CloseCode.NORMAL)
    }
    this.setStatus('closed')
  }

  /**
   * Sends a frame, or queues it when offline.
   *
   * The handshake itself is never queued: it is re-sent from scratch on every
   * connection, so a stale one would authenticate with an outdated token.
   */
  send(frame: OutboundFrame): void {
    if (this.disposed) return

    if (this.ready && this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify(frame))
      return
    }

    if (frame.type === 'auth' || frame.type === 'ping') return

    // Bound the queue so a long outage cannot exhaust memory.
    if (this.queue.length >= MAX_QUEUE_LENGTH) this.queue.shift()
    this.queue.push(frame)
  }

  private onOpen(): void {
    this.attempts = 0

    // The agent closes the socket if the handshake does not arrive in time.
    const auth = this.options.getAuth()
    this.socket?.send(JSON.stringify({ type: 'auth', ...auth } satisfies OutboundFrame))

    this.handshakeTimer = setTimeout(() => {
      if (!this.ready) this.socket?.close(CloseCode.HANDSHAKE_FAILED)
    }, HANDSHAKE_TIMEOUT_MS)
  }

  private onMessage(event: MessageEvent): void {
    const frame = parseInboundFrame(String(event.data))
    // Unrecognised frames are dropped: the agent is a separate service and its
    // output is untrusted input.
    if (!frame) return

    if (!this.ready && (frame.type === 'conversation_started' || frame.type === 'conversation_resumed')) {
      this.onHandshakeComplete()
    }

    this.options.onFrame(frame)
  }

  private onHandshakeComplete(): void {
    this.ready = true
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer)
    this.handshakeTimer = null

    this.setStatus('connected')
    this.startHeartbeat()
    this.flushQueue()
  }

  private onClose(event: CloseEvent): void {
    this.ready = false
    this.stopHeartbeat()
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer)
    this.handshakeTimer = null
    this.socket = null

    if (this.disposed) return

    if (!isRetryableClose(event.code)) {
      // Terminal: a rejected origin or bad token will fail identically forever.
      this.setStatus('rejected', { code: event.code })
      return
    }

    this.scheduleReconnect(event.code)
  }

  private scheduleReconnect(code?: number): void {
    if (this.disposed) return

    this.attempts += 1
    // Exponential backoff with jitter, so many clients reconnecting after an
    // outage do not arrive in lockstep.
    const base = Math.min(1000 * 2 ** (this.attempts - 1), MAX_RECONNECT_DELAY_MS)
    const delay = base / 2 + Math.random() * (base / 2)

    this.setStatus('reconnecting', { code })
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private flushQueue(): void {
    const pending = this.queue
    this.queue = []
    for (const frame of pending) this.send(frame)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeat = setInterval(() => {
      if (this.socket?.readyState === 1) this.socket.send(JSON.stringify({ type: 'ping' }))
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
  }

  private clearTimers(): void {
    this.stopHeartbeat()
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.handshakeTimer = null
    this.reconnectTimer = null
  }

  private setStatus(status: ConnectionStatus, detail?: { code?: number }): void {
    if (this.status === status && detail?.code === undefined) return
    this.status = status
    this.options.onStatusChange(status, detail)
  }
}

export { chunkText, CloseCode }
export type { InboundFrame, OutboundFrame }
