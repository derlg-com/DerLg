# Requirements Document: Vibe Booking Frontend — Stream Mode

## Introduction

This document specifies the requirements for the **Vibe Booking Frontend**, a next-generation conversational booking interface for DerLg. Unlike the standard full-screen chat drawer (Req 9 in `frontend-nextjs-implementation`), Vibe Booking operates in **Stream Mode**: a split-screen layout where an AI-powered chat panel on the left drives rich, interactive content on the right. Content (trip cards, hotels, maps, payment QR codes, booking confirmations) streams onto the Content Stage in real-time as the AI agent processes user intent and calls backend tools.

The user describes their travel needs in natural language; the AI curates and renders visual results on the right; the user books and pays without ever leaving the conversation loop.

**Target users:** International tourists, Chinese tourists (primary market), students, safety-conscious travelers.
**Languages:** English (EN), Chinese (ZH), Khmer (KM).

## Glossary

- **Chat Panel:** The draggable, resizable chat interface where the user converses with the AI agent.
- **Content Stage:** The right-side viewport that renders rich content (cards, maps, galleries, payment UIs) produced by AI tool calls.
- **Stream Mode:** The real-time behavior where content appears on the Content Stage as tool results arrive, not just at conversation end.
- **Floating Bubble:** The collapsed state of the Chat Panel — a circular button docked to a screen corner.
- **Dock Position:** Snapped alignment of the Chat Panel (`left`, `right`, `center`, `floating`).
- **Booking Hold:** A 15-minute reservation timer during which inventory is reserved pending payment.
- **AI Agent:** The Python FastAPI + LangGraph service communicating via WebSocket.
- **Tool Result:** Data returned by the AI agent after calling a backend tool (e.g., `search_trips`).
- **Content Item:** A single rendered unit on the Content Stage (e.g., one set of trip cards, one map view).
- **Message Type:** The `type` field in an AI response payload that determines which renderer to use (`trip_cards`, `hotel_cards`, `map_view`, etc.).

## Requirements

### Requirement 1: Split-Screen Layout Architecture

**User Story:** As a traveler, I want a two-pane booking interface so I can chat with the AI while simultaneously browsing rich trip content.

#### Acceptance Criteria

1. THE Frontend_App SHALL render a two-pane layout on desktop (viewport width >= 768px):
   - Left Pane (Chat Panel): default width 420px, contains the AI chat.
   - Right Pane (Content Stage): fills remaining width, renders rich content.
2. THE Chat Panel SHALL be collapsible to a Floating Bubble positioned at the bottom-right corner of the viewport.
3. WHEN the Floating Bubble is clicked, THE Chat Panel SHALL restore to its previous width, height, and position.
4. On mobile (viewport width < 768px), THE layout SHALL be single-pane:
   - Chat Panel overlays the full screen when open.
   - Content Stage is hidden behind the Chat Panel.
   - A toggle button switches between Chat view and Content view.
5. THE two-pane layout SHALL use CSS Flexbox or Grid with no layout shift (CLS < 0.1).
6. THE Content Stage SHALL have a minimum width of 400px; if viewport is too narrow, THE Chat Panel SHALL auto-collapse to Floating Bubble.
7. THE entire layout SHALL fill the viewport height (100vh) with no outer page scrolling.

### Requirement 2: Draggable and Resizable Chat Panel

**User Story:** As a traveler, I want to move and resize the chat window so it never blocks the content I am viewing.

#### Acceptance Criteria

