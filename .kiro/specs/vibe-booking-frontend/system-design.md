# System Design: Vibe Booking Frontend — JSON-Driven Auto-Render Architecture

> **Scope:** This document defines the system architecture for the Vibe Booking Frontend, a Cambodia-focused conversational booking interface. The core design principle is **strict separation of concerns**: the AI chat interface delivers text summaries only, while a JSON ContentPayload from AI tool calls automatically triggers full page rendering in the Content Stage.
>
> **Prerequisite:** Read `requirements.md` and `design.md` in this directory. This document focuses specifically on the system architecture, data flow, and JSON protocol that enables automatic content rendering.

---

## 1. Architectural Philosophy

### 1.1 Core Principle: Chat is Summary, JSON is Content

The Vibe Booking interface follows a strict architectural separation:

| Layer | Responsibility | Format | User Experience |
|-------|---------------|--------|----------------|
| **Chat Panel** | Conversational interface | Plain text + action buttons | User reads summaries, asks questions, gives instructions |
| **Content Stage** | Rich content display | JSON-driven auto-render | User browses full content: maps, cards, galleries, forms |
| **AI Agent** | Orchestrates tool calls | JSON payload generation | Calls tools, receives data, sends JSON to frontend |

**Key rule:** The AI agent never sends HTML, JSX, or rendered markup. It sends structured JSON. The frontend owns all rendering logic. This ensures:
- **Security:** No XSS from AI-generated markup
- **Consistency:** All content follows DerLg's design system
- **Performance:** Frontend can lazy-load renderers, cache content, optimize assets
- **Testability:** JSON payloads are easy to validate, mock, and snapshot

### 1.2 Cambodia-First Content Model

All content types are designed specifically for Cambodia travel:

- **Provinces:** 25 Cambodia provinces with localized names (EN/ZH/KM)
- **Transport:** Tuk-tuk, remork, van, bus, private car (Cambodia-specific)
- **Payment:** USD primary, KHR secondary, Bakong/ABA QR codes
- **Attractions:** Angkor Wat, Bayon, Ta Prohm, Tonle Sap, Koh Rong, etc.
- **Seasons:** Dry season (Nov–Apr), wet season (May–Oct), peak season (Dec–Jan)
- **Festivals:** Khmer New Year, Water Festival, Pchum Ben

---

## 2. System Architecture

### 2.1 High-Level Data Flow

```
┌──────────────┐     User Message      ┌──────────────┐
│   Traveler   │ ────────────────────► │  Chat Panel  │
│  (Cambodia)  │                       │  (Summary)   │
└──────────────┘                       └──────┬───────┘
       ▲                                      │
       │                                      │ WebSocket
       │                                      ▼
       │                              ┌──────────────┐
       │                              │  AI Agent    │
       │                              │ (Python/     │
       │                              │  LangGraph)  │
       │                              └──────┬───────┘
       │                                     │
       │                              ┌──────┴───────┐
       │                              │  Tool Calls  │
       │                              │ (NestJS API) │
       │                              └──────┬───────┘
       │                                     │
       │                              ┌──────┴───────┐
       │                              │  JSON Result │
       │                              │  (structured)│
       │                              └──────┬───────┘
       │                                     │
       │         ┌───────────────────────────┘
       │         │ WebSocket: agent_message
       │         │   ├── text: "I found 3 tours..."
       │         │   └── content_payload: { type, data }
       │         │
       │         ▼
       │  ┌──────────────┐         ┌─────────────────┐
       └──┤ Content      │◄────────┤ ContentRouter   │
          │ Stage        │         │ (auto-render)   │
          │ (Full Page)  │         └─────────────────┘
          └──────────────┘
```

### 2.2 Auto-Render Mechanism

When the AI agent completes a tool call, it sends a single WebSocket message containing both the text summary and the JSON content payload. The frontend automatically routes the JSON to the Content Stage without user intervention.

```
WebSocket Message Arrives
        │
        ▼
┌─────────────────┐
│ MessageParser   │ ──► Extracts `text` → Chat Panel (summary)
│                 │ ──► Extracts `content_payload` → ContentRouter
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ContentRouter   │ ──► Reads `payload.type` (e.g., "trip_cards")
│                 │ ──► Looks up renderer in registry
│                 │ ──► Validates `payload.data` with Zod schema
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ContentStore    │ ──► Adds new ContentItem to state
│                 │ ──► Triggers React re-render
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ContentStage    │ ──► Maps ContentItem.type → Renderer component
│                 │ ──► Passes `data` as props
│                 │ ──► Renderer auto-mounts with full content
└─────────────────┘
```

**Auto-render rules:**
1. Every `agent_message` with a `content_payload` triggers automatic rendering
2. No user click required to show content
3. Content appears immediately (with skeleton placeholder during loading)
4. Previous related content is replaced, not stacked (e.g., new hotel search replaces old hotel cards)
5. Related content appends (e.g., itinerary appends below trip cards for the same trip)

### 2.3 Component Architecture

