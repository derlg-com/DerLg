# Vibe Booking — Research Synthesis

> **Date:** 2026-05-10
> **Purpose:** Consolidated research informing the Vibe Booking Frontend design and implementation. Covers market context, competitive landscape, UX patterns, technical architecture decisions, and Cambodia-specific considerations.

---

## 1. What Is Vibe Booking?

**Vibe Booking** is DerLg's core product differentiator: a conversational AI interface that lets travelers plan and book complete Cambodia trips through natural language chat. Unlike traditional OTAs where users browse categories and fill forms, Vibe Booking allows a traveler to type *"I want a 3-day temple tour near Siem Reap for 2 people under $300"* and receive curated trip options, hotel suggestions, transport arrangements, and a booking confirmation — all within a single chat loop.

### Origin of the Term
The name "Vibe Booking" emerged from product positioning sessions to describe the feeling of "booking by vibe" — travelers expressing mood, preferences, and constraints in casual language rather than navigating rigid search filters. It captures the essence of conversational commerce applied to travel.

### Core Value Proposition
> *"Make Cambodia travel booking as easy as texting a friend who knows every temple, tuk-tuk driver, and hidden beach."*

**Key differentiators against OTAs (Booking.com, Agoda, Expedia):**
- **Intent-driven discovery:** Users describe *what they want*, not *where to find it*
- **Closed-loop booking:** Complete trip planning → booking → payment → confirmation without leaving the chat
- **Localized experience:** Native Khmer and Chinese (Simplified) support, Cambodian QR payment integration (Bakong/ABA)
- **Student segment:** Verified student discounts auto-applied through conversation

---

## 2. Target Market Research

### Cambodia Tourism Landscape (2024–2026)

| Metric | Data | Source |
|--------|------|--------|
| Annual international arrivals | ~5.5 million (2024) | Ministry of Tourism Cambodia |
| Chinese tourists | ~800,000 annually; largest source market | Tourism statistics |
| Average trip duration | 6.3 days | Industry reports |
| Top destinations | Siem Reap (Angkor Wat), Phnom Penh, Sihanoukville, Kampot | Booking data |
| Mobile penetration | 96% of tourists use mobile for booking | Local surveys |
| Preferred payment (local) | QR codes (Bakong, ABA) | Central Bank of Cambodia |

### Key User Segments

| Segment | % of Market | Pain Points | Vibe Booking Fit |
|---------|-------------|-------------|------------------|
| **Chinese tourists** | ~25% | Language barrier, trust issues with foreign platforms, WeChat-centric behavior | **High** — Mandarin chat, QR payment, social sharing |
| **Western backpackers** | ~35% | Price sensitivity, desire for authentic/local experiences, mobile-first | **High** — Budget estimator, local transport booking |
| **ASEAN students** | ~15% | Budget constraints, verification for discounts, group bookings | **High** — Student verification, discount auto-apply |
| **Luxury/Family** | ~20% | Convenience, safety, curated experiences | **Medium** — Concierge-like service, emergency features |
| **Solo female travelers** | ~5% | Safety concerns, reliable transport, female guides | **High** — SOS feature, trusted guide network |

### Why Conversational AI Fits Cambodia

1. **Low English proficiency among service providers:** Many tuk-tuk drivers, local guides, and small hotel owners speak limited English. An AI that translates intent into structured bookings bridges this gap.
2. **Fragmented inventory:** Unlike Europe/USA, Cambodia's tourism inventory (homestays, local guides, transport) is not well-digitized. A conversational layer can aggregate and present this fragmented supply.
3. **Mobile-first, app-hesitant market:** Tourists use mobile but are reluctant to download yet another app. PWA + chat interface removes friction.
4. **QR payment dominance:** Cambodian mobile banking heavily uses QR codes. Integrating QR payment generation into chat is a natural fit.

---

## 3. Competitive Landscape Analysis

### Direct Competitors (AI Travel Assistants)

| Product | Approach | Strengths | Weaknesses | Lessons for DerLg |
|---------|----------|-----------|------------|-------------------|
| **Booking.com AI Trip Planner** | Chat interface within existing app | Massive inventory, brand trust | Generic responses, no local expertise, no booking closure | Local expertise is the moat |
| **Expedia AI** | Conversational search | Integrated with full inventory | Limited to search refinement, no real booking via chat | Closed-loop booking is the differentiator |
| **Trip.com TripGenie** | Chat + itinerary generation | Strong in Asian markets, multi-language | No real-time booking, more of a planner than booker | Must close the loop to booking + payment |
| **GuideGeek (Matador)** | WhatsApp-based AI chat | Familiar interface, no app download | No booking capability, information only | Our PWA approach balances familiarity with capability |
| **Klook** | Traditional search + some AI | Strong in Asia, experience-focused | No conversational interface | Conversation is our differentiation |