1. THE Chat Panel SHALL be draggable by its header/title bar using mouse events (mousedown/mousemove/mouseup).
2. THE Chat Panel SHALL be draggable by its header using touch events (touchstart/touchmove/touchend) for tablet support.
3. THE Chat Panel SHALL be resizable via a drag handle on its bottom-right corner.
4. THE minimum dimensions SHALL be 320px width x 400px height.
5. THE maximum dimensions SHALL be 80% of viewport width x 90% of viewport height.
6. WHEN the Chat Panel is dragged within 40px of a screen edge (left, right, or top-center), it SHALL snap to a Dock Position.
7. Supported Dock Positions SHALL be: `left` (fills left half), `right` (fills right half), `center` (centered overlay), `floating` (free position).
8. Panel position (x, y) and size (width, height) and dock SHALL persist in `localStorage` under key `derlg:vibe-booking:layout`.
9. On page reload, THE Chat Panel SHALL restore to the saved position, size, and dock.
10. A "Reset Layout" button (in Chat Panel header menu) SHALL restore defaults: dock=`right`, width=420px, height=100vh.
11. Drag and resize operations SHALL be smooth (target 60fps) using `requestAnimationFrame` and CSS `transform` for position, not layout thrashing.
12. The drag handle SHALL be visually indicated (resize cursor icon) and accessible via keyboard (Shift + arrow keys).

### Requirement 3: Content Stage — Rich Content Rendering

**User Story:** As a traveler, I want to see beautiful, interactive content (trip photos, maps, hotels) when the AI finds options for me, not just text in a chat bubble.

#### Acceptance Criteria

1. THE Content Stage SHALL render content based on the AI response `type` field (Message Type).
2. THE Frontend_App SHALL support the following Message Types:
   - `trip_cards` — Grid of trip cards with image, title, price, duration, rating, quick-action buttons.
   - `hotel_cards` — Hotel listing cards with photo gallery preview, amenities list, price per night, map thumbnail.
   - `transport_options` — Comparison table of transportation modes (van, bus, tuk-tuk) with capacity, price tier, duration.
   - `itinerary` — Day-by-day timeline with time slots, activity descriptions, location names, meal indicators.
   - `map_view` — Interactive Leaflet.js map centered on a location with markers for places, hotels, or routes.
   - `budget_estimate` — Breakdown visualization (stacked bar or pie chart) showing accommodation, transport, meals, entry fees subtotals with min/max range in USD/KHR/CNY.
   - `qr_payment` — Large QR code image with payment amount, expiry countdown timer, and payment instructions.
   - `booking_confirmed` — Confirmation card with booking reference (`DLG-YYYY-NNNN`), large QR check-in code, itinerary summary, download receipt button, add-to-calendar button, share link button.
   - `weather` — Weather forecast widget with 5-day outlook, temperature highs/lows, precipitation chance.
   - `image_gallery` — Photo gallery grid with click-to-expand lightbox.
   - `comparison` — Side-by-side comparison table for up to 3 trips/hotels with checkmark/x feature matrix.
   - `text_summary` — Plain text summary block for when the AI has no structured data but wants to highlight key points on the Content Stage.
3. WHEN no content is active, THE Content Stage SHALL display a Placeholder State: a welcome message ("Ask me about your Cambodia trip!"), suggested prompt chips ("3-day temple tour", "Beach resort under $200"), or a carousel of featured trips.
4. Each Content Item SHALL transition in with a smooth animation (fade + translate-y, 300ms ease-out).
5. Each Content Item SHALL have a dismiss button (X icon) that removes it from the Content Stage with a fade-out animation.
6. Multiple Content Items SHALL stack vertically in a scrollable container within the Content Stage.
7. Each Content Item SHALL display a timestamp (relative time, e.g., "2 min ago") indicating when it was rendered.
8. Content data SHALL be validated with Zod schemas before rendering to prevent runtime errors from malformed AI responses.

### Requirement 4: Stream Mode — Real-Time Content Updates

**User Story:** As a traveler, I want to see content appear immediately as the AI finds it, so I don't wait for the entire response to finish.

#### Acceptance Criteria

1. WHEN the AI agent calls a tool (e.g., `search_trips`), THE Frontend_App SHALL display a Streaming Indicator on the Content Stage (pulsing dot + localized text: "Finding the best options...").
2. WHEN tool results arrive via WebSocket, THE Content Item SHALL appear on the Content Stage immediately, even if the AI is still composing its text response.
3. WHEN trip data streams in incrementally, trip cards SHALL render as soon as the first trip object is available, with subsequent trips appending to the grid.
4. WHEN hotel data is loading, THE Content Stage SHALL show skeleton loading placeholders (shimmer effect) that are replaced by actual cards when data arrives.
5. WHEN a `map_view` type is received, THE map SHALL auto-center on the bounding box of all markers or the primary location (e.g., Siem Reap city center).
6. THE Content Stage SHALL maintain a scrollable Content History of all rendered items, with newest items at the bottom by default.
7. A "Clear All" button in the Content Stage header SHALL dismiss all Content Items and return to Placeholder State.
8. THE Streaming Indicator SHALL auto-dismiss when the AI sends `typing_end` or a final response message.