```
VibeBookingPage (Server Component)
└── SplitScreenLayout (Client Component)
    ├── ChatPanel (Client Component)
    │   ├── ChatHeader (drag handle, status, collapse)
    │   ├── MessageList (scrollable, virtualized)
    │   │   └── ChatMessage (text-only summary from AI)
    │   ├── TypingIndicator (pulsing dots)
    │   └── ChatInput (user message entry)
    │
    └── ContentStage (Client Component) ── PRIMARY VIEWPORT
        ├── ContentStageHeader (title, streaming indicator, clear)
        ├── ContentHistory (scrollable container)
        │   └── ContentItem (auto-rendered from JSON)
        │       ├── ContentRenderer (switched by JSON type)
        │       │   ├── TripCardsRenderer ──► Full trip grid with images
        │       │   ├── HotelCardsRenderer ──► Hotel listings with map
        │       │   ├── MapViewRenderer ──► Interactive Leaflet map
        │       │   ├── ItineraryRenderer ──► Day-by-day timeline
        │       │   ├── BookingSummaryRenderer ──► Price breakdown + confirm
        │       │   ├── QRPaymentRenderer ──► Large scannable QR code
        │       │   ├── BookingConfirmedRenderer ──► Ref + QR + downloads
        │       │   ├── PaymentStatusRenderer ──► Status badge + actions
        │       │   ├── BudgetEstimateRenderer ──► Cost breakdown chart
        │       │   ├── WeatherRenderer ──► 5-day forecast widget
        │       │   ├── TransportOptionsRenderer ──► Comparison table
        │       │   └── TextSummaryRenderer ──► Fallback text block
        │       └── ErrorBoundary (per-item isolation)
        └── ContentPlaceholder (welcome state)
```

---

## 3. JSON ContentPayload Protocol

### 3.1 Message Envelope

Every message from the AI agent follows this structure:

```typescript
interface AgentMessage {
  type: 'agent_message';
  session_id: string;
  timestamp: string; // ISO 8601

  // ── Chat Panel (text summary) ──────────────────────
  text: string;
  // Example: "I found 3 amazing temple tours in Siem Reap for you!"

  // ── Content Stage (auto-render JSON) ───────────────
  content_payload?: ContentPayload;

  // ── Conversation State ─────────────────────────────
  state: AgentState;
}
```

### 3.2 ContentPayload Schema

