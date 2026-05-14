# DerLg Frontend — Agent Development Guide

> **Scope:** This guide governs the `frontend/` directory — the Next.js PWA that travelers use to discover, book, and manage Cambodia trips.
>
> **Before you start:** Read the root `@/AGENTS.md` for high-level architecture and global conventions. Then read the relevant spec directories for implementation tasks:
> - `.kiro/specs/frontend-nextjs-implementation/` — core frontend build tasks
> - `.kiro/specs/vibe-booking-frontend/` — Vibe Booking UI, chat interface, auto-render system

---

## Technology Stack

| Layer | Tech | Version | Purpose |
|-------|------|---------|---------|
| Framework | Next.js | 16.2.6 | App Router, SSR/SSG, PWA |
| Language | TypeScript | 5.x | `strict: true` |
| React | React | 19.2.4 | Server Components by default |
| Styling | Tailwind CSS | v4 | Utility-first + CSS variables |
| Fonts | Geist | via `next/font/google` | Body + display typography |
| State (client) | Zustand | latest | Auth, booking, chat, language stores |
| State (server) | React Query (TanStack Query) | latest | API caching, background refetch |
| Forms | React Hook Form + Zod | latest | Validation + type-safe forms |
| API Client | Axios | latest | HTTP with interceptors for auth refresh |
| WebSocket | Native WebSocket API | — | AI chat real-time connection |
| Maps | Leaflet.js + react-leaflet | latest | Offline map tiles, markers |
| i18n | next-intl | latest | EN / ZH / KM routing + translations |
| Icons | Lucide React | latest | Tree-shakeable icon set |
| Animations | Framer Motion | latest | Page transitions, AnimatePresence |
| PWA | next-pwa + Workbox | latest | Service worker, offline caching |
| Testing | Vitest + React Testing Library + Playwright | latest | Unit + E2E |
| Lint | ESLint 9 + `eslint-config-next` | — | Next.js recommended rules |

---

## Project Structure

```
frontend/
├── app/                           # Next.js App Router
│   ├── layout.tsx                 # Root layout: Geist fonts, providers, metadata
│   ├── globals.css                # Tailwind entry + CSS variables
│   ├── page.tsx                   # Landing / marketing page (SSR)
│   ├── (auth)/                    # Auth group (no main nav)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (main)/                    # Main app shell (with bottom nav)
│   │   ├── page.tsx               # Home screen
│   │   ├── explore/page.tsx       # Places, festivals, maps
│   │   ├── booking/page.tsx       # Booking flow
│   │   ├── my-trip/page.tsx       # Trip management
│   │   └── profile/page.tsx       # User profile
│   ├── vibe-booking/              # Vibe Booking split-screen page
│   │   └── page.tsx
│   └── api/                       # Next.js API routes (proxy, refresh token)
│       ├── auth/refresh/route.ts
│       └── health/route.ts
├── components/
│   ├── ui/                        # shadcn/ui base components (Button, Card, Dialog, etc.)
│   ├── shared/                    # Cross-feature reusable components
│   │   ├── BottomNav.tsx
│   │   ├── TopBar.tsx
│   ├── home/
│   ├── explore/
│   ├── booking/
│   ├── my-trip/
│   ├── profile/
│   └── vibe-booking/              # Vibe Booking-specific components
│       ├── SplitScreenLayout.tsx
│       ├── ChatPanel.tsx
│       ├── ContentStage.tsx
│       └── renderers/             # Auto-render content type components
│           ├── TripCardsRenderer.tsx
│           ├── HotelCardsRenderer.tsx
│           ├── MapViewRenderer.tsx
│           ├── QRPaymentRenderer.tsx
│           ├── BookingConfirmedRenderer.tsx
│           └── ...
├── lib/
│   ├── api-client.ts              # Axios instance with interceptors
│   ├── websocket.ts               # WebSocket manager (connect, reconnect, heartbeat)
│   ├── i18n.ts                    # next-intl config
│   ├── offline.ts                 # Service worker helpers, cache strategies
│   └── currency.ts                # Currency formatting + conversion helpers
├── stores/
│   ├── auth.store.ts              # Zustand: token, user, login/logout
│   ├── booking.store.ts           # Zustand: current booking, draft, hold timer
│   ├── chat.store.ts              # Zustand: messages, connection status
│   └── language.store.ts          # Zustand: locale (EN/ZH/KM)
├── hooks/
│   ├── useAuth.ts                 # Auth guard, token refresh
│   ├── useWebSocket.ts            # WebSocket hook with auto-reconnect
│   ├── useContentRouter.ts        # Routes AI message types to renderers
│   └── useBookingHold.ts          # 15-minute hold countdown + expiry handling
├── types/
│   ├── api.ts                     # Backend API response types
│   ├── booking.ts                 # Booking domain types
│   └── vibe-booking.ts            # AI message types, ContentPayload types
├── schemas/
│   └── vibe-booking.ts            # Zod schemas for AI message validation
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker (or generated by next-pwa)
│   └── locales/                   # Translation JSON files
│       ├── en.json
│       ├── zh.json
│       └── km.json
├── next.config.ts
├── tailwind.config.ts             # Theme extensions (if needed for v4)
├── tsconfig.json                  # strict: true, paths: {"@/*": ["./*"]}
├── package.json
└── middleware.ts                  # next-intl locale routing + auth route guards
```

