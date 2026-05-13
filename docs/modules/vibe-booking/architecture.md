# AI Travel Concierge Chat — Architecture

> **Feature IDs:** F10–F16  
> **Scope:** MVP

---

## Overview

The AI Chat module is DerLg's core differentiator. It consists of a **Python FastAPI service** running a LangGraph + Claude agent that communicates with travelers via WebSocket, and calls backend tool endpoints to perform actions (search inventory, create bookings, generate payments).

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────┐  │
│  │ Chat UI     │  │ Message     │  │ Offline Queue                   │  │
│  │ (Full-Screen)│  │ Renderer    │  │ (localStorage)                  │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────────────┘  │
│         │                │                                             │
│         └────────────────┘                                             │
│                          │                                             │
│                          ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ WebSocket Manager                                                │  │
│  │ — connect, reconnect, heartbeat, message queue                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │ WebSocket (wss://ai.derlg.com)
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          AI Service (Python FastAPI)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ LangGraph Agent                                                  │   │
│  │ — State machine: Greeting → Discovery → Recommendation → Booking │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                          │                                             │
│         ┌────────────────┼────────────────┐                          │
│         ▼                ▼                ▼                          │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                     │
│  │ Claude   │     │ Tool     │     │ Session  │                     │
│  │ (LLM)    │     │ Executor │     │ Store    │                     │
│  └──────────┘     └────┬─────┘     └──────────┘                     │
│                        │                                             │
│                        │ HTTP + X-Service-Key                       │
│                        ▼                                             │
└─────────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend (NestJS) — AI Tools                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐ │
│  │ /ai-tools/  │  │ /ai-tools/  │  │ /ai-tools/  │  │ /ai-tools/     │ │
│  │ search      │  │ bookings    │  │ payments/qr │  │ budget         │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## WebSocket Protocol

### Connection

```
Client ──wss://ai.derlg.com/v1/chat──▶ AI Service
Headers:
  Authorization: Bearer <user_jwt>
  X-Session-Id: <session_uuid>
```

### Message Format

```json
// Client → AI
{
  "type": "message",
  "id": "msg_001",
  "content": "I want a 3-day temple tour near Siem Reap",
  "timestamp": "2026-05-11T10:00:00Z",
  "locale": "en"
}

// AI → Client
{
  "type": "message",
  "id": "msg_002",
  "content": "Here are some great options!",
  "timestamp": "2026-05-11T10:00:02Z",
  "actions": [
    { "type": "trip_card", "trip_id": "...", "name": "...", "price": 299 }
  ]
}
```

### Heartbeat

```json
// Client → AI (every 30s)
{ "type": "ping" }

// AI → Client
{ "type": "pong", "timestamp": "2026-05-11T10:00:30Z" }
```

---

## LangGraph State Machine

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
         ┌─────────│  GREETING   │─────────┐
         │         └──────┬──────┘         │
         │                │                │
         ▼                ▼                ▼
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ DISCOVERY   │  │ RECOMMEND   │  │  BOOKING    │
  │ (ask Qs)    │◄─┤ (show cards)│◄─┤ (confirm)   │
  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
         │                │                │
         └────────────────┴────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   PAYMENT   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ CONFIRMED   │
                    └─────────────┘
```

---

## Auto-Reconnect Logic

```typescript
class WebSocketManager {
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private messageQueue: Message[] = [];

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.flushQueue();
    };
    this.ws.onclose = () => this.scheduleReconnect();
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
  }

  scheduleReconnect() {
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
  }

  send(message: Message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
      this.saveQueue();
    }
  }
}
```

---

## AI Tool Endpoints (Backend)

All endpoints under `/v1/ai-tools/*` require `X-Service-Key` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/ai-tools/search/trips` | POST | Search trips by intent query |
| `/v1/ai-tools/search/hotels` | POST | Search hotels by criteria |
| `/v1/ai-tools/search/guides` | POST | Search guides by criteria |
| `/v1/ai-tools/bookings` | POST | Create booking with HOLD status |
| `/v1/ai-tools/bookings/{id}/confirm` | POST | Confirm booking after payment |
| `/v1/ai-tools/payments/qr` | POST | Generate QR payment intent |
| `/v1/ai-tools/budget/estimate` | POST | Estimate trip cost breakdown |
| `/v1/ai-tools/users/{id}/profile` | GET | Get user preferences for personalization |

---

## Session Management

- Sessions stored in Redis with 24h TTL
- Session key: `chat:session:{user_id}:{session_id}`
- History limit: 100 messages per session
- Auto-title generated from first user message (Claude summarization)

---

*Aligned with PRD section 7.2 and `.kiro/specs/agentic-llm-chatbot/requirements.md`.*