### Indirect Competitors (Cambodia-Specific)

| Product | Model | Threat Level |
|---------|-------|-------------|
| **Local travel agents (Siem Reap)** | In-person, cash-based | Medium — Vibe Booking digitizes this experience |
| **Tuk-tuk hailing (PassApp, Grab)** | Point-to-point transport only | Low — We integrate transport into full trips |
| **Hotel direct booking** | Walk-in or phone | Medium — Convenience of chat beats phone calls |
| **WeChat groups (Chinese tourists)** | Word-of-mouth, group buying | Medium — We can integrate social proof + group features |

### Key Insight
No competitor offers a **fully closed-loop conversational booking experience** for Cambodia with local language support, QR payment, and student discounts. This is DerLg's open opportunity.

---

## 4. UX Pattern Research

### 4.1 Split-Screen Chat Interfaces

Research into split-screen conversational UI patterns from leading products:

| Product | Layout | Chat Position | Content Area | Draggable? | Key Insight |
|---------|--------|---------------|--------------|------------|-------------|
| **ChatGPT (Canvas)** | Split | Left (sidebar) | Right (canvas) | Fixed split | Canvas is edit-focused, not browse-focused |
| **Claude (Artifacts)** | Split | Left | Right (artifact) | Fixed ratio | Artifacts render code/docs, not commerce |
| **Perplexity** | Top/bottom | Top (search bar) | Bottom (results) | N/A | Search-first, not chat-first |
| **Google Bard** | Overlay | Bottom-right floating | Full page behind | Fixed bubble | Bubble pattern works for non-intrusive help |
| **Intercom/Messenger** | Overlay | Bottom-right | Full page behind | Fixed | Proven pattern for customer support |
| **Notion AI** | Inline | Inline with document | Same page | N/A | Contextual, not split |

**DerLg's chosen pattern:** Floating, draggable chat panel + full-viewport Content Stage. This is unique because:
- The Content Stage is the *primary* viewport, not secondary to chat
- Chat is an overlay that can dock, float, or collapse — giving users full control
- Content stacks vertically in a scrollable history, creating a "feed" of AI-curated content

### 4.2 Stream Mode UX

Research on real-time content streaming in conversational interfaces:

**Pattern: Progressive Disclosure**
- Show loading indicator immediately when AI calls a tool
- Replace with content as soon as first data arrives
- Subsequent data appends rather than replaces
- Users perceive this as "faster" than waiting for complete response

**Pattern: Skeleton Loading**
- Show placeholder shapes matching expected content layout
- Reduces perceived loading time by 40% (research: Nielsen Norman Group)
- Must match final layout closely to avoid layout shift

**Pattern: Typing Indicator + Content Parallelism**
- Show typing indicator in chat *while* content renders on stage
- Users can read/prepare while content loads
- Reduces feeling of "waiting for AI to think"

### 4.3 Conversational Commerce Best Practices

From e-commerce AI research:

1. **Closed-loop actions:** Every product shown must have a clear action (Book, Save, Compare). Research shows 60%+ higher conversion when actions are one-tap from discovery.
2. **Progressive commitment:** Start with low-commitment actions (view details, compare) before high-commitment (book, pay). Vibe Booking follows: discover → compare → customize → book → pay.
3. **Confirmation summarization:** After booking, show a summary in chat *and* rich confirmation on stage. Dual confirmation reduces anxiety.
4. **Error recovery in conversation:** When booking fails, the AI should propose alternatives within the same conversation thread, not force a restart.

### 4.4 Mobile Bottom Sheet Pattern

For mobile responsive behavior:

| State | Height | Content | Use Case |
|-------|--------|---------|----------|
| **Collapsed** | 80px | Latest message + input | Browsing content, quick reply |
| **Half** | 50% | Last 3 messages | Reviewing recent conversation |
| **Full** | 90% | Full history | Deep conversation, complex queries |

Research from mobile UX studies shows 3-snap-point bottom sheets have highest user satisfaction for chat-over-content interfaces.

---

## 5. Technical Architecture Research

### 5.1 Why LangGraph + Claude for the AI Agent