```typescript
interface ContentPayload {
  // Renderer selector — determines which component renders
  type: ContentType;

  // Structured data — validated by Zod schema per type
  data: ContentTypeDataMap[ContentType];

  // Interactive actions rendered as buttons within the content
  actions: ContentAction[];

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

### 3.3 ContentType Registry

| Type | Renderer | Zod Schema | Cambodia Context |
|------|----------|------------|------------------|
| `trip_cards` | `TripCardsRenderer` | `TripCardsSchema` | Temple tours, beach getaways, adventure trips |
| `trip_detail` | `TripDetailRenderer` | `TripDetailSchema` | Full itinerary with Cambodian attractions |
| `hotel_cards` | `HotelCardsRenderer` | `HotelCardsSchema` | Hotels/guesthouses in Phnom Penh, Siem Reap, Sihanoukville |
| `hotel_detail` | `HotelDetailRenderer` | `HotelDetailSchema` | Room types, amenities, nearby Cambodian attractions |
| `transport_options` | `TransportOptionsRenderer` | `TransportOptionsSchema` | Tuk-tuk, van, bus, private car between provinces |
| `map_view` | `MapViewRenderer` | `MapViewSchema` | Cambodia map with province markers, routes |
| `itinerary` | `ItineraryRenderer` | `ItinerarySchema` | Day-by-day schedule with Cambodian temples, markets |
| `booking_summary` | `BookingSummaryRenderer` | `BookingSummarySchema` | Price in USD/KHR, 15-min hold countdown |
| `qr_payment` | `QRPaymentRenderer` | `QRPaymentSchema` | Bakong/ABA QR code, amount in KHR/USD |
| `payment_status` | `PaymentStatusRenderer` | `PaymentStatusSchema` | PENDING/SUCCEEDED/FAILED badge |
| `booking_confirmed` | `BookingConfirmedRenderer` | `BookingConfirmedSchema` | DLG-YYYY-NNNN reference, check-in QR |
| `budget_estimate` | `BudgetEstimateRenderer` | `BudgetEstimateSchema` | USD/KHR/CNY breakdown for Cambodia costs |
| `weather` | `WeatherRenderer` | `WeatherSchema` | Cambodia seasonal forecast (dry/wet season) |
| `comparison` | `ComparisonRenderer` | `ComparisonSchema` | Side-by-side trip/hotel comparison |
| `image_gallery` | `ImageGalleryRenderer` | `ImageGallerySchema` | Cambodia destination photos |
| `text_summary` | `TextSummaryRenderer` | `TextSummarySchema` | Fallback plain text display |

### 3.4 Example: Trip Search Flow (Full JSON)

**Step 1: User sends message**
```
User (Chat): "3-day temple tour in Siem Reap under $300"
```

**Step 2: AI Agent processes**
- Detects intent: `trip_search`
- Extracts: province="Siem Reap", duration=3, budget=300, theme="temple"
- Calls tool: `search_trips({ province: "Siem Reap", duration_days: 3, budget_usd: 300, theme: "temple" })`

**Step 3: Backend returns data**
```json
{
  "trips": [
    {
      "id": "trip_angkor_classic",
      "name": "Angkor Classic Temple Tour",
      "description": "Explore Angkor Wat, Bayon, and Ta Prohm over 3 days with a licensed English-speaking guide.",
      "province": "Siem Reap",
      "durationDays": 3,
      "priceUsd": 245,
      "priceKhr": 998000,
      "rating": 4.8,
      "reviewCount": 342,
      "imageUrl": "https://cdn.derlg.com/trips/angkor-classic-1.jpg",
      "highlights": ["Angkor Wat sunrise", "Bayon smiling faces", "Ta Prohm jungle temple"],
      "includes": ["Guide", "Transport", "Temple pass", "Lunch"],
      "meetingPoint": "Siem Reap Pub Street",
      "maxGuests": 8
    },
    {
      "id": "trip_banteay_srei",
      "name": "Banteay Srei & Remote Temples",
      "description": "Visit the pink sandstone temple of Banteay Srei and off-the-beaten-path ruins.",
      "province": "Siem Reap",
      "durationDays": 3,
      "priceUsd": 195,
      "priceKhr": 794000,
      "rating": 4.6,
      "reviewCount": 128,
      "imageUrl": "https://cdn.derlg.com/trips/banteay-srei-1.jpg",
      "highlights": ["Banteay Srei carvings", "Kbal Spean riverbed", "Beng Mealea ruins"],
      "includes": ["Guide", "Transport", "Temple pass", "Breakfast"],
      "meetingPoint": "Your Siem Reap hotel",
      "maxGuests": 6
    }
  ]
}
```

**Step 4: AI Agent sends WebSocket message**
```json
{
  "type": "agent_message",
  "session_id": "sess_abc123",
  "timestamp": "2026-05-10T14:30:00Z",
  "text": "I found 2 incredible temple tours in Siem Reap within your $300 budget. The Angkor Classic covers the iconic temples with a small group, while the Banteay Srei tour takes you to more remote, less crowded ruins. Both include your temple pass and transport.",
  "content_payload": {
    "type": "trip_cards",
    "data": {
      "trips": [
        {
          "id": "trip_angkor_classic",
          "name": "Angkor Classic Temple Tour",
          "description": "Explore Angkor Wat, Bayon, and Ta Prohm over 3 days with a licensed English-speaking guide.",
          "province": "Siem Reap",
          "durationDays": 3,
          "priceUsd": 245,
          "priceKhr": 998000,
          "rating": 4.8,
          "reviewCount": 342,
          "imageUrl": "https://cdn.derlg.com/trips/angkor-classic-1.jpg",
          "highlights": ["Angkor Wat sunrise", "Bayon smiling faces", "Ta Prohm jungle temple"],
          "includes": ["Guide", "Transport", "Temple pass", "Lunch"],
          "meetingPoint": "Siem Reap Pub Street",
          "maxGuests": 8
        },
        {
          "id": "trip_banteay_srei",
          "name": "Banteay Srei & Remote Temples",
          "description": "Visit the pink sandstone temple of Banteay Srei and off-the-beaten-path ruins.",
          "province": "Siem Reap",
          "durationDays": 3,
          "priceUsd": 195,
          "priceKhr": 794000,
          "rating": 4.6,
          "reviewCount": 128,
          "imageUrl": "https://cdn.derlg.com/trips/banteay-srei-1.jpg",
          "highlights": ["Banteay Srei carvings", "Kbal Spean riverbed", "Beng Mealea ruins"],
          "includes": ["Guide", "Transport", "Temple pass", "Breakfast"],
          "meetingPoint": "Your Siem Reap hotel",
          "maxGuests": 6
        }
      ]
    },
    "actions": [
      {
        "type": "view_trip_detail",
        "label": "View Details",
        "payload": { "tripId": "trip_angkor_classic" },
        "style": "primary"
      },
      {
        "type": "book_trip",
        "label": "Book This Tour",
        "payload": { "tripId": "trip_angkor_classic" },
        "style": "primary"
      },
      {
        "type": "compare_trip",
        "label": "Add to Compare",
        "payload": { "tripId": "trip_angkor_classic" },
        "style": "secondary"
      }
    ],
    "metadata": {
      "title": "Temple Tours in Siem Reap",
      "subtitle": "2 options under $300",
      "icon": "Landmark",
      "replace": true,
      "shareable": true
    }
  },
  "state": "SUGGESTION"
}
```

**Step 5: Frontend auto-renders**
- Chat Panel shows: `"I found 2 incredible temple tours in Siem Reap within your $300 budget..."`
- Content Stage immediately renders: Full trip cards with images, pricing in USD/KHR, highlights, action buttons
- No user click required — content appears automatically

---

## 4. Renderer System Architecture

### 4.1 Renderer Contract

Every content renderer is a self-contained React component that:
1. Receives validated JSON data as props
2. Renders full rich content (not just text)
3. Handles its own loading, error, and empty states
4. Emits action events when user interacts

```typescript
// contracts/ContentRenderer.ts

interface ContentRendererProps<T> {
  // Validated data from AI tool result
  data: T;

  // Action handler — called when user clicks action buttons
  onAction: (action: ContentAction) => void;

  // Content item metadata
  itemId: string;
  timestamp: string;
}

type ContentRenderer<T> = React.ComponentType<ContentRendererProps<T>>;
```

### 4.2 Renderer Registry

The registry maps `ContentType` values to renderer components and Zod schemas:

```typescript
// lib/content-registry.ts

import { z } from 'zod';
import { lazy } from 'react';

// ─── Lazy-loaded renderers (code splitting) ──────────────────