### Requirement 5: Booking Through Chat (Closed Loop)

**User Story:** As a traveler, I want to book trips, hotels, and transport directly through the chat, with all details and confirmation visible on the right side.

#### Acceptance Criteria

1. WHEN the user says "book this" or clicks a "Book Now" action button in chat or on a Content Item, THE AI agent SHALL call the `create_booking_hold` tool to create a 15-minute `RESERVED` booking hold.
2. THE Content Stage SHALL display a Booking Summary Card showing:
   - Trip/hotel/transport name and thumbnail image.
   - Travel dates (check-in / check-out or start / end).
   - Number of guests.
   - Price breakdown: subtotal, taxes, discounts applied, loyalty points redeemed, total.
   - Cancellation policy text (e.g., "Free cancellation up to 7 days before").
3. A "Confirm Booking" button SHALL appear prominently on the Booking Summary Card.
4. WHEN the user clicks "Confirm Booking", THE AI agent SHALL send a `requires_payment` WebSocket message: `{ type: "requires_payment", booking_id, amount_usd, methods: ["stripe", "bakong"] }`. THE Frontend_App SHALL render the payment UI and transition booking state to `HOLDING`.
5. WHEN booking is in `HOLDING` state, THE Content Stage SHALL display a 15-minute countdown timer (Booking Hold) with text: "Your spot is held for [MM:SS]. Complete payment to confirm."
6. THE Content Stage SHALL then display Payment Options:
   - Stripe Card Form (card number, expiry, CVC) with 3D Secure support.
   - QR Code Payment (Bakong/ABA) with a large scannable QR image.
7. WHEN the user selects a payment method and submits, THE Frontend_App SHALL call the appropriate payment API and display a "Processing..." state.
8. THE Frontend_App SHALL subscribe to the SSE stream `GET /v1/events/payments` (Bearer JWT) to receive real-time payment status updates. After payment completes, THE Frontend_App SHALL send `{ type: "payment_completed", booking_id }` to the AI agent via WebSocket so the agent can resume the conversation with confirmation details.
9. WHEN payment succeeds, THE Content Stage SHALL transition to Booking Confirmed state showing:
   - Success animation (checkmark).
   - Booking reference number (`DLG-YYYY-NNNN`).
   - Large QR check-in code (scannable).
   - Itinerary summary.
   - "Download Receipt (PDF)" button.
   - "Add to Calendar (iCal)" button.
   - "Share Booking" button with copyable link.
10. WHEN payment fails, THE Content Stage SHALL show an error message with a "Retry Payment" button and a "Cancel Booking" button.
11. The chat SHALL display a brief text summary of the booking outcome (e.g., "Booking confirmed! Reference: DLG-2026-0042. Details are on the right →").
12. If the Booking Hold expires (15 minutes pass without payment), THE Content Stage SHALL show an expiry notice with a "Restart Booking" button.

### Requirement 6: Payment Status Tracking

**User Story:** As a traveler, I want to check whether my payment went through by simply asking the chat bot.

#### Acceptance Criteria

1. WHEN the user asks about payment status (e.g., "Is my payment done?", "Payment status?"), THE Frontend_App SHALL poll the SSE stream `GET /v1/events/payments` or call `GET /v1/bookings/{id}` for the latest status. The AI agent SHALL display a Payment Status Card on the Content Stage based on the current booking state.
2. THE Content Stage SHALL display a Payment Status Card showing:
   - Status badge with color:
     - `PENDING` — yellow badge with clock icon.
     - `SUCCEEDED` — green badge with checkmark icon.
     - `FAILED` — red badge with cross icon.
     - `CANCELLED` — gray badge with ban icon.
   - Payment method used (e.g., "Card ending in 4242", "Bakong QR").
   - Amount paid in user's preferred currency (USD/KHR/CNY).
   - Timestamp of last status update.
   - Receipt download button (visible only if status is `SUCCEEDED`).
