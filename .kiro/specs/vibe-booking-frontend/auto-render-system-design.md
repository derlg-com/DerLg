# System Design: Auto-Render Content System

## Problem Statement

When the AI agent calls a tool (e.g., `getHotelDetails`), the result is JSON data. We need a reliable, type-safe mechanism that:
1. Receives JSON from the AI agent via WebSocket
2. Routes it to the correct frontend renderer based on `content_type`
3. Auto-re-renders the Content Stage without page refresh
4. Handles partial/streaming results (tool calls happen in parallel)
5. Manages the booking flow state machine through content transitions

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTO-RENDER CONTENT SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐      WebSocket       ┌──────────────────────────────┐    │
│  │  AI Agent    │ ◄──────────────────► │   Frontend Message Router    │    │
│  │  (Python)    │   JSON payload       │   (useContentRouter hook)    │    │
│  └──────────────┘                      └──────────────┬───────────────┘    │
│                                                       │                     │
│                              ┌────────────────────────┼────────────────┐   │
│                              │                        │                │   │
│                              ▼                        ▼                │   │
│                       ┌─────────────┐          ┌──────────────┐        │   │
│                       │ Chat Store  │          │ ContentStore │        │   │
│                       │ (Zustand)   │          │ (Zustand)    │        │   │
│                       └─────────────┘          └──────┬───────┘        │   │
│                                                       │                │   │
│                                                       ▼                │   │
│                                              ┌──────────────────┐     │   │
│                                              │ Content Pipeline │     │   │
│                                              │ (React re-render)│     │   │
│                                              └────────┬─────────┘     │   │
│                                                       │                │   │
│                              ┌────────────────────────┼────────────────┐   │
│                              │                        │                │   │
│                              ▼                        ▼                │   │
│                    ┌─────────────────┐      ┌─────────────────┐        │   │
│                    │  Zod Validator  │      │  Renderer Map   │        │   │
│                    │  (type guard)   │      │  (content_type  │        │   │
│                    └────────┬────────┘      │   → Component)  │        │   │
│                             │               └─────────────────┘        │   │
│                             │                        │                 │   │
│                             ▼                        ▼                 │   │
│                    ┌─────────────────────────────────────────┐         │   │
│                    │         ContentStage (React)            │         │   │
│                    │  ┌─────────────────────────────────┐    │         │   │
│                    │  │  ContentItem + ErrorBoundary    │    │         │   │
│                    │  │  ┌───────────────────────────┐  │    │         │   │
│                    │  │  │   Renderer Component      │  │    │         │   │
│                    │  │  │   (HotelCards, MapView,   │  │    │         │   │
│                    │  │  │    BookingSummary, etc.)  │  │    │         │   │
│                    │  │  └───────────────────────────┘  │    │         │   │
│                    │  └─────────────────────────────────┘    │         │   │
│                    └─────────────────────────────────────────┘         │   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Mechanism: The Render Loop

### Step-by-Step Flow

```
1. AI Agent finishes tool call
        ↓
2. AI Agent sends WebSocket message:
   {
     type: "agent_message",
     payload: {
       content: "I found 3 hotels near you...",
       content_type: "hotel_cards",        ←── router key
       content_data: { hotels: [...] },    ←── renderer props
       meta: {
         tool_call_id: "call_abc123",
         latency_ms: 1200,
         source: "google_places"
       }
     }
   }
        ↓
3. Frontend WebSocket receives message
        ↓
4. useContentRouter extracts content_type + content_data
        ↓
5. ContentStore.addItem({
     id: "content_" + tool_call_id,
     type: "hotel_cards",
     data: content_data,
     status: "ready"
   })
        ↓
6. Zustand notifies subscribers → ContentStage re-renders
        ↓
7. ContentStage maps contentItems → ContentItem components
        ↓
8. ContentItem looks up renderer: RENDERER_MAP["hotel_cards"]
        ↓
9. Zod schema validates content_data against HotelCardsSchema
        ↓
10. HotelCardsRenderer receives validated props → renders HTML
```

## Message Protocol (Agent → Frontend)

### Standard Content Message