const TripCardsRenderer = lazy(() => import('@/components/vibe-booking/renderers/TripCards'));
const HotelCardsRenderer = lazy(() => import('@/components/vibe-booking/renderers/HotelCards'));
const MapViewRenderer = lazy(() => import('@/components/vibe-booking/renderers/MapView'));
const ItineraryRenderer = lazy(() => import('@/components/vibe-booking/renderers/Itinerary'));
const BookingSummaryRenderer = lazy(() => import('@/components/vibe-booking/renderers/BookingSummary'));
const QRPaymentRenderer = lazy(() => import('@/components/vibe-booking/renderers/QRPayment'));
const BookingConfirmedRenderer = lazy(() => import('@/components/vibe-booking/renderers/BookingConfirmed'));
const PaymentStatusRenderer = lazy(() => import('@/components/vibe-booking/renderers/PaymentStatus'));
const BudgetEstimateRenderer = lazy(() => import('@/components/vibe-booking/renderers/BudgetEstimate'));
const WeatherRenderer = lazy(() => import('@/components/vibe-booking/renderers/Weather'));
const TransportOptionsRenderer = lazy(() => import('@/components/vibe-booking/renderers/TransportOptions'));
const ComparisonRenderer = lazy(() => import('@/components/vibe-booking/renderers/Comparison'));
const ImageGalleryRenderer = lazy(() => import('@/components/vibe-booking/renderers/ImageGallery'));
const TextSummaryRenderer = lazy(() => import('@/components/vibe-booking/renderers/TextSummary'));

// ─── Zod Schemas ─────────────────────────────────────────────

export const TripCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  province: z.enum(['Phnom Penh', 'Siem Reap', 'Sihanoukville', 'Kampot', 'Kep', 'Battambang', 'Kampong Cham', 'Kampong Thom', 'Kratie', 'Mondulkiri', 'Ratanakiri', 'Koh Kong', 'Preah Vihear', 'Kampong Speu', 'Takeo', 'Svay Rieng', 'Prey Veng', 'Kandal', 'Banteay Meanchey', 'Pailin', 'Oddar Meanchey', 'Tbong Khmum', 'Kampong Chhnang', 'Pursat', 'Stung Treng']),
  durationDays: z.number().min(1).max(30),
  priceUsd: z.number().min(0),
  priceKhr: z.number().min(0),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().min(0),
  imageUrl: z.string().url(),
  highlights: z.array(z.string()).max(5),
  includes: z.array(z.string()),
  meetingPoint: z.string(),
  maxGuests: z.number().min(1),
});

export const TripCardsSchema = z.object({
  trips: z.array(TripCardSchema).min(1),
});

export const HotelCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  address: z.string(),
  province: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  pricePerNightUsd: z.number().min(0),
  pricePerNightKhr: z.number().min(0),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().min(0),
  starRating: z.number().min(1).max(5).optional(),
  amenities: z.array(z.enum(['wifi', 'pool', 'ac', 'breakfast', 'parking', 'restaurant', 'spa', 'gym', 'laundry', 'shuttle'])),
  imageUrls: z.array(z.string().url()).min(1),
  source: z.enum(['google_places', 'partner', 'manual']),
});

export const HotelCardsSchema = z.object({
  hotels: z.array(HotelCardSchema).min(1),
});

export const MapMarkerSchema = z.object({
  id: z.string(),
  position: z.tuple([z.number(), z.number()]),
  title: z.string(),
  type: z.enum(['temple', 'hotel', 'restaurant', 'market', 'beach', 'mountain', 'transport', 'booking', 'emergency']),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const MapViewSchema = z.object({
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number().default(12),
  markers: z.array(MapMarkerSchema),
  route: z.object({
    from: z.tuple([z.number(), z.number()]),
    to: z.tuple([z.number(), z.number()]),
    waypoints: z.array(z.tuple([z.number(), z.number()])).optional(),
  }).optional(),
  fitBounds: z.boolean().default(true),
});

export const TransportOptionSchema = z.object({
  id: z.string(),
  type: z.enum(['tuk_tuk', 'remork', 'van', 'bus', 'private_car', 'boat']),
  name: z.string(),
  description: z.string(),
  capacity: z.number().min(1),
  priceUsd: z.number().min(0),
  priceKhr: z.number().min(0),
  durationMinutes: z.number().min(0),
  distanceKm: z.number().min(0),
  features: z.array(z.string()),
  provider: z.string(),
  rating: z.number().min(0).max(5).optional(),
});

export const TransportOptionsSchema = z.object({
  options: z.array(TransportOptionSchema).min(1),
  route: z.object({ from: z.string(), to: z.string(), distanceKm: z.number() }),
});

export const BookingSummarySchema = z.object({
  bookingId: z.string(),
  itemName: z.string(),
  itemImageUrl: z.string().url(),
  itemType: z.enum(['trip', 'hotel', 'transport', 'guide']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  guests: z.number().min(1),
  priceBreakdown: z.object({
    subtotalUsd: z.number(),
    subtotalKhr: z.number(),
    taxUsd: z.number(),
    taxKhr: z.number(),
    discountUsd: z.number(),
    discountKhr: z.number(),
    totalUsd: z.number(),
    totalKhr: z.number(),
  }),
  cancellationPolicy: z.string(),
  reservedUntil: z.string().datetime(),
});

export const QRPaymentSchema = z.object({
  qrCodeUrl: z.string().url(),
  qrCodeData: z.string(), // Raw QR data for client-side generation
  amountUsd: z.number(),
  amountKhr: z.number(),
  paymentMethod: z.enum(['bakong', 'aba', 'stripe_card']),
  expiryTimestamp: z.string().datetime(),
  refreshInterval: z.number().default(300), // seconds
  instructions: z.string(),
});

export const PaymentStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
  paymentMethod: z.string(),
  amountUsd: z.number(),
  amountKhr: z.number(),
  timestamp: z.string().datetime(),
  retryable: z.boolean(),
  receiptUrl: z.string().url().optional(),
});

export const BookingConfirmedSchema = z.object({
  bookingRef: z.string(), // DLG-YYYY-NNNN
  bookingId: z.string(),
  qrCheckInUrl: z.string().url(),
  qrCheckInData: z.string(),
  itemName: z.string(),
  itemType: z.enum(['trip', 'hotel', 'transport', 'guide']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  guests: z.number(),
  totalAmountUsd: z.number(),
  totalAmountKhr: z.number(),
  downloads: z.array(z.object({
    label: z.string(),
    url: z.string().url(),
    type: z.enum(['pdf', 'ical', 'qr']),
  })),
});

export const BudgetCategorySchema = z.object({
  name: z.string(),
  minUsd: z.number(),
  maxUsd: z.number(),
  minKhr: z.number(),
  maxKhr: z.number(),
  description: z.string(),
});

export const BudgetEstimateSchema = z.object({
  categories: z.array(BudgetCategorySchema),
  totalMinUsd: z.number(),
  totalMaxUsd: z.number(),
  totalMinKhr: z.number(),
  totalMaxKhr: z.number(),
  durationDays: z.number(),
  guests: z.number(),
});

export const WeatherDaySchema = z.object({
  date: z.string().datetime(),
  tempHighC: z.number(),
  tempLowC: z.number(),
  condition: z.enum(['sunny', 'cloudy', 'rainy', 'stormy', 'hot', 'humid']),
  precipitationChance: z.number().min(0).max(100),
  humidity: z.number().min(0).max(100),
});

export const WeatherSchema = z.object({
  location: z.string(),
  days: z.array(WeatherDaySchema).min(1),
});

export const ComparisonItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().url(),
  priceUsd: z.number(),
  priceKhr: z.number(),
  rating: z.number(),
  features: z.record(z.string(), z.boolean()),
});

