# Design Document: Vibe Booking Frontend — Stream Mode

> **Prerequisite:** Read `requirements.md` and `system-design.md` in this directory first. This document combines component architecture, data flow, and AI conversation flow. The JSON-driven auto-render architecture is defined in `system-design.md`.

---

## 1. Overview

### Core Design Principles

1. **Stream-First:** Content renders on the Content Stage as tool results arrive, not at conversation end.
2. **Layout Agnostic:** The Chat Panel is a floating, draggable overlay — it does not own page layout. The Content Stage is the primary viewport.
3. **Renderer Isolation:** Each content type is a self-contained renderer with its own Zod schema, styles, and error boundary.
4. **No-ReRender Drag:** Drag/resize operations mutate CSS transforms directly; React state updates only on operation end.
5. **Chat as Thin Client:** The chat only sends/receives messages. All rich rendering logic lives in the Content Stage.

### Technology Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | Next.js 16 App Router | Already in project; App Router for route-level code splitting |
| Language | TypeScript 5 (strict) | Enforced in `tsconfig.json` |
| Styling | Tailwind CSS v4 | Already configured; CSS variables for theming |
| Animations | Framer Motion (booking flow) + CSS transitions (content enter) | Framer Motion for AnimatePresence transitions; CSS for performance |
| Maps | Leaflet.js + `react-leaflet` | Already planned in frontend spec; OpenStreetMap tiles |
| State (local) | Zustand + Immer | Lightweight, persists to localStorage easily, Immer for mutation-safe updates |
| State (server) | React Query | Already planned; handles caching, retries, background refetch |
| Validation | Zod | Schema validation for AI message payloads |
| Sanitization | DOMPurify | XSS prevention for user input and AI-generated HTML |
| Icons | Lucide React | Lightweight, tree-shakeable |

---

## 2. Architecture

### 2.1 Component Hierarchy

```
VibeBookingPage (Server Component)
└── SplitScreenLayout (Client Component)
    ├── ChatPanel (Client Component)
    │   ├── ChatHeader (Client Component)
    │   │   ├── DragHandle
    │   │   ├── ConnectionStatusBadge
    │   │   ├── ResetLayoutButton
    │   │   └── CollapseButton
    │   ├── MessageList (Client Component, virtualized if >50)
    │   │   ├── ChatMessage (memo)
    │   │   │   ├── MessageBubble
    │   │   │   ├── ActionButtons (conditional)
    │   │   │   └── JumpToContentButton (conditional)
    │   │   └── TypingIndicator
    │   ├── ChatInput (Client Component)
    │   └── ResizeHandle
    │
    └── ContentStage (Client Component) — PRIMARY VIEWPORT
        ├── ContentStageHeader (Client Component)
        │   ├── ContentTitle (from active item metadata)
        │   ├── StreamingIndicator (conditional)
        │   └── ClearAllButton
        │
        ├── ContentHistory (Client Component, scrollable)
        │   ├── ContentItem (memo, key=id, per-item ErrorBoundary)
        │   │   ├── ContentHeader (timestamp, metadata.title, dismiss)
        │   │   ├── ContentRenderer (lazy-loaded by type)
        │   │   │   ├── TripCardsRenderer
        │   │   │   ├── HotelCardsRenderer
        │   │   │   ├── TransportOptionsRenderer
        │   │   │   ├── ItineraryRenderer
        │   │   │   ├── MapViewRenderer
        │   │   │   ├── BudgetEstimateRenderer
        │   │   │   ├── QRPaymentRenderer
        │   │   │   ├── BookingConfirmedRenderer
        │   │   │   ├── PaymentStatusRenderer
        │   │   │   ├── WeatherRenderer
        │   │   │   ├── ComparisonRenderer
        │   │   │   ├── ImageGalleryRenderer
        │   │   │   └── TextSummaryRenderer (fallback)
        │   │   └── ActionBar (from item.actions, if any)
        │   └── ContentItemSkeleton (shown while streaming)
        │
        └── ContentPlaceholder (shown when no content items)
```

### 2.2 Data Flow

```
User Message
    │
    ▼
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   AI Agent      │ ◄────────────────► │  useWebSocket    │
│ (Python/LangGraph│   (wss://host/ws)  │    hook          │
└─────────────────┘                    └────────┬─────────┘
                                                │
                       ┌────────────────────────┼────────────────────────┐
                       │                        │                        │
                       ▼                        ▼                        ▼
              ┌─────────────┐        ┌─────────────────┐      ┌─────────────────┐
              │ ChatPanel   │        │ ContentStage    │      │ Zustand Store   │
              │             │        │                 │      │ (vibeBooking)   │
              │ - messages[]│        │ - contentItems[]│      │                 │
              │ - input     │        │ - renderers     │      │ - messages      │
              │ - typing    │        │ - scrollRef     │      │ - contentItems  │
              └─────────────┘        └─────────────────┘      │ - layoutConfig  │
                                                              │ - bookingState  │
                                                              └─────────────────┘
                                                                       │
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │ localStorage    │
                                                              │ (persisted)     │
                                                              └─────────────────┘
```

**Flow:**
1. User types message → `useWebSocket.send()` → AI Agent
2. AI Agent processes → sends `typing_start` → Frontend shows streaming indicator
3. AI Agent calls tools → sends `agent_message` with `content_payload` (JSON ContentPayload)
4. `useContentRouter` parses the message:
   - Extracts `text` → adds to `chatStore.messages`
   - Extracts `content_payload` → routes through `createContentRenderer()` → adds to `contentStore.contentItems`
5. Content Stage renders the appropriate component based on `content_payload.type`
6. User interacts with Content Item (click action button) → sends `user_action` via WebSocket → AI processes → new content arrives

---

## 3. State Management

### 3.1 Zustand Store: `vibeBookingStore`

Single store with slices. Uses Immer for mutation-safe updates. Only layout and last-50 messages persist to localStorage.

