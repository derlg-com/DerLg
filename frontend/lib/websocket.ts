/**
 * WebSocketManager — standalone class for AI agent WebSocket connection.
 * Provides exponential backoff reconnect, offline message queue, and event API.
 * Used by useWebSocket hook; can also be instantiated directly.
 */

type Listener = (data: unknown) => void

export class WebSocketManager {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts: number
  private reconnectDelay = 1000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private messageQueue: Array<Record<string, unknown>> = []
  private readonly listeners: Map<string, Set<Listener>> = new Map()
  private readonly url: string
  private readonly token: string

  constructor(url: string, token: string, maxReconnectAttempts = 5) {
    this.url = url
    this.token = token
    this.maxReconnectAttempts = maxReconnectAttempts
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.ws = new WebSocket(`${this.url}?token=${this.token}`)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.reconnectDelay = 1000
      this._flushQueue()
      this._emit('connected', undefined)
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as Record<string, unknown>
        this._handleMessage(message)
      } catch {
        // malformed frame — ignore
      }
    }

    this.ws.onclose = (event) => {
      this._emit('disconnected', { code: event.code, reason: event.reason })
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this._scheduleReconnect()
      }
    }

    this.ws.onerror = (error) => {
      this._emit('error', error)
    }
  }

  send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  on(event: string, callback: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts // prevent auto-reconnect
    this.ws?.close(1000, 'Client disconnect')
    this.ws = null
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private _scheduleReconnect(): void {
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private _flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) this.send(message)
    }
  }

  private _handleMessage(message: Record<string, unknown>): void {
    const type = message.type as string
    this._emit(type, message)
    this._emit('message', message)
  }

  private _emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(data))
  }
}