3. IF status is `PENDING`, a "Refresh Status" button SHALL re-poll `GET /v1/bookings/{id}` and show a loading spinner.
4. IF status is `FAILED`, a "Retry Payment" button SHALL restart the payment flow from the Booking Summary Card.
5. IF status is `SUCCEEDED`, a "View Booking" button SHALL navigate to the My Trips page.
6. The chat SHALL summarize the status in one line (e.g., "Your payment of $189 is confirmed!").

### Requirement 7: Chat-Content Synchronization

**User Story:** As a traveler, I want the chat and the content on the right to feel connected — clicking one should interact with the other.

#### Acceptance Criteria

1. WHEN the user clicks a trip card on the Content Stage, THE chat SHALL either:
   - Auto-send a message: "Tell me more about [trip name]", OR
   - Open a detail overlay without sending a message (configurable).
2. WHEN the user clicks a hotel card on the Content Stage, THE chat SHALL show a quick info snippet about that hotel.
3. WHEN the user clicks a map marker, THE chat SHALL display a brief location description.
4. Each chat message that triggered a Content Item SHALL have a "Jump to Content" button (arrow icon) that scrolls the Content Stage to the corresponding item and highlights it briefly (pulse border animation).
5. WHEN the Content Stage scrolls to a specific item, the corresponding chat message SHALL be highlighted (background tint) for 2 seconds.
6. THE Chat Panel and Content Stage SHALL share a synchronized scroll context via a React Context provider.

### Requirement 8: Multi-Language Support

**User Story:** As a traveler, I want the entire Vibe Booking interface in my preferred language.

#### Acceptance Criteria

1. ALL Content Stage UI labels, buttons, placeholders, and helper text SHALL be translated via `next-intl`.
2. Supported languages SHALL be: English (EN), Chinese Simplified (ZH), Khmer (KM).
3. Content received from the AI (trip descriptions, hotel names, place names) SHALL be in the user's `preferred_language` as set in the WebSocket auth message and user profile.
4. The Placeholder State welcome message SHALL be localized: EN "Ask me about your Cambodia trip!", ZH "问我关于您的柬埔寨之旅！", KM "សួរខ្ញុំអំពីដំណើរកម្សាន្តរបស់អ្នកនៅកម្ពុជា!"
5. Khmer text SHALL render with proper font fallback (system Khmer fonts or Google Noto Sans Khmer) and correct line height.
6. Currency formatting SHALL be locale-aware: USD `$189.00`, KHR `៛189,000`, CNY `¥189`.
7. Date formats SHALL be locale-aware: EN `May 10, 2026`, ZH `2026年5月10日`, KM `១០ ឧសភា ២០២៦`.

### Requirement 9: Accessibility

**User Story:** As a traveler with disabilities, I want to use the Vibe Booking interface with keyboard and screen readers.

#### Acceptance Criteria

1. Drag operations SHALL be keyboard-accessible: Arrow keys move the panel by 10px; Shift + Arrow keys resize by 10px.
2. THE Chat Panel header SHALL have `role="dialog"` and `aria-label="AI Travel Assistant"` when floating.
3. THE resize handle SHALL have `aria-label="Resize chat panel"` and be focusable.
4. All Content Items SHALL have proper ARIA roles:
   - Trip/hotel cards: `role="article"` with `aria-label`.
   - Map: `role="application"` with `aria-label="Interactive map"`.
   - Buttons inside cards: visible focus rings and keyboard activation (Enter/Space).
5. Focus trapping SHALL work correctly when the Chat Panel is open in floating mode (Tab cycles within the panel).
6. `prefers-reduced-motion` SHALL disable all animations (transitions, pulsing dots, map fly-to) and use instant state changes.
7. Color contrast SHALL meet WCAG AA: 4.5:1 for normal text, 3:1 for large text and UI components.
8. Status badges (PENDING, SUCCEEDED, FAILED) SHALL not rely on color alone; they SHALL include text labels and icons.