export const ComparisonSchema = z.object({
  items: z.array(ComparisonItemSchema).min(2).max(3),
  highlightDifferences: z.boolean().default(true),
});

export const ImageGallerySchema = z.object({
  images: z.array(z.object({
    url: z.string().url(),
    caption: z.string(),
    location: z.string().optional(),
  })).min(1),
});

export const TextSummarySchema = z.object({
  title: z.string().optional(),
  paragraphs: z.array(z.string()),
  highlights: z.array(z.string()).optional(),
});

// ─── Registry ────────────────────────────────────────────────

export const CONTENT_REGISTRY = {
  trip_cards: { renderer: TripCardsRenderer, schema: TripCardsSchema },
  trip_detail: { renderer: TripDetailRenderer, schema: TripDetailSchema },
  hotel_cards: { renderer: HotelCardsRenderer, schema: HotelCardsSchema },
  hotel_detail: { renderer: HotelDetailRenderer, schema: HotelDetailSchema },
  transport_options: { renderer: TransportOptionsRenderer, schema: TransportOptionsSchema },
  map_view: { renderer: MapViewRenderer, schema: MapViewSchema },
  itinerary: { renderer: ItineraryRenderer, schema: ItinerarySchema },
  booking_summary: { renderer: BookingSummaryRenderer, schema: BookingSummarySchema },
  qr_payment: { renderer: QRPaymentRenderer, schema: QRPaymentSchema },
  payment_status: { renderer: PaymentStatusRenderer, schema: PaymentStatusSchema },
  booking_confirmed: { renderer: BookingConfirmedRenderer, schema: BookingConfirmedSchema },
  budget_estimate: { renderer: BudgetEstimateRenderer, schema: BudgetEstimateSchema },
  weather: { renderer: WeatherRenderer, schema: WeatherSchema },
  comparison: { renderer: ComparisonRenderer, schema: ComparisonSchema },
  image_gallery: { renderer: ImageGalleryRenderer, schema: ImageGallerySchema },
  text_summary: { renderer: TextSummaryRenderer, schema: TextSummarySchema },
} as const;

