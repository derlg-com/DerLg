# WebSocketManager TypeScript Class

> **Source:** `.kiro/specs/vibe-booking/design.md` (original backend spec, WebSocket section)
> **Consolidated into:** `.kiro/specs/vibe-booking-final/design.md`
> **Note:** This full class implementation was present in the original but replaced with a conceptual `useWebSocket` hook description in the consolidated spec.

---

## Full Implementation

```typescript
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // ms, doubles each attempt
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: Array<Record<string, unknown>> = [];
  private url: string;
  private token: string;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${this.url}?token=${this.token}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
      this.emit('connected', undefined);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };

    this.ws.onclose = (event) => {
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
      this.emit('disconnected', { code: event.code, reason: event.reason });
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) this.send(message);
    }
  }

  private handleMessage(message: Record<string, unknown>): void {
    const type = message.type as string;
    this.emit(type, message);
    this.emit('message', message);
  }

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

---

## Usage in React (Conceptual)

```typescript
const wsManager = useMemo(
  () => new WebSocketManager('wss://api.derlg.com/ws/chat', authToken),
  [authToken]
);

useEffect(() => {
  wsManager.connect();
  const unsub = wsManager.on('agent_message', (msg) => {
    // Handle agent message
  });
  return () => {
    unsub();
    wsManager.disconnect();
  };
}, [wsManager]);
```

---

## Why This Matters

The consolidated spec describes a `useWebSocket` hook but omits the concrete class implementation. The `WebSocketManager` class above provides:

- **Exponential backoff reconnect** with configurable max attempts
- **Message queueing** while disconnected (prevents message loss during brief outages)
- **Event-based listener API** (`on`/`emit`) for decoupled message handling
- **Clean disconnect** with timer cleanup
- **Connection state inspection** via `isConnected` getter

This implementation should be adapted into the frontend codebase under `frontend/lib/websocket/` or equivalent.