### Requirement 10: Performance

**User Story:** As a traveler on a slow Cambodian mobile network, I want the Vibe Booking interface to load fast and feel smooth.

#### Acceptance Criteria

1. THE Content Stage SHALL use `React.memo` on all renderer components to prevent unnecessary re-renders.
2. WHEN Content History exceeds 50 items, THE Content Stage SHALL use virtual scrolling (e.g., `react-window` or native CSS containment) to maintain 60fps scroll performance.
3. Map tiles (Leaflet) SHALL lazy-load and use OpenStreetMap with offline fallback (`/offline-tiles/{z}/{x}/{y}.png`).
4. Images in trip/hotel cards SHALL use Next.js `<Image>` component with:
   - `loading="lazy"`
   - `placeholder="blur"` where available
   - Responsive `sizes` attribute
5. THE split-screen layout SHALL not cause Cumulative Layout Shift (CLS < 0.1) during initial load or content updates.
6. THE Chat Panel drag/resize SHALL not trigger React re-renders during the drag; state updates SHALL happen on mouseup/touchend only.
7. WebSocket messages SHALL be processed in a Web Worker or off-main-thread where possible to prevent jank during heavy content rendering.
8. THE initial page load for `/vibe-booking` SHALL complete in under 2 seconds on a simulated 3G connection (Lighthouse Performance > 90).

### Requirement 11: Error Handling and Resilience

**User Story:** As a traveler, I want the interface to handle errors gracefully without crashing or losing my context.

#### Acceptance Criteria

1. WHEN an AI response contains an unknown or unsupported `type`, THE Frontend_App SHALL display a fallback Text Summary instead of crashing.
2. WHEN a Content Item's Zod validation fails, THE Frontend_App SHALL log the error to console (development) or Sentry (production) and display an error card: "We couldn't display this content. Please try again."
3. WHEN the WebSocket disconnects, THE Chat Panel SHALL show a connection status banner: "Reconnecting..." with a retry countdown.
4. WHEN the WebSocket reconnects, THE Frontend_App SHALL re-send any queued messages and restore the conversation.
5. WHEN a payment API call fails (network error, timeout), THE Frontend_App SHALL show a retryable error message without clearing the payment form.
6. WHEN the Booking Hold is about to expire (< 2 minutes remaining), THE Content Stage SHALL pulse the countdown timer in amber and play a subtle notification sound (if enabled).
7. All errors SHALL be recoverable — the user SHALL never need to refresh the page to continue.

### Requirement 12: Security

**User Story:** As a developer, I want the Vibe Booking interface to be secure against common web vulnerabilities.

#### Acceptance Criteria

1. ALL user input into the chat SHALL be sanitized before rendering (XSS prevention) using DOMPurify or equivalent.
2. ALL AI-generated HTML content (if any) SHALL be sanitized before insertion into the DOM.
3. The `booking_ref` and `payment_intent_id` SHALL never be logged to the browser console or exposed in URLs.
4. WebSocket connections SHALL use `wss://` (TLS) in production.
5. Local storage keys SHALL be prefixed with `derlg:` to avoid collisions.
6. QR code images for payment SHALL include a short expiry watermark or overlay to prevent screenshot reuse.

---

## Document Relationships

| Document | Purpose |
|----------|---------|
| `requirements.md` | **This document** — functional requirements for the Vibe Booking Frontend |
| `design.md` | Technical design: component architecture, data flow, state management, file structure |
| `../vibe-booking/requirements.md` | AI Agent backend requirements (tool schemas, WebSocket protocol) |
| `../frontend-nextjs-implementation/requirements.md` | Base frontend requirements (auth, API, i18n, PWA) |
| `../../product/feature-decisions.md` | Canonical feature registry (F10–F16) |
| `../../platform/architecture/system-overview.md` | System architecture and service boundaries |

---

*Last updated: 2026-05-10. Update this file whenever feature scope, acceptance criteria, or Message Types change.*