```typescript
// stores/vibe-booking.store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string; // Plain text summary from AI
  type: 'text' | 'error';
  linkedContentId?: string; // Links to ContentItem.id
  timestamp: string;
}

interface ContentItem {
  id: string;
  type: ContentType;
  data: unknown; // Validated JSON data (Zod-safeParse'd at ingestion)
  actions: ContentAction[];
  metadata: ContentMetadata;
  status: 'ready' | 'streaming' | 'error';
  timestamp: string;
  linkedMessageId?: string; // Links back to chat message
  linkedToolCallId?: string; // Links to tool execution
}

interface ContentAction {
  type: string;
  label: string;
  payload: Record<string, unknown>;
  style?: 'primary' | 'secondary' | 'danger';
  icon?: string; // Lucide icon name
}

interface ContentMetadata {
  title?: string;        // Shown in ContentStage header
  subtitle?: string;     // Shown below title
  icon?: string;         // Lucide icon name
  backable?: boolean;    // Show back button?
  shareable?: boolean;   // Show share button?
  replace?: boolean;     // Replace current content vs. append?
}

interface LayoutConfig {
  dock: 'left' | 'right' | 'center' | 'floating';
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
}

type ContentType =
  | 'trip_cards'
  | 'trip_detail'
  | 'hotel_cards'
  | 'hotel_detail'
  | 'transport_options'
  | 'map_view'
  | 'itinerary'
  | 'booking_summary'
  | 'qr_payment'
  | 'payment_status'
  | 'booking_confirmed'
  | 'budget_estimate'
  | 'weather'
  | 'comparison'
  | 'image_gallery'
  | 'text_summary';

type BookingState =
  | { status: 'idle' }
  | { status: 'holding'; bookingId: string; reservedUntil: string }
  | { status: 'paying'; bookingId: string; paymentIntentId: string }
  | { status: 'confirmed'; bookingId: string; bookingRef: string }
  | { status: 'failed'; bookingId: string; error: string };

interface VibeBookingState {
  // Chat slice
  messages: ChatMessage[];
  isTyping: boolean;
  isStreaming: boolean; // True while AI tools are running
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  addMessage: (message: ChatMessage) => void;
  setTyping: (typing: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setConnectionStatus: (status: VibeBookingState['connectionStatus']) => void;
  clearMessages: () => void;

  // Content slice
  contentItems: ContentItem[];
  activeContentId: string | null; // For single-item focus (booking flow)
  addContentItem: (item: ContentItem) => void;
  updateContentItem: (id: string, updates: Partial<ContentItem>) => void;
  removeContentItem: (id: string) => void;
  clearAllContent: () => void;
  setActiveContent: (id: string | null) => void;

  // Layout slice
  layout: LayoutConfig;
  setLayout: (layout: Partial<LayoutConfig>) => void;
  resetLayout: () => void;
  toggleCollapsed: () => void;

  // Booking slice
  booking: BookingState;
  setBooking: (booking: BookingState) => void;
  clearBooking: () => void;
}

// ─── Default Layout ─────────────────────────────────────

const DEFAULT_LAYOUT: LayoutConfig = {
  dock: 'right',
  x: 0,
  y: 0,
  width: 420,
  height: 0, // 0 = full viewport height
  collapsed: false,
};

// ─── Store ──────────────────────────────────────────────

export const useVibeBookingStore = create<VibeBookingState>()(
  persist(
    immer((set) => ({
      // Chat
      messages: [],
      isTyping: false,
      isStreaming: false,
      connectionStatus: 'disconnected',
      addMessage: (message) =>
        set((state) => {
          state.messages.push(message);
        }),
      setTyping: (typing) => set({ isTyping: typing }),
      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      clearMessages: () => set({ messages: [] }),

      // Content
      contentItems: [],
      activeContentId: null,
      addContentItem: (item) =>
        set((state) => {
          // If item.metadata.replace === true, remove previous items of same type
          if (item.metadata?.replace) {
            state.contentItems = state.contentItems.filter(
              (i) => i.type !== item.type
            );
          }
          state.contentItems.push(item);
          state.activeContentId = item.id;
        }),
      updateContentItem: (id, updates) =>
        set((state) => {
          const item = state.contentItems.find((i) => i.id === id);
          if (item) Object.assign(item, updates);
        }),
      removeContentItem: (id) =>
        set((state) => {
          state.contentItems = state.contentItems.filter((i) => i.id !== id);
          if (state.activeContentId === id) {
            state.activeContentId = state.contentItems.length > 0
              ? state.contentItems[state.contentItems.length - 1].id
              : null;
          }
        }),
      clearAllContent: () =>
        set((state) => {
          state.contentItems = [];
          state.activeContentId = null;
        }),
      setActiveContent: (id) => set({ activeContentId: id }),

      // Layout
      layout: DEFAULT_LAYOUT,
      setLayout: (layout) =>
        set((state) => {
          Object.assign(state.layout, layout);
        }),
      resetLayout: () => set({ layout: DEFAULT_LAYOUT }),
      toggleCollapsed: () =>
        set((state) => {
          state.layout.collapsed = !state.layout.collapsed;
        }),

      // Booking
      booking: { status: 'idle' },
      setBooking: (booking) => set({ booking }),
      clearBooking: () => set({ booking: { status: 'idle' } }),
    })),
    {
      name: 'derlg:vibe-booking:store',
      partialize: (state) => ({
        layout: state.layout,
        messages: state.messages.slice(-50),
        contentItems: state.contentItems.slice(-20),
      }),
    }
  )
);
```

### 3.2 React Query Integration

Server state (bookings, payments, user profile) uses React Query:

```typescript
// hooks/useBooking.ts
export function useBooking() {
  return useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`),
    enabled: !!bookingId,
    refetchInterval: (data) =>
      data?.paymentStatus === 'PENDING' ? 5000 : false,
  });
}