---

## Next.js App Router Conventions

### Server Components by Default
- All pages and layout files are **Server Components** unless interactivity is required.
- Fetch data directly in Server Components using `fetch()` or React Query prefetches.
- Use `'use client'` only for:
  - Event handlers and browser APIs
  - Zustand store consumers
  - WebSocket connections
  - Leaflet maps
  - Forms with React Hook Form

### Route Groups
```
app/
├── (auth)/          # Login, register — NO main bottom navigation
├── (main)/          # Home, Explore, Booking, My Trip, Profile — WITH bottom nav
└── vibe-booking/    # Full-screen split-mode chat (separate layout)
```

### Data Fetching Patterns
```typescript
// Server Component: fetch on the server
export default async function HomePage() {
  const trips = await fetch(`${API_URL}/v1/trips/featured`, { next: { revalidate: 60 } });
  return <TripGrid trips={trips} />;
}

// Client Component: React Query for interactive data
function ExplorePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['places', filters],
    queryFn: () => apiClient.get('/v1/places', { params: filters }),
  });
}
```

---

## Styling & Design System

### Tailwind CSS v4
- Tailwind v4 is already configured. Use utility classes; avoid custom CSS when possible.
- The design system uses **CSS variables** defined in `globals.css` for theming:
  ```css
  :root {
    --color-primary: #0f766e;
    --color-secondary: #f59e0b;
    --color-background: #ffffff;
    --color-surface: #f8fafc;
    --color-text: #1e293b;
    --color-text-muted: #64748b;
    --radius-sm: 0.375rem;
    --radius-md: 0.75rem;
    --radius-lg: 1rem;
  }
  ```

### Mobile-First PWA
- **Base viewport:** Mobile (`375px`–`428px` width).
- All layouts must work gracefully on mobile before tablet/desktop.
- Touch targets minimum `44px × 44px`.
- Bottom navigation on `(main)` routes for thumb accessibility.

### Component Rules
- Use `components/ui/` for shadcn/ui primitives (Button, Input, Dialog, etc.).
- Use `components/shared/` for cross-feature components (BottomNav, TopBar, LoadingSkeleton).
- Use feature-specific folders (`components/home/`, `components/explore/`) for single-use components.
- All components are **PascalCase** files: `TripCard.tsx`, `BookingForm.tsx`.

---

## State Management

### Zustand Stores
Keep stores small and focused:

```typescript
// stores/auth.store.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (tokens: TokenPair, user: User) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  login: (tokens, user) => set({ accessToken: tokens.accessToken, user, isAuthenticated: true }),
  logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
  setAccessToken: (token) => set({ accessToken: token }),
}));
```

### React Query (Server State)
- Use React Query for all backend data that needs caching, refetching, or invalidation.
- Query keys must be deterministic arrays: `['trips', 'featured']`, `['bookings', userId]`.
- Mutations should invalidate related queries on success.

---

## API Client Conventions

### Axios Instance (`lib/api-client.ts`)
```typescript
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: inject access token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // Call Next.js API route to refresh token (httpOnly cookie)
      const { data } = await axios.post('/api/auth/refresh');
      useAuthStore.getState().setAccessToken(data.accessToken);
      return apiClient(err.config); // retry original request
    }
    return Promise.reject(err);
  }
);
```