export type ContentType = keyof typeof CONTENT_REGISTRY;
```

### 4.3 Auto-Render Pipeline

```typescript
// lib/content-pipeline.ts

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
  const entry = CONTENT_REGISTRY[type as ContentType];
  if (!entry) {
    console.warn(`[ContentPipeline] Unknown content type: ${type}`);
    return {
      success: false,
      error: `Unknown content type: ${type}`,
    };
  }

  // 2. Validate data with Zod schema
  const validation = entry.schema.safeParse(data);
  if (!validation.success) {
    console.error(`[ContentPipeline] Validation failed for ${type}:`, validation.error);
    return {
      success: false,
      error: `Invalid data for ${type}: ${validation.error.message}`,
    };
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

---

## 5. State Management Architecture

### 5.1 Zustand Store: `vibeBookingStore`

Single store with slices. Only layout and last-50 messages persist to localStorage.

```typescript
// stores/vibe-booking.store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string; // Plain text summary
  type: 'text' | 'error';
  linkedContentId?: string; // Links to ContentItem.id
  timestamp: string;
}

interface ContentItem {
  id: string;
  type: ContentType;
  data: unknown; // Validated JSON data
  actions: ContentAction[];
  metadata: ContentMetadata;
  timestamp: string;
  dismissed: boolean;
  streaming: boolean;
}

interface ContentAction {
  type: string;
  label: string;
  payload: Record<string, unknown>;
  style?: 'primary' | 'secondary' | 'danger';
  icon?: string;
}

interface ContentMetadata {
  title?: string;
  subtitle?: string;
  icon?: string;
  backable?: boolean;
  shareable?: boolean;
  replace?: boolean;
}

interface LayoutConfig {
  dock: 'left' | 'right' | 'center' | 'floating';
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
}

type BookingState =
  | { status: 'idle' }
  | { status: 'holding'; bookingId: string; reservedUntil: string }
  | { status: 'paying'; bookingId: string; paymentIntentId: string }
  | { status: 'confirmed'; bookingId: string; bookingRef: string }
  | { status: 'failed'; bookingId: string; error: string };

// ─── Store ──────────────────────────────────────────────

interface VibeBookingState {
  // Chat slice (summary only)
  messages: ChatMessage[];
  isTyping: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  // Content slice (auto-rendered from JSON)
  contentItems: ContentItem[];
  activeContentId: string | null;
  isStreaming: boolean;

  // Layout slice
  layout: LayoutConfig;

  // Booking slice
  booking: BookingState;

  // Actions
  addMessage: (message: ChatMessage) => void;
  setTyping: (typing: boolean) => void;
  setConnectionStatus: (status: VibeBookingState['connectionStatus']) => void;

  addContentItem: (item: ContentItem) => void;
  updateContentItem: (id: string, updates: Partial<ContentItem>) => void;
  dismissContentItem: (id: string) => void;
  clearAllContent: () => void;
  setActiveContent: (id: string | null) => void;
  setStreaming: (streaming: boolean) => void;

  setLayout: (layout: Partial<LayoutConfig>) => void;
  resetLayout: () => void;
  toggleCollapsed: () => void;

  setBooking: (booking: BookingState) => void;
  clearBooking: () => void;
}

const DEFAULT_LAYOUT: LayoutConfig = {
  dock: 'right',
  x: 0,
  y: 0,
  width: 420,
  height: 0, // 0 = full viewport height
  collapsed: false,
};

export const useVibeBookingStore = create<VibeBookingState>()(
  persist(
    immer((set) => ({
      // Chat
      messages: [],
      isTyping: false,
      connectionStatus: 'disconnected',
      addMessage: (message) =>
        set((state) => {
          state.messages.push(message);
        }),
      setTyping: (typing) => set({ isTyping: typing }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),

      // Content
      contentItems: [],
      activeContentId: null,
      isStreaming: false,
      addContentItem: (item) =>
        set((state) => {
          // If item has replace=true, remove previous items of same type
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
      dismissContentItem: (id) =>
        set((state) => {
          const item = state.contentItems.find((i) => i.id === id);
          if (item) item.dismissed = true;
        }),
      clearAllContent: () =>
        set((state) => {
          state.contentItems = [];
          state.activeContentId = null;
        }),
      setActiveContent: (id) => set({ activeContentId: id }),
      setStreaming: (streaming) => set({ isStreaming: streaming }),

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
        contentItems: state.contentItems
          .filter((i) => !i.dismissed)
          .slice(-20),
      }),
    }
  )
);
```

---

## 6. WebSocket Protocol

### 6.1 Client → Server

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

### 6.2 Server → Client

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
  };
  timestamp: string;
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

### 6.3 Message Router

```typescript
// hooks/useContentRouter.ts

export function useContentRouter() {
  const {
    addMessage,
    setTyping,
    addContentItem,
    setStreaming,
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
        addMessage({
          id: generateId(),
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
            timestamp: wsMessage.timestamp,
            dismissed: false,
            streaming: false,
          });

          // Link chat message to content
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
          },
          actions: [],
          metadata: { title: 'Payment Status', replace: true },
          timestamp: wsMessage.timestamp,
          dismissed: false,
          streaming: false,
        });
        break;
      }

      case 'booking_hold_expiry': {
        // Update booking state — UI reacts automatically
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
  }, [addMessage, setTyping, addContentItem, setStreaming, setBooking]);
}
```

---

## 7. Cambodia-Specific Content Models

### 7.1 Province Enum

All location-based content uses the 25 Cambodia provinces:

```typescript
type CambodiaProvince =
  | 'Phnom Penh'
  | 'Siem Reap'
  | 'Sihanoukville'
  | 'Kampot'
  | 'Kep'
  | 'Battambang'
  | 'Kampong Cham'
  | 'Kampong Thom'
  | 'Kratie'
  | 'Mondulkiri'
  | 'Ratanakiri'
  | 'Koh Kong'
  | 'Preah Vihear'
  | 'Kampong Speu'
  | 'Takeo'
  | 'Svay Rieng'
  | 'Prey Veng'
  | 'Kandal'
  | 'Banteay Meanchey'
  | 'Pailin'
  | 'Oddar Meanchey'
  | 'Tbong Khmum'
  | 'Kampong Chhnang'
  | 'Pursat'
  | 'Stung Treng';
```

### 7.2 Transport Types (Cambodia-Specific)

```typescript
type CambodiaTransport =
  | 'tuk_tuk'      // Motorcycle with cabin
  | 'remork'       // Trailer pulled by motorcycle (tuk-tuk variant)
  | 'van'          // Shared or private van
  | 'bus'          // Inter-city bus (Giant Ibis, Mekong Express)
  | 'private_car'  // Car with driver
  | 'boat';        // Tonle Sap or Mekong river boat
```

### 7.3 Currency Display

All prices display dual currency:

```typescript
interface CambodiaPrice {
  usd: number;        // Primary — all international tourists understand USD
  khr: number;        // Secondary — for local context
  cny?: number;       // Tertiary — for Chinese tourists
}

// Display format
function formatPrice(price: CambodiaPrice, locale: 'EN' | 'ZH' | 'KM'): string {
  switch (locale) {
    case 'EN': return `$${price.usd.toFixed(2)} (៛${price.khr.toLocaleString()})`;
    case 'ZH': return `$${price.usd.toFixed(2)} (៛${price.khr.toLocaleString()})`;
    case 'KM': return `៛${price.khr.toLocaleString()} ($${price.usd.toFixed(2)})`;
  }
}
```

### 7.4 Seasonal Context

The AI should consider Cambodia's seasons when suggesting trips:

| Season | Months | Characteristics | Best For |
|--------|--------|-----------------|----------|
| **Cool-Dry** | Nov–Feb | 20–30°C, low humidity, no rain | Temple tours, trekking, all activities |
| **Hot-Dry** | Mar–May | 30–40°C, very hot | Beach trips, early morning temple visits |
| **Wet** | Jun–Oct | 25–32°C, daily afternoon rain | Fewer crowds, lush landscapes, lower prices |

---

## 8. Action Handling System

When a user clicks an action button in rendered content, the action is sent back to the AI agent via WebSocket. The AI processes the action and responds with new content.

```
User clicks "Book This Tour" button in TripCardsRenderer
        │
        ▼
ContentItem calls onAction({ type: 'book_trip', payload: { tripId: '...' } })
        │
        ▼
useContentRouter sends user_action WebSocket message
        │
        ▼
AI Agent receives action → calls create_booking_hold tool → sends requires_payment message to frontend
        │
        ▼
AI Agent sends new agent_message with content_payload.type = 'booking_summary'
        │
        ▼
Content Stage auto-renders BookingSummaryRenderer
Chat Panel shows: "Great! I've prepared your booking. Please review the details."
```

---

## 9. File Structure

```
frontend/
├── app/
│   └── (app)/
│       └── vibe-booking/
│           └── page.tsx                    # Main split-screen page
├── components/
│   └── vibe-booking/
│       ├── layout/
│       │   ├── SplitScreenLayout.tsx       # Root layout
│       │   ├── ChatPanel.tsx               # Chat container (summary only)
│       │   ├── ContentStage.tsx            # Primary content viewport
│       │   ├── ContentHistory.tsx          # Scrollable content list
│       │   └── ContentItem.tsx             # Wrapper with animation, dismiss
│       │
│       ├── chat/
│       │   ├── ChatHeader.tsx              # Drag handle, status, controls
│       │   ├── MessageList.tsx             # Scrollable messages
│       │   ├── ChatMessage.tsx             # Text-only message bubble
│       │   ├── TypingIndicator.tsx         # Pulsing dots
│       │   └── ChatInput.tsx               # Text input
│       │
│       ├── renderers/                      # JSON-driven auto-renderers
│       │   ├── TripCards.tsx               # Trip grid with Cambodia data
│       │   ├── TripDetail.tsx              # Full trip itinerary
│       │   ├── HotelCards.tsx              # Hotel listings
│       │   ├── HotelDetail.tsx             # Room details
│       │   ├── TransportOptions.tsx        # Tuk-tuk/van/bus comparison
│       │   ├── MapView.tsx                 # Leaflet map with Cambodia tiles
│       │   ├── Itinerary.tsx               # Day-by-day timeline
│       │   ├── BookingSummary.tsx          # Price breakdown + confirm
│       │   ├── QRPayment.tsx               # Bakong/ABA QR code
│       │   ├── BookingConfirmed.tsx        # DLG-YYYY-NNNN + QR
│       │   ├── PaymentStatus.tsx           # Status badge
│       │   ├── BudgetEstimate.tsx          # Cost chart USD/KHR
│       │   ├── Weather.tsx                 # Cambodia forecast
│       │   ├── Comparison.tsx              # Side-by-side comparison
│       │   ├── ImageGallery.tsx            # Photo gallery
│       │   └── TextSummary.tsx             # Fallback text
│       │
│       ├── shared/
│       │   ├── ContentPlaceholder.tsx      # Welcome state
│       │   ├── StreamingIndicator.tsx      # "Finding..." pulsing state
│       │   ├── ContentError.tsx            # Error fallback
│       │   ├── PriceDisplay.tsx            # USD/KHR dual currency
│       │   └── ActionButton.tsx            # Consistent action buttons
│       │
│       └── booking/
│           ├── BookingSummaryCard.tsx
│           ├── PriceBreakdown.tsx
│           ├── PaymentCountdown.tsx
│           └── BookingConfirmedCard.tsx
│
├── hooks/
│   ├── useDraggableResizable.ts            # Drag/resize with RAF
│   ├── useWebSocket.ts                     # WebSocket + reconnect
│   ├── useContentRouter.ts                 # Route WS messages to stores
│   ├── useContentRenderer.ts               # Map type → renderer
│   └── useBooking.ts                       # React Query hooks
│
├── stores/
│   └── vibe-booking.store.ts               # Zustand (chat + content + layout + booking)
│
├── lib/
│   ├── vibe-booking/
│   │   ├── content-registry.ts             # Renderer + schema registry
│   │   ├── content-pipeline.ts             # Auto-render pipeline
│   │   ├── content-validator.ts            # Zod validation wrapper
│   │   ├── layout-storage.ts               # localStorage layout persistence
│   │   ├── message-parser.ts               # WebSocket message parser
│   │   └── cambodia-data.ts                # Province enum, transport types, seasons
│   └── api.ts                              # Axios client
│
└── types/
    └── vibe-booking.ts                     # Shared TypeScript interfaces
```