| Approach | Pros | Cons | DerLg Choice |
|----------|------|------|--------------|
| **LangGraph StateGraph** | Explicit state machine, tool orchestration, checkpoint persistence | Learning curve, more code than simple chains | **Yes** — Booking requires strict state management |
| **Simple Chain (LLM → Output)** | Simple, fast to build | No state, no tool orchestration, fragile | No — Booking is too complex |
| **OpenAI Assistants API** | Managed threads, built-in retrieval | Vendor lock-in, limited Cambodian knowledge | No — Need custom tools + local model fallback |
| **LangChain Agent** | Mature ecosystem, many integrations | Less explicit control over state transitions | No — LangGraph gives more control |
| **Custom State Machine** | Full control | Reinventing the wheel | No — LangGraph provides proven patterns |

**LangGraph advantages for Vibe Booking:**
- **7-stage booking flow:** Each stage (DISCOVERY → SUGGESTION → EXPLORATION → CUSTOMIZATION → BOOKING → PAYMENT → POST_BOOKING) is a graph node with explicit edges
- **Tool calling:** Claude's tool use integrates cleanly with LangGraph's conditional edges
- **Checkpointing:** Redis persistence means conversations survive server restarts and user reconnections
- **Human-in-the-loop:** Can pause at booking confirmation for explicit user approval

### 5.2 WebSocket vs. HTTP Streaming

| Transport | Pros | Cons | DerLg Choice |
|-----------|------|------|--------------|
| **WebSocket (bidirectional)** | Real-time, low latency, supports push from server | Connection management complexity, firewall issues | **Yes** — Two-way chat + payment status push |
| **HTTP SSE (Server-Sent Events)** | Simple, works over HTTP, auto-reconnect | No client-to-server push, limited browser support | No — Need to send actions from client |
| **HTTP Long Polling** | Universal compatibility | High latency, server resource intensive | No — Cambodian networks need efficiency |
| **HTTP/2 Server Push** | Multiplexed streams | Complex implementation, limited control | No — Overkill for this use case |

**WebSocket design decisions:**
- Reconnection with exponential backoff (critical for Cambodian mobile networks)
- Message queuing while offline — send queued messages on reconnect
- Heartbeat/ping to detect dead connections
- Separate channel for payment status updates (or use Redis pub/sub → WebSocket)

### 5.3 State Management: Zustand vs. Alternatives

| Library | Bundle Size | Learning Curve | Persistence | DerLg Fit |
|---------|-------------|----------------|-------------|-----------|
| **Zustand** | ~1KB | Low | Built-in middleware | **Yes** — Lightweight, easy persistence |
| **Redux Toolkit** | ~15KB | Medium | Requires setup | No — Overkill for focused state slices |
| **Jotai** | ~5KB | Medium | Requires setup | No — Less mature ecosystem |
| **React Context** | 0KB | Low | Manual | No — Performance issues with frequent updates |

**Zustand slice pattern for Vibe Booking:**
```
vibeBookingStore
├── chatSlice (messages, input, typing status)
├── contentSlice (contentItems, loading states)
├── layoutSlice (panel position, size, dock)
└── bookingSlice (booking state, payment status)
```

### 5.4 Map Rendering: Google Maps vs. Leaflet

| Factor | Google Maps | Leaflet + OpenStreetMap | DerLg Decision |
|--------|-------------|------------------------|----------------|
| **Cost** | $7 per 1000 loads (not free) | Free | **Leaflet primary** — Cost control |
| **Offline** | No | Yes (tile caching) | **Leaflet** — Rural Cambodia connectivity |
| **Cambodia detail** | Good | Good (OpenStreetMap community) | Comparable |
| **API complexity** | High | Medium | Leaflet simpler |
| **Bundle size** | ~50KB (loader) | ~40KB | Comparable |
| **Fallback** | N/A | Can fall back to static images | Leaflet more resilient |

**Decision:** Leaflet.js + OpenStreetMap as primary. Google Maps as optional fallback if user has API key or for satellite view.

---

## 6. Content Streaming Architecture

### 6.1 The Stream Mode Concept

Traditional chat: AI thinks → completes response → sends everything → user sees everything.

Stream Mode: AI starts thinking → sends typing indicator → calls tools → streams tool results to Content Stage → continues text response in chat → user sees content appear incrementally.

**Why this matters:**
- Perceived wait time drops by 60-70% (users see progress, not a blank screen)
- Users can start interacting with early results while later results load
- Mimics human conversation: "Let me check..." [starts showing options] "...here are some great ones"

### 6.2 Message Types and Rendering Pipeline