### Backend API Contract
- Base URL from env: `NEXT_PUBLIC_API_URL=http://localhost:3001`
- All endpoints prefixed with `/v1/`.
- Standard envelope: `{ success, data, message, error }`.
- Read `data` field for actual response payloads.

---

## Authentication Flow

### JWT + httpOnly Cookies
1. **Login/Register** → POST to `/v1/auth/login` (or `/register`).
2. **Backend response** → returns `{ accessToken }` + sets `refreshToken` in `httpOnly Secure SameSite=Strict` cookie.
3. **Frontend stores** `accessToken` in Zustand (`auth.store.ts`).
4. **Subsequent requests** → Axios interceptor adds `Authorization: Bearer <accessToken>`.
5. **Token expiry (401)** → Axios interceptor calls `/api/auth/refresh` Next.js route, which proxies to backend `/v1/auth/refresh` using the httpOnly cookie.
6. **Refresh failure** → clear auth state, redirect to `/login?returnUrl=`.

### Route Protection
- Use `middleware.ts` for locale routing and auth guards on protected routes.
- Client-side: `useAuth` hook checks `isAuthenticated` and redirects if needed.

---

## WebSocket — AI Chat

### Connection
```typescript
const ws = new WebSocket(`wss://${AI_HOST}/ws/${sessionId}`);
ws.onopen = () => ws.send(JSON.stringify({
  type: 'auth',
  user_id: user.id,
  preferred_language: locale, // 'EN' | 'ZH' | 'KM'
}));
```

### Message Types (Client → Server)
- `auth` — first message after connection
- `user_message` — text from traveler
- `user_action` — button clicks (e.g., `book_trip`)
- `location` — GPS coordinates `{ lat, lng }`

### Message Types (Server → Client)
- `typing_start` / `typing_end` — show/hide typing indicator
- `agent_message` — AI response with optional `content_payload` (triggers auto-render)
- `payment_status` — push notification of payment result
- `booking_hold_expiry` — countdown warning
- `error` — error message

### Reconnection Logic
- Automatic reconnect with exponential backoff (max 5 retries).
- On reconnect, re-send `auth` message.
- Persist `session_id` in `localStorage` so conversation survives page reload.

---

## Vibe Booking — Auto-Render System

### Core Principle
The AI agent sends **structured JSON**, not HTML/JSX. The frontend owns all rendering.

### ContentPayload Types
When `agent_message.content_payload` is present, `useContentRouter` maps `type` to a renderer:

| `type` | Renderer Component | Data Shape |
|--------|-------------------|------------|
| `trip_cards` | `TripCardsRenderer` | `{ trips: Trip[] }` |
| `hotel_cards` | `HotelCardsRenderer` | `{ hotels: Hotel[] }` |
| `transport_options` | `TransportOptionsRenderer` | `{ options: TransportOption[] }` |
| `itinerary` | `ItineraryRenderer` | `{ days: DayPlan[] }` |
| `map_view` | `MapViewRenderer` | `{ center: LatLng, markers: Marker[] }` |
| `budget_estimate` | `BudgetEstimateRenderer` | `{ breakdown: BudgetItem[], total: Money }` |
| `qr_payment` | `QRPaymentRenderer` | `{ qrUrl: string, amount: Money, expiry: string }` |
| `booking_confirmed` | `BookingConfirmedRenderer` | `{ bookingRef: string, qrCode: string, itinerary: TripSummary }` |
| `weather` | `WeatherRenderer` | `{ forecast: ForecastDay[] }` |
| `image_gallery` | `ImageGalleryRenderer` | `{ images: Image[] }` |
| `comparison` | `ComparisonRenderer` | `{ items: ComparableItem[] }` |
| `text_summary` | `TextSummaryRenderer` | `{ text: string }` |

### Validation
- Every `content_payload` is validated with **Zod** before rendering.
- Invalid payloads show a `ContentError` component with a retry button — never crash the UI.
- Each renderer is wrapped in an **Error Boundary**.

### Stream Mode
- Content appears on the **Content Stage** immediately when tool results arrive, even if the AI is still typing text.
- Show a `StreamingIndicator` (pulsing dot + localized text) while waiting for tool results.
- Content items stack vertically with `fade + translate-y` entrance animations.
- Each item has a dismiss button (X) with fade-out animation.

### Layout
- **Desktop (≥768px):** Two-pane split screen — Chat Panel (left, 420px default) + Content Stage (right, remaining width).
- **Mobile (<768px):** Single-pane overlay. Toggle between Chat and Content views.
- Chat Panel is **draggable, resizable, collapsible to Floating Bubble**.
- Panel position/size/dock persist in `localStorage` under `derlg:vibe-booking:layout`.

---

## i18n (next-intl)

### Supported Locales
| Locale | Code | Font Consideration |
|--------|------|-------------------|
| English | `en` | Default |
| Chinese (Simplified) | `zh` | Ensure Chinese font stack |
| Khmer | `km` | Ensure Khmer font stack + proper line height |

### File Structure
```
public/locales/
├── en.json
├── zh.json
└── km.json
```

### Usage
```typescript
// Server Component
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('HomePage');