---

## 10. Performance Architecture

### 10.1 Lazy Loading Strategy

All content renderers are lazy-loaded to minimize initial bundle size:

```typescript
// renderers are lazy-loaded in content-registry.ts
const TripCardsRenderer = lazy(() => import('./renderers/TripCards'));
const MapViewRenderer = lazy(() => import('./renderers/MapView'));
// ... etc
```

**Bundle budget:**
| Chunk | Size Target |
|-------|-------------|
| Core (layout + chat) | < 100KB |
| Per renderer | < 30KB each |
| Map (Leaflet) | < 80KB (loaded on first map view) |
| Total initial | < 200KB |

### 10.2 Virtual Scrolling

Content History uses virtual scrolling when items exceed 20:

```typescript
// Using @tanstack/react-virtual
const virtualizer = useVirtualizer({
  count: contentItems.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 400, // Average content item height
  overscan: 3,
});
```

### 10.3 Image Optimization

All images use Next.js Image component with:
- `loading="lazy"`
- `placeholder="blur"` where available
- Responsive `sizes` attribute
- WebP format with JPEG fallback

---

## 11. Security Architecture

### 11.1 XSS Prevention

```typescript
// All AI-generated content is JSON, not HTML
// Renderers construct JSX from JSON data
// If AI sends HTML in text fields, sanitize before render:

import DOMPurify from 'dompurify';

function SanitizedText({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
  });
  return <span dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

### 11.2 Content Validation

Every content payload is validated with Zod before rendering:

```typescript
// In ContentItem.tsx
const result = createContentRenderer(type, data, itemId, onAction);
if (!result.success) {
  return <ContentError message={result.error} />;
}
return result.component;
```

### 11.3 No Sensitive Data in Content JSON

- `bookingRef` format: `DLG-YYYY-NNNN` (not sensitive)
- `paymentIntentId` never sent to client in content JSON
- `userId` never exposed in content payloads
- JWT token only used for WebSocket auth, never in content

---

## 12. Error Handling

### 12.1 Per-Content Error Boundaries

Each ContentItem wraps its renderer in an error boundary:

```typescript
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

### 12.2 Zod Validation Errors

When AI sends malformed JSON:
1. Log error to console (dev) / Sentry (prod)
2. Render `TextSummaryRenderer` with fallback text
3. Show inline error: "Content format error — showing text summary instead"

### 12.3 WebSocket Error Recovery

| Scenario | Behavior |
|----------|----------|
| Connection lost | Show "Reconnecting..." banner; queue messages |
| Reconnect success | Flush queued messages |
| Max retries exceeded | Show "Connection lost" with manual retry |
| Invalid message | Log warning; skip message |

---

## 13. Testing Strategy

### 13.1 Renderer Unit Tests

```typescript
// __tests__/renderers/TripCards.test.tsx
describe('TripCardsRenderer', () => {
  it('renders Cambodia trip cards from valid JSON', () => {
    const data = {
      trips: [{
        id: 'trip_angkor',
        name: 'Angkor Wat Tour',
        province: 'Siem Reap',
        priceUsd: 245,
        priceKhr: 998000,
        // ...
      }]
    };

    render(<TripCardsRenderer data={data} onAction={jest.fn()} itemId="test" />);

    expect(screen.getByText('Angkor Wat Tour')).toBeInTheDocument();
    expect(screen.getByText('$245.00')).toBeInTheDocument();
    expect(screen.getByText('Siem Reap')).toBeInTheDocument();
  });

  it('shows error fallback for invalid JSON', () => {
    const data = { trips: 'not-an-array' };
    render(<TripCardsRenderer data={data} onAction={jest.fn()} itemId="test" />);
    expect(screen.getByText(/invalid data/i)).toBeInTheDocument();
  });
});
```

### 13.2 Integration: Auto-Render Flow

```typescript
// __tests__/auto-render.test.tsx
describe('Auto-Render Flow', () => {
  it('renders trip cards automatically when agent_message arrives', async () => {
    const { container } = render(<VibeBookingPage />);

    // Simulate WebSocket message
    mockWebSocket.emit({
      type: 'agent_message',
      payload: {
        text: 'I found 2 tours!',
        content_payload: {
          type: 'trip_cards',
          data: { trips: [...] },
          actions: [],
          metadata: { title: 'Temple Tours' },
        },
      },
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="trip-cards"]')).toBeInTheDocument();
    });
  });
});
```

---

## 14. Document Relationships

| Document | Purpose |
|----------|---------|
| `system-design.md` | **This document** — JSON-driven auto-render architecture, ContentPayload protocol, renderer system |
| `requirements.md` | Functional requirements with acceptance criteria |
| `design.md` | Component design, data flow, file structure, conversation flows |
| `vibe_booking_researched.md` | Market research, competitive analysis, UX patterns |
| `../agentic-llm-chatbot/requirements.md` | AI agent backend requirements |
| `../frontend-nextjs-implementation/design.md` | Base app architecture |
| `../../product/prd.md` | Product requirements (F10–F16) |
| `../../product/feature-decisions.md` | Feature registry with priorities |

---

*This document is a living system design. Update it when the ContentPayload schema, renderer contracts, or auto-render pipeline change.*