// hooks/useCreateBooking.ts
export function useCreateBooking() {
  return useMutation({
    mutationFn: (data: CreateBookingData) => api.post('/bookings', data),
    onSuccess: (data) => {
      useVibeBookingStore.getState().setBooking({
        status: 'holding',
        bookingId: data.id,
        reservedUntil: data.reservedUntil,
      });
    },
  });
}

// hooks/usePaymentStatus.ts
export function usePaymentStatus(paymentIntentId: string) {
  return useQuery({
    queryKey: ['payment', paymentIntentId],
    queryFn: () => api.get(`/payments/${paymentIntentId}/status`),
    enabled: !!paymentIntentId,
    refetchInterval: (data) =>
      data?.status === 'PENDING' ? 5000 : false,
  });
}
```

---

## 4. Custom Hooks

### 4.1 `useDraggableResizable`

Core hook for Chat Panel drag and resize. Uses refs and RAF to avoid React re-renders during operations.

```typescript
// hooks/useDraggableResizable.ts

interface UseDraggableResizableOptions {
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  snapThreshold: number;
  onChange: (state: { x: number; y: number; width: number; height: number; dock: string | null }) => void;
}

interface UseDraggableResizableReturn {
  panelRef: React.RefObject<HTMLDivElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
  resizeHandleRef: React.RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  isResizing: boolean;
}

export function useDraggableResizable(options: UseDraggableResizableOptions): UseDraggableResizableReturn;
```

**Implementation notes:**
- All position/size state lives in refs, not React state.
- `mousedown` / `touchstart` on header → drag mode
- `mousedown` / `touchstart` on resize handle → resize mode
- `mousemove` / `touchmove` → update CSS `transform` and `width/height` directly on DOM node via RAF
- `mouseup` / `touchend` → calculate snap, call `onChange()`, update React state once
- Keyboard: Arrow keys → move 10px, Shift+Arrow → resize 10px

### 4.2 `useWebSocket`

Extended from the existing frontend spec, adapted for vibe-booking message types.

```typescript
// hooks/useWebSocket.ts

interface WebSocketMessage {
  type: 'auth' | 'user_message' | 'user_action' | 'agent_message' | 'typing_start' | 'typing_end' | 'payment_status' | 'booking_hold_expiry' | 'error';
  payload?: Record<string, unknown>;
  timestamp: string;
}

interface UseWebSocketReturn {
  send: (message: WebSocketMessage) => void;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnectAttempts: number;
}

export function useWebSocket(url: string): UseWebSocketReturn;
```

**Message queue:** Messages sent while disconnected are queued in a ref and flushed on reconnect.

### 4.3 `useContentRouter`

Routes incoming WebSocket messages to the correct store actions. This is the bridge between WebSocket messages and UI state.

```typescript
// hooks/useContentRouter.ts

import { useCallback } from 'react';
import { useVibeBookingStore } from '@/stores/vibe-booking.store';
import { createContentRenderer } from '@/lib/vibe-booking/content-pipeline';
import { generateId } from '@/lib/utils';

export function useContentRouter() {
  const {
    addMessage,
    setTyping,
    setStreaming,
    addContentItem,
    setBooking,
  } = useVibeBookingStore();

  return useCallback((wsMessage: WebSocketMessage) => {
    switch (wsMessage.type) {
      case 'typing_start':
        setTyping(true);
        setStreaming(true);
        break;

      case 'typing_end':
        setTyping(false);
        setStreaming(false);
        break;

      case 'agent_message': {
        const { payload } = wsMessage;

        // 1. Always add text summary to chat
        const chatMessageId = generateId();
        addMessage({
          id: chatMessageId,
          role: 'assistant',
          content: payload.text,
          type: 'text',
          timestamp: wsMessage.timestamp,
        });

        // 2. If content_payload exists, auto-render to Content Stage
        if (payload.content_payload) {
          const contentId = generateId();

          addContentItem({
            id: contentId,
            type: payload.content_payload.type,
            data: payload.content_payload.data,
            actions: payload.content_payload.actions || [],
            metadata: payload.content_payload.metadata || {},
            status: 'ready',
            timestamp: wsMessage.timestamp,
            linkedMessageId: chatMessageId,
            linkedToolCallId: payload.meta?.tool_call_id,
          });

          // 3. Link chat message to content (for jump-to-content)
          addMessage({
            id: generateId(),
            role: 'system',
            content: `Content: ${payload.content_payload.metadata?.title || payload.content_payload.type}`,
            type: 'text',
            linkedContentId: contentId,
            timestamp: wsMessage.timestamp,
          });
        }

        setTyping(false);
        setStreaming(false);
        break;
      }

      case 'payment_status': {
        // Auto-render payment status update
        const { payload } = wsMessage;
        addContentItem({
          id: generateId(),
          type: 'payment_status',
          data: {
            status: payload.status,
            paymentMethod: payload.paymentMethod,
            amountUsd: payload.amountUsd,
            amountKhr: payload.amountKhr,
            timestamp: wsMessage.timestamp,
            retryable: payload.status === 'FAILED',
            receiptUrl: payload.receiptUrl,
          },
          actions: [],
          metadata: { title: 'Payment Status', replace: true },
          status: 'ready',
          timestamp: wsMessage.timestamp,
        });
        break;
      }

      case 'booking_hold_expiry': {
        const { payload } = wsMessage;
        if (payload.secondsRemaining <= 0) {
          setBooking({ status: 'idle' });
        }
        break;
      }

      case 'error': {
        addMessage({
          id: generateId(),
          role: 'assistant',
          content: wsMessage.payload.message,
          type: 'error',
          timestamp: wsMessage.timestamp,
        });
        break;
      }
    }
  }, [addMessage, setTyping, setStreaming, addContentItem, setBooking]);
}
```

### 4.4 `useContentRenderer`

Maps ContentType to lazy-loaded renderer component. Performs ingestion-time Zod validation.

```typescript
// hooks/useContentRenderer.ts