```typescript
interface AgentContentMessage {
  type: "agent_message";
  payload: {
    // Text shown in chat bubble
    content: string;

    // Router key — determines which renderer to use
    content_type:
      | "hotel_cards"
      | "trip_cards"
      | "transport_options"
      | "itinerary"
      | "map_view"
      | "budget_estimate"
      | "qr_payment"
      | "booking_summary"
      | "booking_confirmed"
      | "payment_status"
      | "weather"
      | "image_gallery"
      | "comparison"
      | "text_summary"
      | "loading"; // special: shows skeleton while tools run

    // Data passed to renderer component
    content_data: Record<string, unknown>;

    // Metadata for debugging and analytics
    meta: {
      tool_call_id: string;      // links to tool execution
      tool_name: string;         // e.g., "getHotelDetails"
      latency_ms: number;        // tool execution time
      source: string;            // "google_places" | "supabase" | "stripe"
      timestamp: string;         // ISO 8601
    };

    // Action buttons shown below chat message
    actions?: Array<{
      id: string;
      label: string;             // localized text
      action_type:
        | "book"
        | "view_details"
        | "compare"
        | "dismiss"
        | "share_location"
        | "confirm_booking"
        | "cancel_booking"
        | "retry_payment"
        | "check_status";
      payload: Record<string, unknown>;
    }>;
  };
}
```

### Streaming / Partial Result Message

When multiple tools run in parallel, the agent sends incremental updates:

```typescript
interface AgentStreamMessage {
  type: "agent_stream_chunk";
  payload: {
    content_type: "hotel_cards";
    content_data: { hotels: Hotel[] }; // partial results
    meta: {
      tool_call_id: "call_abc123";
      chunk_index: number;       // 0, 1, 2...
      is_final: boolean;         // true when all chunks sent
      total_expected: number;    // expected total items
    };
  };
}
```

Frontend behavior for streaming:
- `chunk_index === 0`: Create ContentItem with `status: "streaming"`, render skeleton
- `chunk_index > 0`: Update existing ContentItem, append new data, keep `status: "streaming"`
- `is_final === true`: Set `status: "ready"`, replace skeleton with full render

### Tool Execution Status Message

Before results arrive, the agent tells the frontend which tools are running:

```typescript
interface AgentToolStatusMessage {
  type: "agent_tool_status";
  payload: {
    tool_call_id: string;
    tool_name: string;
    status: "started" | "in_progress" | "completed" | "failed";
    progress?: number; // 0-100, optional
    estimated_duration_ms?: number;
  };
}
```

Frontend shows a global "Tools running..." indicator when any tool is `started` or `in_progress`.

## Frontend Store Design

### ContentItem State Shape

```typescript
interface ContentItem {
  id: string;                    // "content_{tool_call_id}"
  type: ContentType;
  data: unknown;                 // raw JSON from agent
  status: "pending" | "streaming" | "ready" | "error" | "dismissed";

  // Streaming metadata
  streamMeta?: {
    chunkIndex: number;
    totalExpected: number;
    receivedAt: string[];        // timestamps of each chunk
  };

  // Error info
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };

  // UI state
  uiState: {
    expanded: boolean;           // for collapsible content
    highlighted: boolean;        // for scroll-sync highlight
    dismissed: boolean;
  };

  // Links
  linkedMessageId: string;       // chat message that produced this
  linkedToolCallId: string;      // tool call that produced this

  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### ContentStore API

```typescript
interface ContentStore {
  items: ContentItem[];

  // Core operations
  addItem(item: Omit<ContentItem, "id">): string;           // returns id
  updateItem(id: string, updates: Partial<ContentItem>): void;
  upsertStreamChunk(toolCallId: string, chunk: StreamChunk): void;
  removeItem(id: string): void;
  clearAll(): void;

  // Status transitions
  markStreaming(toolCallId: string): void;
  markReady(toolCallId: string): void;
  markError(toolCallId: string, error: ErrorInfo): void;
  markDismissed(id: string): void;

  // Queries
  getByToolCallId(toolCallId: string): ContentItem | undefined;
  getByType(type: ContentType): ContentItem[];
  getActiveItems(): ContentItem[]; // excludes dismissed and error
  getLatestItem(): ContentItem | undefined;

  // Scroll sync
  highlightItem(id: string, durationMs?: number): void;
}
```

## Renderer Registration System

### Renderer Contract

```typescript
// Every renderer must implement this interface
interface ContentRenderer<P = unknown> {
  // React component
  Component: React.ComponentType<ContentRendererProps<P>>;

  // Zod schema for runtime validation
  schema: z.ZodSchema<P>;

  // Human-readable name for debugging
  displayName: string;

  // Whether this renderer supports streaming
  supportsStreaming: boolean;

  // Skeleton component shown while streaming
  Skeleton?: React.ComponentType;

  // Empty state component shown when data array is empty
  EmptyState?: React.ComponentType<{ query?: string }>;
}

