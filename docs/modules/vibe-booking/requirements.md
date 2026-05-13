# AI Travel Concierge Chat — Requirements

> **Feature IDs:** F10–F16  
> **Scope:** MVP  
> **Priority:** P0 (F10–F13), P1 (F14–F16)

---

## User Stories

### F10 — Full-Screen AI Chat Interface

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F10-01 | As a traveler, I want to chat with an AI in my language so that I can plan my trip naturally. | AC1: Full-screen chat interface accessible from floating button or nav. AC2: WebSocket connection to Python AI service. AC3: Supports text input and voice input (browser Speech API). AC4: Messages rendered as: text bubbles, trip cards, hotel cards, action buttons, QR codes. AC5: Typing indicator while AI processes. AC6: Language auto-detected or follows user profile setting (EN, ZH, KM). |
| US-F10-02 | As a traveler, I want the chat to feel like messaging a knowledgeable friend so that the experience is enjoyable. | AC1: AI personality: friendly, knowledgeable about Cambodia, concise but thorough. AC2: Uses traveler name if known. AC3: Proactive suggestions ("Would you like me to book that?"). AC4: Emoji and formatting support. AC5: Quick-reply buttons for common intents. |

### F11 — Trip Suggestions via AI

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F11-01 | As a traveler, I want the AI to suggest trips based on my preferences so that I don't need to browse manually. | AC1: AI asks clarifying questions: duration, interests, budget, travel dates. AC2: AI queries backend inventory via tool endpoints. AC3: Results shown as interactive cards with image, price, and "Book" button. AC4: Up to 3 suggestions per turn. AC5: Each suggestion links to full trip detail page. AC6: Suggestions include rationale ("This 3-day temple tour matches your interest in history..."). |

### F12 — AI-Driven Booking Creation

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F12-01 | As a traveler, I want to book directly from chat so that I don't need to leave the conversation. | AC1: AI presents booking summary for user confirmation. AC2: User confirms with "Yes, book it" or taps confirm button. AC3: AI calls backend `/v1/ai-tools/bookings` with service key auth. AC4: Booking created with HOLD status. AC5: Payment link/QR generated inline in chat. AC6: Booking reference returned and displayed in chat. AC7: Confirmation message sent on successful payment. |
| US-F12-02 | As the system, I want AI booking actions to be secure so that unauthorized bookings cannot occur. | AC1: AI service authenticates with backend via `X-Service-Key` header. AC2: All AI tool endpoints require service key. AC3: AI cannot bypass user confirmation step. AC4: Booking amount capped at $5,000 USD per transaction (requires human approval above). AC5: Audit log of all AI-initiated bookings. |

### F13 — AI Payment QR Generation

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F13-01 | As a traveler, I want the AI to generate a payment QR code in chat so that I can pay without leaving the app. | AC1: On user request: "Can I pay with QR?". AC2: AI calls backend to generate QR payment intent. AC3: QR code displayed inline in chat with amount and expiry. AC4: Payment status updates in chat (polling or WebSocket push). AC5: On success, confirmation message with booking reference. |

### F14 — AI Budget Planner / Estimator

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F14-01 | As a traveler, I want the AI to estimate my trip cost so that I can budget before booking. | AC1: AI breaks down costs: accommodation, transport, meals, entry fees, guide. AC2: Estimates shown in user's preferred currency (USD/KHR/CNY). AC3: Min/max range provided for variable costs. AC4: Comparison: "Budget option: $200, Comfortable: $450, Luxury: $900". AC5: Estimates based on real inventory prices (not generic averages). AC6: Budget saved to chat session for reference. |

### F15 — Persistent Chat History

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F15-01 | As a traveler, I want my chat history to persist across sessions so that I can continue planning later. | AC1: Chat messages synced to server every 30 seconds (idle) or immediately on send. AC2: Local storage backup for offline resilience. AC3: On login, server history loaded and merged with local (server wins on conflict). AC4: Max 90 days of history retained. AC5: Option to delete chat history from settings. |
| US-F15-02 | As a traveler, I want to start a new chat session so that I can plan a different trip without confusion. | AC1: "New Chat" button clears current context. AC2: Previous sessions accessible from history sidebar. AC3: Each session has auto-generated title based on first message. |

### F16 — Auto-Reconnect & Message Queue

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F16-01 | As a traveler in Cambodia with spotty mobile data, I want the chat to reconnect automatically so that I don't lose my conversation. | AC1: WebSocket auto-reconnect with exponential backoff: 1s, 2s, 4s, 8s, max 30s. AC2: Visual indicator showing connection status (connected, reconnecting, offline). AC3: Messages sent while offline are queued and sent on reconnect. AC4: Queue persists in localStorage (max 100 messages). AC5: On reconnect, missed messages fetched from server. AC6: Connection recovers silently when network returns (no user action required). |

---

## Message Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | Plain text message | "Here are some great temple tours!" |
| `trip_card` | Interactive trip suggestion | Image, name, price, "Book" button |
| `hotel_card` | Hotel recommendation | Image, rating, price/night, "View" button |
| `action_button` | CTA button | "Confirm Booking", "See Details" |
| `qr_code` | Payment QR image | Amount, expiry, provider logo |
| `itinerary` | Day-by-day plan | Day 1, Day 2, Day 3 with activities |
| `budget_breakdown` | Cost estimate table | Categories with min/max |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `CHAT_001` | 400 | Invalid message format |
| `CHAT_002` | 403 | Service key missing or invalid |
| `CHAT_003` | 429 | Rate limit exceeded (10 messages/min) |
| `CHAT_004` | 503 | AI service unavailable |
| `CHAT_005` | 400 | Booking confirmation failed (AI tool) |

---

*Aligned with PRD section 7.2 and `.kiro/specs/agentic-llm-chatbot/requirements.md` + `.kiro/specs/vibe-booking/requirements.md`.*