// Client Component
import { useTranslations } from 'next-intl';
const t = useTranslations('HomePage');
```

### Routing
- `middleware.ts` handles locale prefixing: `/en/explore`, `/zh/explore`, `/km/explore`.
- Default locale (`en`) may be prefixless based on config.

---

## PWA & Offline

### Requirements
- Installable via browser "Add to Home Screen".
- Offline access to cached pages and map tiles.
- Service worker generated by `next-pwa` or custom `public/sw.js`.

### Caching Strategy
| Asset | Strategy |
|-------|----------|
| Static pages | Stale-while-revalidate |
| API responses (trips, places) | Network-first with cache fallback |
| Map tiles | Cache-first (max 500MB) |
| Images from MinIO | Cache-first |

### Offline Indicators
- Show a subtle "Offline mode" banner when `navigator.onLine === false`.
- Disable booking actions that require live payment processing.

---

## Environment Variables

Create `.env.local` in `frontend/` (gitignored). Required variables:

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_WS_URL=ws://localhost:8000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

**Rule:** Only prefix with `NEXT_PUBLIC_` if the variable is needed in the browser. Secrets (API keys for server-only usage) must NOT be prefixed.

---

## Build & Development Commands

Run all commands from the `frontend/` directory.

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on `http://localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |

---

## Testing Conventions

### Unit Tests (`*.test.tsx`)
- Use Vitest + React Testing Library.
- Colocate tests with components or in `__tests__/` folders.
- Mock API calls with MSW (Mock Service Worker).
- Mock Zustand stores for component isolation.

### E2E Tests (Playwright)
- Test critical user journeys: login → browse → book → pay.
- Test Vibe Booking flow: open chat → send message → verify content renders.
- Use separate test database or mock backend responses.

---

## Security Checklist

- [ ] No secrets in `NEXT_PUBLIC_` env vars unless intentionally public.
- [ ] `refreshToken` is NEVER stored in `localStorage` — only in `httpOnly` cookie via backend.
- [ ] All user input sanitized with DOMPurify before rendering (especially AI-generated text).
- [ ] Zod validation on all AI `content_payload` before rendering.
- [ ] `img` tags use `next/image` or validate `src` to prevent malicious URLs.
- [ ] CSP headers configured in `next.config.ts` or middleware.
- [ ] CORS is handled by backend; frontend does not need CORS configuration.

---

## Integration Points

### With Backend (NestJS)
- **Protocol:** HTTP REST (`/v1/*`)
- **Auth:** `Authorization: Bearer <access_token>`
- **Response format:** Standard envelope `{ success, data, message, error }`

### With AI Agent (Python)
- **Protocol:** WebSocket (`/ws/{session_id}`)
- **Auth:** JWT in WebSocket connection header + `auth` message with `user_id`
- **Message format:** JSON with `type` field

### With MinIO (Images)
- Frontend uploads directly to MinIO using **presigned URLs** from backend.
- Display images via `next/image` with MinIO endpoint as `src`.

---

## Where to Go Next

1. **Core Frontend Tasks & Specs:** `.kiro/specs/frontend-nextjs-implementation/tasks.md`
2. **Core Frontend Design:** `.kiro/specs/frontend-nextjs-implementation/design.md`
3. **Vibe Booking Frontend Tasks:** `.kiro/specs/vibe-booking-frontend/tasks.md`
4. **Vibe Booking Frontend Design:** `.kiro/specs/vibe-booking-frontend/design.md`
5. **Auto-Render System Design:** `.kiro/specs/vibe-booking-frontend/auto-render-system-design.md`
6. **Root Orchestrator:** `@/AGENTS.md`
7. **Backend Agent Guide:** `@backend/AGENTS.md`