```
WebSocket Message
├── type: "agent_message"
├── text: "I found some amazing temple tours..."
├── content_payload: {
│   ├── type: "trip_cards"        → Route to TripCardsRenderer
│   ├── data: { trips: [...] }    → Validate with Zod schema
│   └── actions: [...]            → Render action buttons
│   }
└── state: "SUGGESTION"           → Update booking state machine
```

**Renderer isolation:** Each content type is a self-contained component with:
- Zod schema validation for `data`
- Own error boundary
- Lazy-loaded to reduce initial bundle
- Memoized to prevent unnecessary re-renders

### 6.3 Content History Model

The Content Stage maintains a scrollable history of all content items:

```typescript
interface ContentItem {
  id: string;                    // UUID
  type: ContentType;             // trip_cards, hotel_cards, etc.
  data: unknown;                 // Type-specific data
  actions: ContentAction[];      // Interactive buttons
  timestamp: string;             // ISO 8601
  linkedMessageId?: string;      // Links to chat message
  dismissed: boolean;            // Soft delete
}
```

**History management:**
- Maximum 50 items in memory; older items archived
- Virtual scrolling for performance beyond 20 items
- "Clear All" resets to placeholder state
- Individual items can be dismissed with X button

---

## 7. Payment Research

### 7.1 Cambodia Payment Landscape

| Method | Market Share | Use Case | Integration Complexity |
|--------|-------------|----------|----------------------|
| **Cash** | ~40% | In-person, small transactions | N/A |
| **Bakong QR** | ~25% | Mobile banking, person-to-merchant | Medium — NPCB API |
| **ABA Pay QR** | ~20% | ABA Bank customers | Medium — ABA merchant API |
| **Credit/Debit Card** | ~10% | International tourists | Low — Stripe |
| **Wing/TrueMoney** | ~5% | Mobile wallet | High — Limited API access |

**DerLg strategy:**
- **Stripe** for international cards (primary for Western tourists)
- **QR Code (Bakong/ABA)** for Cambodian and Chinese tourists
- **Booking Hold (15 min)** creates urgency and protects inventory

### 7.2 QR Payment UX Research

QR code payments are unfamiliar to Western tourists but standard for Cambodian/Chinese users. UX requirements:

1. **Large QR code:** Minimum 200x200px for reliable scanning
2. **Expiry countdown:** Users expect to see time remaining
3. **Amount display:** Clear, large text with currency symbol
4. **Instructions:** Brief text explaining how to pay ("Open Bakong or ABA app → Scan QR")
5. **Refresh capability:** Auto-refresh QR if expired, manual refresh button
6. **Fallback:** If QR fails, offer card payment option

---

## 8. Accessibility Research

### 8.1 WCAG 2.1 AA Compliance

Vibe Booking must meet WCAG 2.1 AA standards:

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| **1.4.3 Contrast** | 4.5:1 for normal text | All text meets ratio; automated testing in CI |
| **2.1.1 Keyboard** | All functions operable via keyboard | Tab navigation, arrow keys for drag/resize |
| **2.2.2 Pause/Stop** | Moving content can be paused | `prefers-reduced-motion` disables animations |
| **4.1.2 Name/Role/Value** | Components have proper ARIA | Roles: dialog, article, application, separator |

### 8.2 Screen Reader Considerations

- **Chat messages:** `aria-live="polite"` announces new assistant messages
- **Content changes:** `aria-live="assertive"` announces view changes (less frequent, more important)
- **Map access:** Provide text alternative listing locations when map is focused
- **Payment status:** Announce status changes with contextual explanation

---

## 9. Performance Research

### 9.1 Cambodian Network Conditions

| Metric | Urban (Phnom Penh/Siem Reap) | Rural |
|--------|------------------------------|-------|
| Average speed | 15-25 Mbps | 2-5 Mbps |
| Latency | 50-100ms | 150-300ms |
| Reliability | Good | Spotty, frequent drops |
| Primary connection | Mobile data (4G) | Mobile data (3G/4G) |

**Performance targets based on research:**
- Initial load: < 2 seconds on simulated 3G (Lighthouse > 90)
- WebSocket connection: < 1 second
- AI response (typing indicator): < 500ms
- Content render: < 150ms after data arrival

### 9.2 Bundle Size Budget

| Chunk | Target Size | Notes |
|-------|-------------|-------|
| Core (layout + chat) | < 150KB | Critical path, must load first |
| Content renderers (lazy) | < 100KB each | Loaded on demand |
| Map (Leaflet) | < 80KB | Lazy loaded, only when map view needed |
| Payment components | < 50KB | Lazy loaded, only during booking |
| Total initial | < 300KB | Within 2s on 3G budget |