import { useMemo } from 'react';
import { CONTENT_REGISTRY } from '@/lib/vibe-booking/content-registry';

export function useContentRenderer(type: string, data: unknown) {
  return useMemo(() => {
    const entry = CONTENT_REGISTRY[type as keyof typeof CONTENT_REGISTRY];
    if (!entry) {
      return { success: false, error: `Unknown content type: ${type}` };
    }

    // Validate at ingestion time (not render time)
    const validation = entry.schema.safeParse(data);
    if (!validation.success) {
      console.error(`[ContentRenderer] Validation failed for ${type}:`, validation.error);
      return { success: false, error: `Invalid data for ${type}` };
    }

    return { success: true, component: entry.renderer, data: validation.data };
  }, [type, data]);
}
```

---

## 5. Content Renderers

### 5.1 Renderer Contract

Every content renderer is a self-contained React component that:
1. Receives **pre-validated** JSON data as props (Zod already ran at ingestion)
2. Renders full rich content (not just text)
3. Handles its own loading, error, and empty states
4. Emits action events when user interacts with action buttons

```typescript
// lib/vibe-booking/renderers/types.ts

interface ContentRendererProps<T> {
  data: T;                              // Pre-validated data
  itemId: string;                       // ContentItem.id
  isStreaming?: boolean;                // True while chunks arriving
  actions?: ContentAction[];            // Buttons from agent
  onAction: (action: ContentAction) => void;
  onDismiss: () => void;
}

type ContentRenderer<T> = React.ComponentType<ContentRendererProps<T>>;
```

### 5.2 Renderer Registry

All renderers are lazy-loaded for code splitting. Each has a Zod schema.

```typescript
// lib/vibe-booking/content-registry.ts

import { z } from 'zod';
import { lazy } from 'react';

const TripCardsRenderer = lazy(() => import('@/components/vibe-booking/renderers/TripCards'));
const HotelCardsRenderer = lazy(() => import('@/components/vibe-booking/renderers/HotelCards'));
const MapViewRenderer = lazy(() => import('@/components/vibe-booking/renderers/MapView'));
const BookingSummaryRenderer = lazy(() => import('@/components/vibe-booking/renderers/BookingSummary'));
const QRPaymentRenderer = lazy(() => import('@/components/vibe-booking/renderers/QRPayment'));
const BookingConfirmedRenderer = lazy(() => import('@/components/vibe-booking/renderers/BookingConfirmed'));
const PaymentStatusRenderer = lazy(() => import('@/components/vibe-booking/renderers/PaymentStatus'));
const TextSummaryRenderer = lazy(() => import('@/components/vibe-booking/renderers/TextSummary'));
// ... other renderers

export const CONTENT_REGISTRY = {
  trip_cards: { renderer: TripCardsRenderer, schema: TripCardsSchema },
  hotel_cards: { renderer: HotelCardsRenderer, schema: HotelCardsSchema },
  map_view: { renderer: MapViewRenderer, schema: MapViewSchema },
  booking_summary: { renderer: BookingSummaryRenderer, schema: BookingSummarySchema },
  qr_payment: { renderer: QRPaymentRenderer, schema: QRPaymentSchema },
  booking_confirmed: { renderer: BookingConfirmedRenderer, schema: BookingConfirmedSchema },
  payment_status: { renderer: PaymentStatusRenderer, schema: PaymentStatusSchema },
  text_summary: { renderer: TextSummaryRenderer, schema: TextSummarySchema },
  // ... etc
} as const;
```

### 5.3 Auto-Render Pipeline

```typescript
// lib/vibe-booking/content-pipeline.ts

import { z } from 'zod';
import { CONTENT_REGISTRY } from './content-registry';

interface RenderResult {
  success: boolean;
  component?: React.ReactNode;
  error?: string;
}

export function createContentRenderer(
  type: string,
  data: unknown,
  itemId: string,
  onAction: (action: ContentAction) => void
): RenderResult {
  // 1. Check if type exists in registry
  const entry = CONTENT_REGISTRY[type as keyof typeof CONTENT_REGISTRY];
  if (!entry) {
    console.warn(`[ContentPipeline] Unknown content type: ${type}`);
    return { success: false, error: `Unknown content type: ${type}` };
  }

  // 2. Validate data with Zod schema (at ingestion time)
  const validation = entry.schema.safeParse(data);
  if (!validation.success) {
    console.error(`[ContentPipeline] Validation failed for ${type}:`, validation.error);
    return { success: false, error: `Invalid data for ${type}` };
  }

  // 3. Return lazy-loaded component with validated data
  const Renderer = entry.renderer;
  return {
    success: true,
    component: (
      <Renderer
        data={validation.data}
        itemId={itemId}
        onAction={onAction}
      />
    ),
  };
}
```

### 5.4 Example Renderer: `TripCardsRenderer`

```typescript
// components/vibe-booking/renderers/TripCards.tsx
'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Star, MapPin, Clock, Users } from 'lucide-react';
import type { ContentRendererProps } from '@/lib/vibe-booking/renderers/types';
import type { z } from 'zod';
import type { TripCardsSchema } from '@/lib/vibe-booking/content-registry';

type TripCardsData = z.infer<typeof TripCardsSchema>;