interface ContentRendererProps<P> {
  data: P;                              // validated data
  itemId: string;                       // ContentItem.id
  isStreaming: boolean;                 // true while chunks arriving
  actions?: Action[];                   // buttons from agent
  onAction: (actionId: string, payload: unknown) => void;
  onDismiss: () => void;
}
```

### Renderer Registry

```typescript
// lib/vibe-booking/renderers/registry.ts

import { HotelCardsRenderer } from "@/components/vibe-booking/content-renderers/HotelCards";
import { TripCardsRenderer } from "@/components/vibe-booking/content-renderers/TripCards";
import { MapViewRenderer } from "@/components/vibe-booking/content-renderers/MapView";
import { BookingSummaryRenderer } from "@/components/vibe-booking/content-renderers/BookingSummary";
import { QRPaymentRenderer } from "@/components/vibe-booking/content-renderers/QRPayment";
import { BookingConfirmedRenderer } from "@/components/vibe-booking/content-renderers/BookingConfirmed";
import { PaymentStatusRenderer } from "@/components/vibe-booking/content-renderers/PaymentStatus";

export const RENDERER_REGISTRY: Record<ContentType, ContentRenderer> = {
  hotel_cards: HotelCardsRenderer,
  trip_cards: TripCardsRenderer,
  map_view: MapViewRenderer,
  booking_summary: BookingSummaryRenderer,
  qr_payment: QRPaymentRenderer,
  booking_confirmed: BookingConfirmedRenderer,
  payment_status: PaymentStatusRenderer,
  // ... etc
};

export function getRenderer(type: ContentType): ContentRenderer {
  const renderer = RENDERER_REGISTRY[type];
  if (!renderer) {
    throw new Error(`No renderer registered for content_type: ${type}`);
  }
  return renderer;
}
```

## The Re-Render Pipeline

### Pipeline Steps (React Level)

```
WebSocket message arrives
        ↓
useContentRouter processes message
        ↓
ContentStore.items array updates (new reference)
        ↓
Zustand triggers subscribers (shallow comparison)
        ↓
ContentStage component re-renders
        ↓
React.memo(ContentItem) checks: item reference changed?
  → YES → ContentItem re-renders
  → NO  → ContentItem skipped (perf optimization)
        ↓
ContentItem renders:
  if status === "streaming" && renderer.Skeleton exists
    → render Skeleton
  else if status === "ready"
    → Zod validate data
    → if valid: render renderer.Component
    → if invalid: render ContentError
  else if status === "error"
    → render error UI with retry button
```

### Why This Re-Renders Correctly

1. **Zustand store** holds the `items` array. When `addItem()` or `updateItem()` is called, Zustand creates a new array reference.
2. **ContentStage** subscribes to `items` via `useVibeBookingStore((s) => s.contentItems)`. New reference = re-render.
3. **ContentItem** is wrapped in `React.memo`. It only re-renders if its own `item` prop changes (by reference).
4. **Streaming chunks** update the same item via `upsertStreamChunk()`, which mutates the item's `data` field and creates a new item reference. This triggers a re-render of only that ContentItem.

## Booking Flow: Content State Machine

The booking flow is a special case where content transitions follow a strict state machine. Each state has a specific `content_type`:

```
USER SAYS "Book it"
        ↓
AI calls: create_booking_hold(tool_call_id="call_book_001")
        ↓
Frontend receives:
  content_type: "booking_summary"
  content_data: { bookingId, trip, dates, priceBreakdown }
  actions: [{ action_type: "confirm_booking", label: "Confirm" }]
        ↓
ContentStage renders: BookingSummary card
        ↓
USER CLICKS "Confirm"
        ↓
Frontend sends action via WebSocket
AI calls: check_availability + create_booking_hold
        ↓
Frontend receives:
  content_type: "qr_payment"
  content_data: { qrCodeUrl, amount, expiry }
  actions: [{ action_type: "cancel_booking", label: "Cancel" }]
        ↓
ContentStage TRANSITIONS: replaces booking_summary with qr_payment
        ↓
[Payment succeeds via WebSocket event]
        ↓
Frontend receives:
  content_type: "booking_confirmed"
  content_data: { bookingRef, qrCheckIn, receiptUrl }
        ↓
ContentStage TRANSITIONS: replaces qr_payment with booking_confirmed
```

### Transition Rules

```typescript
// lib/vibe-booking/content-transitions.ts