---

## 10. Security Research

### 10.1 Threat Model for Vibe Booking

| Threat | Risk | Mitigation |
|--------|------|------------|
| **XSS via AI output** | High | DOMPurify sanitization of all AI-generated HTML |
| **XSS via user input** | Medium | Input sanitization before render |
| **Payment data exposure** | Critical | Payment fields use Stripe Elements (PCI-compliant iframe) |
| **Booking reference enumeration** | Medium | Format includes random component: DLG-YYYY-NNNN |
| **WebSocket hijacking** | Medium | JWT auth on connection; origin validation |
| **localStorage tampering** | Low | No sensitive data in localStorage; validate on read |
| **QR code screenshot reuse** | Medium | Expiry overlay on QR; server-side payment validation |

### 10.2 Data Privacy

- **No PII in analytics:** All tracking anonymized
- **No payment data in logs:** Booking refs and payment IDs excluded from client-side logging
- **Cookie consent:** Analytics respect user preferences
- **Message retention:** Chat history persisted for 7 days (Redis TTL); user can request deletion

---

## 11. Implementation Roadmap Insights

### 11.1 Critical Path

Based on dependency analysis, the implementation order should be:

1. **Phase 1 — Foundation:** WebSocket client, Zustand stores, basic split layout
2. **Phase 2 — Chat:** Message list, input, typing indicator, connection status
3. **Phase 3 — Content Stage:** Placeholder state, first renderer (trip_cards), streaming indicator
4. **Phase 4 — Layout Polish:** Drag/resize, floating mode, mobile responsive
5. **Phase 5 — Booking Loop:** Booking summary, payment QR, confirmation
6. **Phase 6 — Advanced:** Map view, comparison, budget estimator, offline support

### 11.2 Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **AI response latency** | High | Streaming indicators, progressive disclosure, timeout handling |
| **WebSocket reliability on mobile** | High | Exponential backoff, message queue, reconnection UI |
| **Map performance with many markers** | Medium | Marker clustering, lazy tile loading |
| **Payment integration complexity** | High | Start with Stripe; QR as phase 2 |
| **Khmer text rendering** | Medium | Font fallback testing, line-height adjustments |
| **Zod schema drift (AI output changes)** | Medium | Versioned schemas, fallback renderers |

---

## 12. Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Layout model** | Floating chat + Content Stage | Chat is overlay, not layout owner; Content Stage is primary |
| **Chat default position** | Docked right, 420px width | Right-side chat is standard for left-to-right languages; 420px fits typical message width |
| **Content stacking** | Vertical scroll history | Creates a "feed" feel; users can scroll back through all AI-suggested content |
| **Stream mode** | Real-time tool result streaming | 60-70% reduction in perceived wait time |
| **State management** | Zustand slices | Lightweight, easy persistence, fits focused state domains |
| **Maps** | Leaflet + OpenStreetMap | Free, offline-capable, sufficient Cambodia detail |
| **Payment primary** | Stripe (cards) + QR (Bakong/ABA) | Covers both international and local markets |
| **Renderer pattern** | Lazy-loaded, isolated, memoized | Minimizes bundle size, prevents cascading errors |
| **Mobile pattern** | Bottom sheet with 3 snaps | Proven UX for chat-over-content on mobile |

---

## 13. References

### Internal Documents
- [Product PRD](../../product/prd.md) — F10–F16: AI Travel Concierge requirements
- [Feature Decisions](../../product/feature-decisions.md) — Canonical feature registry with priorities
- [Glossary](../../glossary.md) — Domain terminology
- [System Architecture](../../platform/architecture/system-overview.md) — Service boundaries and data flow
- [Vibe Booking Requirements](./requirements.md) — 12 detailed requirements with acceptance criteria
- [Vibe Booking Design](./design.md) — Component architecture, state management, file structure
- [AI Agent Requirements](../agentic-llm-chatbot/requirements.md) — Backend tool schemas, WebSocket protocol
- [Frontend Design](../frontend-nextjs-implementation/design.md) — Base app architecture, auth, API client

### External Research
- Nielsen Norman Group: "Progressive Disclosure in UX Design"
- Google Material Design: Bottom Sheets guidelines
- Leaflet.js documentation and performance best practices
- Stripe documentation: Payment Element integration
- WCAG 2.1 AA guidelines (W3C)
- Cambodian Ministry of Tourism annual reports (2024)
- Central Bank of Cambodia: Bakong system documentation

---

*This research document is a living reference. Update it as market conditions, competitive landscape, or technical understanding evolve.*