export const TripCardsRenderer = memo(function TripCardsRenderer({
  data,
  onAction,
}: ContentRendererProps<TripCardsData>) {
  const { trips } = data;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {trips.map((trip) => (
        <div
          key={trip.id}
          className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="relative h-40 w-full">
            <Image
              src={trip.imageUrl}
              alt={trip.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{trip.name}</h3>
            <div className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
              <MapPin className="h-3.5 w-3.5" />
              {trip.province}
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {trip.durationDays} days
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {trip.rating} ({trip.reviewCount})
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                ${trip.priceUsd}
              </span>
              <button
                onClick={() => onAction({ type: 'book_trip', label: 'Book', payload: { tripId: trip.id } })}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
```

---

## 6. Content Stage — Dual Rendering Modes

The Content Stage supports two rendering modes depending on the context:

### 6.1 Discovery Mode (Multiple Items Stacked)

When the user is browsing/searching, multiple content items stack vertically:

```
┌─────────────────────────────────────┐
│ Content Stage Header                │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ [Trip Cards]                    │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [Map View]                      │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [Budget Estimate]               │ │
│ └─────────────────────────────────┘ │
│           (scrollable)              │
└─────────────────────────────────────┘
```

**Behavior:**
- New content appends to the bottom by default
- `metadata.replace: true` replaces items of the same type
- Items are scrollable within the Content Stage
- Each item has a dismiss button (X) to remove it

### 6.2 Booking Flow Mode (Single Item with Transition)

When the user is in a booking flow, only one item is visible with smooth transitions:

```
┌─────────────────────────────────────┐
│ Content Stage Header                │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │   [Booking Summary]  ───────────┼─┼──► [QR Payment] ───► [Confirmed]
│ │                                 │ │        (slide)         (slide)
│ │                                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Behavior:**
- Uses `AnimatePresence` for enter/exit animations
- Previous content slides out, new content slides in
- Booking flow items have `metadata.replace: true`
- Transition: `initial={{ x: 100 }}` → `animate={{ x: 0 }}` → `exit={{ x: -100 }}`

### 6.3 ContentStage Implementation

```typescript
// components/vibe-booking/ContentStage.tsx

'use client';

import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVibeBookingStore } from '@/stores/vibe-booking.store';
import { ContentItem } from './ContentItem';
import { ContentPlaceholder } from './ContentPlaceholder';
import { StreamingIndicator } from './StreamingIndicator';

export const ContentStage = memo(function ContentStage() {
  const { contentItems, activeContentId, isStreaming } = useVibeBookingStore();

  // Filter to non-error, non-removed items
  const visibleItems = contentItems.filter((i) => i.status !== 'error');

  // Check if we're in booking flow mode (single active item)
  const isBookingFlow = activeContentId && ['booking_summary', 'qr_payment', 'booking_confirmed'].includes(
    contentItems.find((i) => i.id === activeContentId)?.type || ''
  );

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <ContentStageHeader />

      {/* Content Area */}
      <div className="relative flex-1 overflow-y-auto">
        {visibleItems.length === 0 ? (
          <ContentPlaceholder />
        ) : isBookingFlow ? (
          // Single-item mode with transitions
          <AnimatePresence mode="wait">
            {activeContentId && (
              <motion.div
                key={activeContentId}
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="absolute inset-0 p-4"
              >
                <ContentItem item={contentItems.find((i) => i.id === activeContentId)!} />
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          // Multi-item stacked mode
          <div className="flex flex-col gap-4 p-4">
            {visibleItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <ContentItem item={item} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Streaming indicator */}
        {isStreaming && visibleItems.length > 0 && (
          <div className="px-4 pb-4">
            <StreamingIndicator />
          </div>
        )}
      </div>
    </div>
  );
});
```

---

## 7. AI Conversation Flow Design

This section defines the practical, context-aware behavior of the Vibe Booking chat interface. The AI is not a generic Q&A bot — it is a **goal-oriented booking concierge** that gathers missing context incrementally and calls only the tools relevant to the user's current intent.

### 7.1 Intent Detection & Tool Filtering

The AI classifies each user message into an **Intent Category** before deciding which tools to call. It never calls all tools — only the ones directly relevant.

| Intent | Example User Message | Relevant Tools | Content Stage Shows |
|--------|---------------------|----------------|---------------------|
| `hotel_search` | "Hotel near me" | `getHotelDetails`, `getPlaces` (for location context) | Hotel cards + map |
| `trip_search` | "3-day temple tour" | `getTripSuggestions`, `getTripItinerary` | Trip cards |
| `transport_search` | "Van from Phnom Penh to Siem Reap" | `getTransportOptions` | Transport comparison |
| `guide_search` | "English-speaking guide in Battambang" | `getGuides` | Guide profiles |
| `booking_request` | "Book this hotel" | `validateUserDetails`, `createBooking` | Booking summary |
| `payment_check` | "Is my payment done?" | `checkPaymentStatus` | Payment status card |
| `budget_estimate` | "How much for 5 days?" | `estimateBudget`, `getCurrencyRates` | Budget breakdown |
| `general_info` | "What's the weather like?" | `getWeatherForecast` | Weather widget |

**Tool Filtering Rules:**
1. If intent is `hotel_search`, ONLY hotel-related tools are eligible.
2. If intent is `trip_search`, ONLY trip-related tools are eligible.
3. `createBooking` is ONLY called after explicit user confirmation ("yes, book it").
4. `generatePaymentQR` is ONLY called after a booking is in `HOLDING` state.
5. `checkPaymentStatus` is ONLY called when the user asks about payment or during payment polling.

### 7.2 Location Gathering Flow

Location is critical for "near me" queries. The AI gathers it incrementally:

```
User: "Hotel near me"
        ↓
AI: "I'd be happy to find hotels near you! Could you share your location?
     You can:
     1. Send a Google Maps link
     2. Share your live location
     3. Tell me the area (e.g., 'Riverside, Phnom Penh')"
        ↓
┌─────────────────┬─────────────────┬─────────────────┐
│ Option 1:       │ Option 2:       │ Option 3:       │
│ Google Maps Link│ Live Location   │ Text Area       │
│                 │                 │                 │
│ User pastes:    │ User clicks     │ User types:     │
│ https://goo.gl/ │ "Share Location"│ "Riverside, PP" │
│ maps/abc123     │ → browser       │                 │
│                 │ geolocation API │                 │
└────────┬────────┴────────┬────────┴────────┬────────┘
         │                 │                 │
         └─────────────────┴─────────────────┘
                           ↓
              AI extracts lat/lng or area name
                           ↓
              AI calls getHotelDetails with location
                           ↓
              Content Stage shows hotel cards + map
```

**Location Input Types:**

| Input Type | Parser | Precision | Example |
|-----------|--------|-----------|---------|
| Google Maps URL | Regex extract `?q=lat,lng` or `@lat,lng` | Exact | `https://maps.app.goo.gl/...` |
| Apple Maps URL | Regex extract `?ll=lat,lng` | Exact | `https://maps.apple.com/...` |
| Raw coordinates | `lat,lng` pattern | Exact | `11.5564,104.9282` |
| Area name | Forward geocoding (Nominatim) | Approximate | `Riverside, Phnom Penh` |
| Province only | Match against known provinces | Broad | `Siem Reap` |

**Location Gathering State Machine:**

```typescript
type LocationState =
  | { status: 'not_needed' }                           // User gave specific hotel name
  | { status: 'needed'; reason: 'hotel_nearby' | 'trip_starting_point' | 'transport_origin' }
  | { status: 'requested'; method: 'any' }             // AI asked, waiting for user
  | { status: 'parsing'; rawInput: string }            // Frontend parsing location
  | { status: 'resolved'; lat: number; lng: number; address: string }
  | { status: 'fallback'; areaName: string };          // Using broad area
```

### 7.3 Context-Aware Tool Selection

The AI maintains a **Context Stack** that tracks what the user is currently looking at. This prevents irrelevant suggestions.

```typescript
// AI Agent context (simplified)
interface ConversationContext {
  currentIntent: IntentCategory | null;
  activeHotelId: string | null;      // User is viewing this hotel
  activeTripId: string | null;       // User is viewing this trip
  activeBookingId: string | null;    // User has an active booking hold
  userLocation: { lat: number; lng: number; address: string } | null;
  lastToolCall: string | null;       // Prevent duplicate tool calls
  searchFilters: {
    priceMin?: number;
    priceMax?: number;
    ratingMin?: number;
    amenities?: string[];
  };
}
```

**Context Rules:**

1. **If user is viewing a hotel** (`activeHotelId` set):
   - "Book it" → calls `createBooking` for that hotel
   - "Show me the rooms" → calls `getHotelDetails` with room detail flag
   - "What's nearby?" → calls `getPlaces` centered on hotel location
   - "Find another" → clears `activeHotelId`, calls `getHotelDetails` with new search

2. **If user is viewing a trip** (`activeTripId` set):
   - "Book it" → calls `createBooking` for that trip
   - "What's the itinerary?" → calls `getTripItinerary`
   - "How do I get there?" → calls `getTransportOptions` with trip start location
   - "Find another" → clears `activeTripId`, calls `getTripSuggestions`

3. **If user has no active item**:
   - "Book it" → AI asks: "Which one would you like to book?"
   - "Show me more" → AI asks: "More about what? Hotels, trips, or transport?"

### 7.4 Focused Content Rendering

The Content Stage only shows what is relevant to the current conversation. It does not accumulate unrelated content.

**Content Lifecycle Rules:**

| Scenario | Behavior |
|----------|----------|
| User searches for hotels | Content Stage clears previous content, shows only hotel cards + map |
| User searches for trips | Content Stage clears previous content, shows only trip cards |
| User clicks "Book" on a hotel card | Content Stage transitions to booking summary (replaces hotel cards) |
| User asks "What about budget?" | Budget breakdown appends below current content (related context) |
| User changes intent entirely | Content Stage shows confirmation: "Clear current results and show [new intent]?" |
| User returns to previous search | Content Stage restores previous content from history (scroll back up) |

### 7.5 Practical Conversation Examples

#### Example 1: Hotel Search with Location

```
User: "Hotel near me"
AI:   "I'd love to help you find a hotel! Could you share your location?
      You can send a map link, share live location, or just tell me the area."

User: [clicks "Share Location" → browser geolocation]
AI:   "Great! I found 5 hotels near you in Toul Tom Poung, Phnom Penh.
      Here are the top picks."
      [Content Stage: Hotel cards + map with user location pin]

User: "The second one looks nice"
AI:   "Sakura Hotel — $45/night, 4.5 stars. Would you like to see
      the rooms or book it?"

User: "Book it for 2 nights, May 15-17"
AI:   "Perfect! Here's your booking summary."
      [Content Stage: Booking summary card with price breakdown]
      "Shall I hold this for 15 minutes while you complete payment?"

User: "Yes"
AI:   "Held! Here's your payment options."
      [Content Stage: Payment options - Stripe card or Bakong QR]
```

#### Example 2: Payment Status Check

```
User: "Did my payment go through?"
AI:   "Let me check..."
      [calls checkPaymentStatus]
      [Content Stage: Payment status card - PENDING with refresh button]
      "Your payment is still processing. I'll update you when it's done."

[30 seconds later, WebSocket payment_status arrives]
AI:   "Good news! Your payment is confirmed."
      [Content Stage: Transitions to booking confirmed]
      "Your booking DLG-2026-0042 is all set!"
```

---

## 8. WebSocket Message Protocol

### 8.1 Client → Server

```typescript
// Authentication (first message after connection)
interface AuthMessage {
  type: 'auth';
  payload: {
    userId: string;
    sessionId: string; // UUID
    preferredLanguage: 'EN' | 'ZH' | 'KM';
    token: string; // JWT access token
  };
}

// User text message
interface UserMessage {
  type: 'user_message';
  payload: {
    message: string;
    context?: {
      currentContentType?: ContentType;
      selectedItemId?: string;
    };
  };
}

// Action from content interaction (button click)
interface UserActionMessage {
  type: 'user_action';
  payload: {
    actionType: string; // e.g., "book_trip", "view_detail"
    itemId: string;
    data: Record<string, unknown>;
  };
}

// Location sharing
interface LocationMessage {
  type: 'location';
  payload: {
    lat: number;
    lng: number;
    accuracy?: number;
    address?: string;
  };
}
```

### 8.2 Server → Client

```typescript
// Typing indicators
interface TypingStartMessage {
  type: 'typing_start';
  timestamp: string;
}

interface TypingEndMessage {
  type: 'typing_end';
  timestamp: string;
}

// Agent response with content payload (triggers auto-render)
interface AgentResponseMessage {
  type: 'agent_message';
  payload: {
    text: string; // Summary for chat panel
    content_payload?: ContentPayload; // JSON for auto-render
    state: AgentState;
    meta?: {
      tool_call_id: string;
      tool_name: string;
      latency_ms: number;
      source: string;
      timestamp: string;
    };
  };
  timestamp: string;
}

// Streaming / partial result (for incremental updates)
interface AgentStreamMessage {
  type: 'agent_stream_chunk';
  payload: {
    content_type: ContentType;
    content_data: Record<string, unknown>; // partial data
    meta: {
      tool_call_id: string;
      sequence_number: number; // 0, 1, 2... for ordering
      is_final: boolean;       // true when all chunks sent
      total_expected: number;  // expected total items
    };
  };
}

// Tool execution status
interface AgentToolStatusMessage {
  type: 'agent_tool_status';
  payload: {
    tool_call_id: string;
    tool_name: string;
    status: 'started' | 'in_progress' | 'completed' | 'failed';
    progress?: number; // 0-100, optional
    estimated_duration_ms?: number;
  };
}

// Payment status update (pushed from server)
interface PaymentStatusMessage {
  type: 'payment_status';
  payload: {
    paymentIntentId: string;
    bookingId: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
    amountUsd: number;
    amountKhr: number;
    receiptUrl?: string;
  };
  timestamp: string;
}

// Booking hold expiry warning
interface BookingHoldExpiryMessage {
  type: 'booking_hold_expiry';
  payload: {
    bookingId: string;
    secondsRemaining: number;
  };
  timestamp: string;
}

// Error
interface ErrorMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}
```

### 8.3 ContentPayload Schema

```typescript
interface ContentPayload {
  // Renderer selector — determines which component renders
  type: ContentType;

  // Structured data — validated by Zod schema per type
  data: Record<string, unknown>;

  // Interactive actions rendered as buttons within the content
  actions: Array<{
    type: string;
    label: string;
    payload: Record<string, unknown>;
    style?: 'primary' | 'secondary' | 'danger';
    icon?: string;
  }>;

  // Display metadata
  metadata: {
    title?: string;        // Shown in ContentStage header
    subtitle?: string;     // Shown below title
    icon?: string;         // Lucide icon name
    backable?: boolean;    // Show back button?
    shareable?: boolean;   // Show share button?
    replace?: boolean;     // Replace current content vs. append?
  };
}
```

### 8.4 Streaming Chunk Handling

When multiple tools run in parallel, the agent sends incremental updates:

```typescript
// Frontend behavior for streaming:
// sequence_number === 0: Create ContentItem with status: "streaming"
// sequence_number > 0: Update existing ContentItem, append new data
// is_final === true: Set status: "ready"

// In useContentRouter:
case 'agent_stream_chunk': {
  const { payload } = wsMessage;
  const existingItem = getContentItemByToolCallId(payload.meta.tool_call_id);

  if (!existingItem) {
    // First chunk — create new item with streaming status
    addContentItem({
      id: generateId(),
      type: payload.content_type,
      data: payload.content_data,
      actions: [],
      metadata: {},
      status: 'streaming',
      timestamp: wsMessage.timestamp,
      linkedToolCallId: payload.meta.tool_call_id,
    });
  } else {
    // Subsequent chunk — merge data
    updateContentItem(existingItem.id, {
      data: mergeStreamData(existingItem.data, payload.content_data),
      status: payload.meta.is_final ? 'ready' : 'streaming',
    });
  }
  break;
}
```

---

## 9. Action Handling System

When a user clicks an action button in rendered content, the action is sent back to the AI agent via WebSocket. The AI processes the action and responds with new content.

### 9.1 Action Round-Trip Flow

```
User clicks "Book This Tour" button in TripCardsRenderer
        │
        ▼
ContentItem calls onAction({
  type: 'book_trip',
  label: 'Book This Tour',
  payload: { tripId: 'trip_angkor_classic' }
})
        │
        ▼
useContentRouter sends user_action WebSocket message:
{
  type: 'user_action',
  payload: {
    actionType: 'book_trip',
    itemId: 'content_abc123',
    data: { tripId: 'trip_angkor_classic' }
  }
}
        │
        ▼
AI Agent receives action → calls createBooking tool
        │
        ▼
AI Agent sends new agent_message with:
  content_payload.type = 'booking_summary'
  content_payload.data = { bookingId, trip, dates, priceBreakdown }
        │
        ▼
Content Stage auto-renders BookingSummaryRenderer
Chat Panel shows: "Great! I've prepared your booking. Please review the details."
```

### 9.2 Optimistic UI for Actions

When the user clicks an action, show immediate feedback before the AI responds:

```typescript
// In ContentItem.tsx
function handleAction(action: ContentAction) {
  // 1. Optimistic UI: show loading state on the button
  setOptimisticAction(action.type);

  // 2. Send action to AI
  sendWebSocketMessage({
    type: 'user_action',
    payload: {
      actionType: action.type,
      itemId: item.id,
      data: action.payload,
    },
  });

  // 3. Clear optimistic state when AI responds (via useEffect)
}
```

---

## 10. Animation Strategy

All animations use Framer Motion (for enter/exit transitions) and CSS transitions (for simple state changes). Respects `prefers-reduced-motion`.

```css
/* globals.css additions */

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.vibe-streaming-dot {
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .vibe-streaming-dot {
    animation: none;
  }
}
```

**Drag/Resize:** Pure CSS `transform: translate(x, y)` for position, `width/height` for size. No transition during drag; instant snap on dock.

**Content Transitions:**
- Discovery mode: CSS `fade + translateY` (300ms ease-out)
- Booking flow mode: Framer Motion `AnimatePresence` with slide (300ms ease-in-out)
- Content highlight: CSS `box-shadow` pulse (2s)

---

## 11. Error Handling

### 11.1 Per-Content Error Boundary

Each `ContentItem` wraps its renderer in an error boundary:

```typescript
// components/vibe-booking/ContentItem.tsx
class ContentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ContentError
          message="Failed to display this content."
          error={this.state.error?.message}
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}
```

### 11.2 Zod Validation Failure

When AI sends malformed JSON:
1. Log error to console (dev) / Sentry (prod)
2. Render `TextSummaryRenderer` with fallback text
3. Show inline error: "Content format error — showing text summary instead"

### 11.3 WebSocket Error Recovery

| Scenario | Behavior |
|----------|----------|
| Connection lost | Show "Reconnecting..." banner; queue outbound messages |
| Reconnect success | Flush queued messages; restore session |
| Reconnect fail (max retries) | Show "Connection lost" with manual retry button |
| Invalid message type | Log warning; render as text summary fallback |
| Zod validation fail | Render `ContentError`; log to Sentry in production |
| Payment API timeout | Show retryable error; preserve form state |
| Booking hold expiry | Show expiry notice with "Restart Booking" button |

---

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest + React Testing Library)

```typescript
// tests/vibe-booking/useDraggableResizable.test.ts
describe('useDraggableResizable', () => {
  it('updates position on mouse drag', () => { /* ... */ });
  it('snaps to left dock when near edge', () => { /* ... */ });
  it('respects min/max dimensions', () => { /* ... */ });
});

// tests/vibe-booking/content-renderers/TripCards.test.tsx
describe('TripCardsRenderer', () => {
  it('renders trip grid from valid data', () => { /* ... */ });
  it('shows error fallback for invalid data', () => { /* ... */ });
  it('calls onAction when Book Now clicked', () => { /* ... */ });
});

// tests/vibe-booking/vibeBookingStore.test.ts
describe('vibeBookingStore', () => {
  it('persists layout to localStorage', () => { /* ... */ });
  it('limits persisted messages to 50', () => { /* ... */ });
});
```

### 12.2 Integration Tests

```typescript
// tests/vibe-booking/WebSocketFlow.test.tsx
describe('WebSocket Content Routing', () => {
  it('renders trip cards on agent_message with content_payload.type=trip_cards', async () => {
    // Mock WebSocket server
    // Send agent_message with trip_cards payload
    // Assert ContentStage contains TripCardsRenderer
  });

  it('shows booking confirmed after payment_status event', async () => {
    // Simulate booking flow
    // Emit payment_status WebSocket event
    // Assert ContentStage shows BookingConfirmedRenderer
  });
});
```

### 12.3 E2E Tests (Playwright)

```typescript
// e2e/vibe-booking.spec.ts
test('complete booking flow', async ({ page }) => {
  await page.goto('/vibe-booking');
  await page.fill('[data-testid="chat-input"]', '3-day temple tour');
  await page.press('[data-testid="chat-input"]', 'Enter');
  await expect(page.locator('[data-testid="content-trip_cards"]')).toBeVisible();
  await page.click('[data-testid="book-now-button"]');
  await expect(page.locator('[data-testid="booking-summary"]')).toBeVisible();
  // ... complete flow
});
```

---

## 13. Security Checklist

| Requirement | Implementation |
|-------------|---------------|
| XSS prevention | DOMPurify on all user input and AI HTML before `dangerouslySetInnerHTML` |
| No secrets in console | `bookingRef` and `paymentIntentId` redacted from logs |
| WSS in production | `useWebSocket` checks `NODE_ENV` and uses `wss://` when `production` |
| localStorage namespacing | All keys prefixed with `derlg:` |
| QR expiry overlay | CSS `::after` pseudo-element with countdown text over QR image |
| Rate limiting UI | Disable send button for 500ms after each message to prevent spam |

---

## 14. Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Time to Interactive | < 2.5s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| Drag/Resize FPS | 60fps | Chrome DevTools FPS meter |
| Content History Scroll | 60fps at 100 items | Chrome DevTools FPS meter |
| Bundle Size (vibe-booking route) | < 150KB gzipped | `next build` analyzer |

---

## 15. Future Enhancements (Post-MVP)

1. **Voice Input:** Microphone button in ChatInput → speech-to-text → send as message.
2. **Image Search:** User uploads photo → AI suggests similar trips/places.
3. **Multi-Agent Tabs:** User can have multiple parallel chat sessions (trip A, trip B) with separate Content Stages.
4. **Collaborative Booking:** Share Content Stage URL with travel companion for real-time co-browsing.
5. **AI-Generated Itinerary PDF:** One-click export of full itinerary with maps, QR codes, and emergency contacts.

---

## 16. Document Relationships

| Document | Purpose |
|----------|---------|
| `design.md` | **This document** — Component architecture, data flow, state management, AI conversation flow |
| `requirements.md` | Functional requirements with acceptance criteria |
| `system-design.md` | JSON-driven auto-render architecture, ContentPayload protocol, renderer system, Zod schemas |
| `auto-render-system-design.md` | Detailed render loop, message protocols, store design, transition rules |
| `vibe_booking_researched.md` | Market research, competitive analysis, UX patterns |
| `../agentic-llm-chatbot/requirements.md` | AI agent backend requirements |
| `../frontend-nextjs-implementation/design.md` | Base app architecture |
| `../../product/prd.md` | Product requirements (F10–F16) |

---

*This document is a living design. Update it when component contracts, message protocols, or state shapes change.*