const CONTENT_TRANSITIONS: Record<ContentType, ContentType[]> = {
  // From hotel_cards, user can go to booking_summary
  hotel_cards: ["booking_summary", "map_view"],

  // From trip_cards, user can go to itinerary or booking_summary
  trip_cards: ["itinerary", "booking_summary", "map_view"],

  // From booking_summary, user can go to qr_payment or back to hotel/trip cards
  booking_summary: ["qr_payment", "hotel_cards", "trip_cards"],

  // From qr_payment, user can go to booking_confirmed or payment_failed
  qr_payment: ["booking_confirmed", "payment_status"],

  // From payment_status (failed), user can retry → qr_payment
  payment_status: ["qr_payment", "booking_summary"],

  // booking_confirmed is terminal
  booking_confirmed: [],
};

export function canTransition(from: ContentType, to: ContentType): boolean {
  return CONTENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getTransitionAction(from: ContentType, to: ContentType): "replace" | "append" {
  // Booking flow: replace (single active booking)
  if (from === "booking_summary" && to === "qr_payment") return "replace";
  if (from === "qr_payment" && to === "booking_confirmed") return "replace";

  // Discovery: append (user can see hotels + map + budget)
  return "append";
}
```

## Content Stage Transition Animation

When content transitions (especially in booking flow), the UI animates smoothly:

```
Current: [Hotel Cards]
              ↓
User clicks "Book"
              ↓
Exit animation: Hotel Cards slide out to left (300ms)
              ↓
Enter animation: Booking Summary slides in from right (300ms)
              ↓
New state: [Booking Summary]
```

Implementation:

```typescript
// components/vibe-booking/ContentStage.tsx
function ContentStage() {
  const { items, activeItemId } = useVibeBookingStore();
  const activeItem = items.find((i) => i.id === activeItemId);

  return (
    <div className="relative h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {activeItem && (
          <motion.div
            key={activeItem.id}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <ContentItem item={activeItem} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

## Error Handling in the Render Loop

### Validation Error (Zod fails)

```
Agent sends: content_type="hotel_cards", content_data={ malformed }
        ↓
Zod schema rejects data
        ↓
ContentItem status: "error"
        ↓
Render: <ContentError
  title="Could not display hotels"
  message="The hotel data was incomplete."
  retryable={true}
  onRetry={() => requestRetry(toolCallId)}
/>
```

### Agent Error (Tool call failed)

```
Agent tool call fails (backend timeout)
        ↓
Agent sends:
  type: "agent_tool_status"
  payload: { tool_call_id: "call_abc", status: "failed", error: "Backend timeout" }
        ↓
Frontend marks ContentItem as error
        ↓
Render: <ContentError
  title="Search failed"
  message="Could not reach the hotel database. Please try again."
  retryable={true}
/>
```

### Unknown content_type

```
Agent sends: content_type="unknown_type_xyz"
        ↓
Renderer lookup fails
        ↓
Fallback: render as "text_summary" with raw JSON in a collapsible code block
        ↓
Log warning to Sentry: "Unknown content_type: unknown_type_xyz"
```

## Implementation Files

| File | Purpose |
|------|---------|
| `hooks/useContentRouter.ts` | Receives WebSocket messages, routes to store actions |
| `stores/content-store.ts` | ContentItem CRUD, streaming chunk assembly |
| `lib/vibe-booking/renderers/registry.ts` | Renderer lookup table |
| `lib/vibe-booking/renderers/types.ts` | ContentRenderer interface, schemas |
| `lib/vibe-booking/content-transitions.ts` | Booking flow transition rules |
| `components/vibe-booking/ContentStage.tsx` | Root container, AnimatePresence |
| `components/vibe-booking/ContentItem.tsx` | Wrapper with validation, error boundary |
| `components/vibe-booking/ContentError.tsx` | Error fallback with retry |
| `components/vibe-booking/StreamingIndicator.tsx` | Global "tools running" indicator |

## Validation Checklist

- [ ] WebSocket message with `content_type="hotel_cards"` renders HotelCards within 100ms
- [ ] Streaming chunks (3 chunks) assemble into one ContentItem, not 3 separate items
- [ ] Booking flow transitions (summary → QR → confirmed) replace previous content
- [ ] Discovery flow (hotels + map + budget) appends content vertically
- [ ] Invalid JSON shows ContentError, does not crash the app
- [ ] Unknown content_type falls back to text_summary, logs warning
- [ ] React.memo prevents re-render of unchanged ContentItems during streaming
- [ ] 50+ content items maintain 60fps scroll (virtual scrolling)
