# Requirements Document: DerLg AI Split-Screen Interface

## Introduction

This document specifies the requirements for the DerLg AI Split-Screen Interface — a draggable, resizable conversational AI panel that occupies the left portion of the screen by default, with a dynamic content display area on the right. Users chat with the AI agent to plan trips, view real locations on maps, compare hotels and transportation, and complete bookings entirely through natural language. The right-side content panel renders rich interactive components (maps, trip cards, payment QR codes, booking confirmations) based on AI tool calls.

The AI agent backend is the existing Python FastAPI service (specified in `agentic-llm-chatbot/`). This document focuses on the **frontend interface architecture** and **agent-backend communication protocol** required to support the split-screen experience.

## Glossary

- **ChatPanel** — The draggable, resizable left-side chat interface containing message history and input
- **ContentPanel** — The right-side display area that renders rich content (maps, cards, comparisons)
- **SplitScreenLayout** — The root layout component managing panel sizes, positions, and responsive behavior
- **ContentPayload** — Structured data sent from AI agent to frontend describing what to render in ContentPanel
- **AgentMessage** — WebSocket message from AI agent containing text summary + optional content payload
- **ToolResultView** — A specific content type rendered in ContentPanel (map, hotel_list, trip_comparison, etc.)
- **PanelMode** — Enum: `split` (both panels visible), `chat_focus` (chat expanded), `content_focus` (content expanded)
- **DragHandle** — UI element for repositioning ChatPanel on screen
- **ResizeHandle** — UI element for adjusting ChatPanel dimensions
- **BookingFlow** — End-to-end conversation state: discovery → suggestion → exploration → customization → booking → payment → confirmation

## Requirements

### Requirement 1: Split-Screen Layout Architecture

**User Story:** As a traveler, I want a chat interface that doesn't block my view of trip content, so that I can reference information while chatting with the AI.

#### Acceptance Criteria

1. THE SplitScreenLayout SHALL render ChatPanel on the left side by default, occupying 35% of viewport width
2. THE SplitScreenLayout SHALL render ContentPanel on the right side, occupying remaining 65% of viewport width
3. THE ChatPanel SHALL have a minimum width of 320px and maximum width of 60% of viewport width
4. THE ContentPanel SHALL have a minimum width of 40% of viewport width
5. WHEN viewport width is less than 768px, THE SplitScreenLayout SHALL switch to stacked layout (ChatPanel full-width overlay, collapsible)
6. THE SplitScreenLayout SHALL persist panel width preference in localStorage
7. THE SplitScreenLayout SHALL restore panel width from localStorage on page load
8. THE SplitScreenLayout SHALL animate panel width changes with 200ms ease transition
9. THE ContentPanel SHALL display a default welcome state when no content is active
10. THE default welcome state SHALL show featured trips, quick action buttons, and recent activity

### Requirement 2: Draggable ChatPanel

**User Story:** As a traveler, I want to move the chat panel anywhere on screen, so that it doesn't block content I want to see.

#### Acceptance Criteria

1. THE ChatPanel SHALL display a DragHandle in its header bar
2. WHEN user drags the DragHandle, THE ChatPanel SHALL become a floating window detached from the split layout
3. THE floating ChatPanel SHALL have a default size of 400px wide × 600px tall
4. THE floating ChatPanel SHALL have a minimum size of 320px × 400px
5. THE floating ChatPanel SHALL have a maximum size of 80% of viewport width × 80% of viewport height
6. THE floating ChatPanel SHALL remember its last position in localStorage
7. WHEN page reloads, THE floating ChatPanel SHALL restore to its last position
8. THE floating ChatPanel SHALL have a "Dock" button to return to split layout
9. THE floating ChatPanel SHALL have a "Maximize" button to enter chat_focus mode
10. WHEN user clicks outside floating ChatPanel, THE ChatPanel SHALL NOT close (persistent mode)
11. THE floating ChatPanel SHALL have a subtle drop shadow and border to indicate floating state
12. THE floating ChatPanel SHALL have rounded corners (16px border-radius)

### Requirement 3: Resizable Panels

**User Story:** As a traveler, I want to resize the chat and content panels, so that I can give more space to whatever I'm focusing on.

#### Acceptance Criteria

1. THE ChatPanel (in split mode) SHALL have a ResizeHandle on its right edge
2. WHEN user drags the ResizeHandle, THE ChatPanel width SHALL adjust in real-time
3. WHEN user drags the ResizeHandle, THE ContentPanel width SHALL adjust inversely
4. THE resize operation SHALL have a visual indicator (cursor change to col-resize)
5. THE floating ChatPanel SHALL have resize handles on all four corners and edges
6. WHEN resizing floating ChatPanel, THE aspect ratio SHALL NOT be constrained
7. THE resize operation SHALL respect minimum and maximum size constraints
8. WHEN user double-clicks the ResizeHandle, THE ChatPanel SHALL reset to default width (35%)
9. THE panel sizes SHALL be saved to localStorage 500ms after resize ends (debounced)
10. THE ContentPanel SHALL support a "fullscreen" button that temporarily hides ChatPanel

### Requirement 4: Panel Mode States

**User Story:** As a traveler, I want to focus on either the chat or the content, so that I can see more detail when needed.

#### Acceptance Criteria

1. THE system SHALL define three PanelMode states: `split`, `chat_focus`, `content_focus`
2. WHEN in `split` mode, BOTH ChatPanel and ContentPanel SHALL be visible side-by-side
3. WHEN in `chat_focus` mode, THE ChatPanel SHALL occupy 85% of viewport width
4. WHEN in `chat_focus` mode, THE ContentPanel SHALL collapse to 15% showing only content type icons
5. WHEN in `content_focus` mode, THE ContentPanel SHALL occupy 90% of viewport width
6. WHEN in `content_focus` mode, THE ChatPanel SHALL collapse to a floating bubble (64px × 64px)
7. WHEN user clicks the floating bubble, THE system SHALL return to `split` mode
8. EACH panel SHALL have a mode toggle button in its header
9. WHEN mode changes, THE transition SHALL animate over 300ms with cubic-bezier easing
10. THE current PanelMode SHALL persist in localStorage and restore on reload

### Requirement 5: ContentPanel Rendering System

**User Story:** As a traveler, I want to see rich content (maps, hotels, trips) displayed clearly, so that I can explore options visually.

#### Acceptance Criteria

1. THE ContentPanel SHALL render different views based on ContentPayload type from AI agent
2. THE ContentPanel SHALL support these view types:
   - `welcome` — Default state with featured trips
   - `map` — Interactive Google Map with location markers
   - `trip_list` — Grid of trip cards with images and pricing
   - `trip_detail` — Full trip itinerary with day-by-day breakdown
   - `hotel_list` — Hotel comparison grid with filters
   - `hotel_detail` — Single hotel with rooms, amenities, photos
   - `transport_list` — Vehicle options with pricing tiers
   - `trip_comparison` — Side-by-side trip comparison table
   - `booking_summary` — Price breakdown with discounts
   - `payment_qr` — QR code display with countdown timer
   - `payment_status` — Payment confirmation or pending state
   - `booking_confirmation` — Confirmed booking with reference number
   - `itinerary` — Day-by-day schedule with times and locations
   - `budget_estimate` — Cost breakdown chart
   - `weather_forecast` — Weather cards for travel dates
3. WHEN ContentPayload type changes, THE ContentPanel SHALL transition with a 150ms fade animation
4. THE ContentPanel SHALL display a loading skeleton while waiting for tool results
5. THE ContentPanel SHALL cache previously rendered views for instant back-navigation
6. THE ContentPanel SHALL support a "back" button to return to previous view
7. THE ContentPanel SHALL support a "share" button for shareable views (trip_detail, itinerary)
8. THE ContentPanel header SHALL display the current view title and content type icon

### Requirement 6: Map Integration View

**User Story:** As a traveler, I want to see real locations on a map, so that I can understand where trips, hotels, and attractions are located.

#### Acceptance Criteria

1. WHEN AI agent calls a location-related tool, THE ContentPanel SHALL render `map` view
2. THE map view SHALL use Google Maps JavaScript API (or OpenStreetMap + Leaflet as fallback)
3. THE map SHALL display markers for all relevant locations (trip stops, hotels, attractions)
4. WHEN user clicks a marker, THE map SHALL show an info card with name, image, and brief description
5. THE map SHALL support zoom in/out, pan, and street view where available
6. THE map SHALL display a route line when trip itinerary includes multiple locations
7. THE map SHALL cluster nearby markers when zoomed out
8. THE map SHALL display user's current location if geolocation permission is granted
9. THE map SHALL support satellite and terrain view toggles
10. THE map markers SHALL use DerLg brand colors and custom icons per category (temple, hotel, restaurant, etc.)

### Requirement 7: Trip Card and List Views

**User Story:** As a traveler, I want to browse trip options visually, so that I can compare and select the best one.

#### Acceptance Criteria

1. WHEN AI agent returns trip suggestions, THE ContentPanel SHALL render `trip_list` view
2. EACH trip card SHALL display: hero image, title, duration, price, rating, and highlights
3. THE trip list SHALL support grid layout (3 columns on desktop, 2 on tablet, 1 on mobile)
4. WHEN user hovers over a trip card, THE card SHALL elevate with shadow and show quick-action buttons
5. THE quick-action buttons SHALL include: "View Details", "Compare", "Save to Favorites"
6. WHEN user clicks "Compare", THE trip SHALL be added to comparison tray (max 3 trips)
7. WHEN comparison tray has 2+ trips, THE ContentPanel SHALL render `trip_comparison` view
8. THE comparison view SHALL show trips side-by-side with: images, prices, durations, inclusions, ratings
9. THE comparison view SHALL highlight differences (e.g., best price, longest duration)
10. WHEN user clicks a trip card, THE ContentPanel SHALL render `trip_detail` view
11. THE trip detail view SHALL show: image gallery, description, day-by-day itinerary, inclusions/exclusions, reviews, cancellation policy
12. THE trip detail view SHALL have a "Book This Trip" button that triggers AI booking flow

### Requirement 8: Hotel and Transport Views

**User Story:** As a traveler, I want to see hotel and transportation options with details, so that I can choose what's right for me.

#### Acceptance Criteria

1. WHEN AI agent returns hotel results, THE ContentPanel SHALL render `hotel_list` view
2. THE hotel list SHALL display: image, name, star rating, price per night, amenities, distance from center
3. THE hotel list SHALL support filters: price range, star rating, amenities, guest rating
4. WHEN user clicks a hotel, THE ContentPanel SHALL render `hotel_detail` view
5. THE hotel detail view SHALL show: image gallery, room types with pricing, amenities list, map location, reviews
6. EACH room card SHALL have a "Select Room" button that adds it to the booking
7. WHEN AI agent returns transport options, THE ContentPanel SHALL render `transport_list` view
8. THE transport list SHALL show: vehicle type, capacity, price, features, driver info
9. THE transport list SHALL categorize by: tuk-tuk, van, bus, private car
10. EACH transport option SHALL have a "Select" button that adds it to the booking

### Requirement 9: Booking and Payment Views

**User Story:** As a traveler, I want to see my booking summary and pay securely, so that I can confirm my reservation.

#### Acceptance Criteria

1. WHEN AI agent creates a booking, THE ContentPanel SHALL render `booking_summary` view
2. THE booking summary SHALL show: trip/hotel/transport details, travel dates, guest count, price breakdown
3. THE price breakdown SHALL include: subtotal, discounts (student, loyalty, promo), total
4. THE booking summary SHALL have a 15-minute countdown timer showing reservation hold time
5. WHEN user proceeds to payment, THE ContentPanel SHALL render `payment_qr` view
6. THE payment QR view SHALL display: QR code image, amount, payment method options, expiry countdown
7. THE payment QR view SHALL auto-refresh QR code every 5 minutes if not paid
8. WHEN payment is confirmed, THE ContentPanel SHALL render `booking_confirmation` view
9. THE booking confirmation SHALL show: booking reference (DLG-YYYY-NNNN), QR check-in code, itinerary summary, download buttons (PDF, iCal)
10. THE booking confirmation SHALL have a "Share" button for social sharing and messaging
11. WHEN payment is pending, THE ContentPanel SHALL show `payment_status` view with refresh button
12. THE payment status view SHALL poll backend every 5 seconds for status updates

### Requirement 10: AI Agent Message Protocol

**User Story:** As a developer, I want a structured message format between AI agent and frontend, so that the UI knows what content to render.

#### Acceptance Criteria

1. THE AI agent SHALL send messages via WebSocket in structured JSON format
2. EACH agent message SHALL contain:
   ```json
   {
     "type": "agent_message",
     "session_id": "uuid",
     "text": "Human-readable summary for chat panel",
     "content_payload": {
       "type": "trip_list|map|hotel_list|booking_summary|payment_qr|...",
       "data": {},
       "actions": []
     },
     "state": "DISCOVERY|SUGGESTION|EXPLORATION|CUSTOMIZATION|BOOKING|PAYMENT|POST_BOOKING",
     "timestamp": "2026-05-10T10:00:00Z"
   }
   ```
3. THE `text` field SHALL contain a concise summary shown in the chat panel
4. THE `content_payload` field SHALL be optional — when absent, ContentPanel shows previous view
5. THE `content_payload.data` field SHALL contain type-specific data (e.g., array of trips for `trip_list`)
6. THE `content_payload.actions` field SHALL contain interactive actions the user can take:
   ```json
   {
     "actions": [
       { "type": "select_trip", "label": "Book This Trip", "trip_id": "uuid" },
       { "type": "view_map", "label": "View on Map", "location": {"lat": 13.36, "lng": 103.86} },
       { "type": "compare", "label": "Add to Compare", "trip_id": "uuid" },
       { "type": "pay_now", "label": "Pay Now", "booking_id": "uuid" }
     ]
   }
   ```
7. WHEN user clicks an action button, THE frontend SHALL send action event via WebSocket:
   ```json
   { "type": "user_action", "action": "select_trip", "payload": {"trip_id": "uuid"} }
   ```
8. THE AI agent SHALL handle user_action messages and respond with updated content_payload
9. WHEN content_payload type is `map`, THE data SHALL include: center coordinates, zoom level, markers array
10. WHEN content_payload type is `trip_list`, THE data SHALL include: trips array, total count, pagination info
11. THE frontend SHALL validate content_payload schema before rendering
12. WHEN content_payload is invalid, THE frontend SHALL show error state and log to console

### Requirement 11: ChatPanel Message Interface

**User Story:** As a traveler, I want a natural chat experience with the AI, so that I can ask questions and get helpful responses.

#### Acceptance Criteria

1. THE ChatPanel SHALL display message history in a scrollable container
2. EACH user message SHALL align to the right with user avatar
3. EACH agent message SHALL align to the left with DerLg logo avatar
4. WHEN agent is processing, THE ChatPanel SHALL show a typing indicator (animated dots)
5. THE ChatPanel SHALL support rich text rendering: bold, italic, links, bullet lists
6. THE ChatPanel SHALL auto-scroll to latest message when new messages arrive
7. THE ChatPanel SHALL have a scroll-to-bottom button when user scrolls up
8. THE ChatPanel input SHALL support: text entry, emoji picker, file attachment (images for reviews)
9. WHEN user presses Enter, THE ChatPanel SHALL send the message
10. WHEN user presses Shift+Enter, THE ChatPanel SHALL insert a new line
11. THE ChatPanel SHALL show message timestamps on hover
12. THE ChatPanel SHALL support message retry if sending fails
13. THE ChatPanel SHALL display connection status indicator (connected, connecting, disconnected)
14. WHEN disconnected, THE ChatPanel SHALL show a reconnect button and queue messages

### Requirement 12: ContentPanel ↔ ChatPanel Synchronization

**User Story:** As a traveler, I want the chat and content to stay in sync, so that when I click something in the content, the AI knows about it.

#### Acceptance Criteria

1. WHEN user clicks a trip card in ContentPanel, THE ChatPanel SHALL add a system message: "User selected: [Trip Name]"
2. WHEN user clicks "Book This Trip" in ContentPanel, THE ChatPanel SHALL show booking confirmation prompt
3. WHEN user clicks a map marker, THE ChatPanel SHALL show location info in chat
4. WHEN user applies filters in ContentPanel, THE ChatPanel SHALL NOT auto-message (silent update)
5. WHEN user clicks "Compare" in ContentPanel, THE ChatPanel SHALL show comparison summary
6. WHEN booking state changes (e.g., payment confirmed), BOTH panels SHALL update simultaneously
7. WHEN ContentPanel shows payment QR, THE ChatPanel SHALL show payment instructions and status
8. WHEN user sends a message in ChatPanel, THE ContentPanel SHALL show loading state until tool results arrive
9. THE ChatPanel SHALL highlight messages that triggered current ContentPanel view
10. WHEN user clicks a message in ChatPanel that had a content_payload, THE ContentPanel SHALL restore that view

### Requirement 13: Responsive Behavior

**User Story:** As a traveler, I want the interface to work on any device, so that I can plan trips on my phone, tablet, or laptop.

#### Acceptance Criteria

1. ON desktop (>1024px), THE layout SHALL use split-screen with draggable/resizable panels
2. ON tablet (768px–1024px), THE layout SHALL use split-screen with fixed 40/60 ratio
3. ON mobile (<768px), THE layout SHALL show ContentPanel full-screen with ChatPanel as bottom sheet
4. ON mobile, THE bottom sheet SHALL have drag handle to expand/collapse
5. ON mobile, THE bottom sheet SHALL have three states: collapsed (80px), half-expanded (50%), full-expanded (90%)
6. WHEN mobile bottom sheet is collapsed, THE ChatPanel SHALL show only latest message preview
7. WHEN mobile bottom sheet is half-expanded, THE ChatPanel SHALL show last 3 messages
8. WHEN mobile bottom sheet is full-expanded, THE ChatPanel SHALL show full message history
9. THE mobile layout SHALL support swipe gestures to switch between ContentPanel views
10. THE floating ChatPanel (desktop) SHALL become a fixed bottom sheet on mobile

### Requirement 14: Accessibility

**User Story:** As a traveler with disabilities, I want the interface to be accessible, so that I can use it with screen readers and keyboard navigation.

#### Acceptance Criteria

1. ALL interactive elements SHALL have visible focus indicators
2. THE ChatPanel SHALL be navigable with keyboard (Tab, Shift+Tab, Enter)
3. THE ResizeHandle SHALL be reachable via keyboard and adjustable with arrow keys
4. THE DragHandle SHALL support keyboard-based repositioning (arrow keys + Enter to drop)
5. ALL images SHALL have alt text
6. ALL color combinations SHALL meet WCAG AA contrast ratios (4.5:1)
7. THE ChatPanel SHALL announce new messages to screen readers (aria-live="polite")
8. THE ContentPanel SHALL announce view changes to screen readers (aria-live="assertive")
9. THE interface SHALL support high contrast mode
10. THE interface SHALL support reduced motion preference (disable animations)

### Requirement 15: Performance

**User Story:** As a traveler, I want the interface to be fast and smooth, so that I don't get frustrated waiting.

#### Acceptance Criteria

1. THE initial page load SHALL complete within 2 seconds (Largest Contentful Paint)
2. THE ChatPanel message history SHALL virtualize (render only visible messages)
3. THE ContentPanel SHALL lazy-load heavy components (map, image gallery)
4. THE map tiles SHALL cache in browser for offline use
5. THE trip/hotel images SHALL use lazy loading with blur placeholder
6. THE WebSocket connection SHALL establish within 1 second
7. THE AI response SHALL display typing indicator within 500ms of user message
8. THE ContentPanel view transitions SHALL complete within 150ms
9. THE panel resize operations SHALL maintain 60fps
10. THE interface SHALL support concurrent rendering of ChatPanel and ContentPanel without blocking

### Requirement 16: State Management

**User Story:** As a traveler, I want my chat history and panel preferences to persist, so that I don't lose my progress when I refresh.

#### Acceptance Criteria

1. THE frontend SHALL persist chat message history in localStorage (last 50 messages)
2. THE frontend SHALL persist panel mode, width, position in localStorage
3. THE frontend SHALL persist ContentPanel view history (last 10 views) in localStorage
4. THE frontend SHALL persist comparison tray items in localStorage
5. WHEN page reloads, THE frontend SHALL restore chat history from localStorage
6. WHEN page reloads, THE frontend SHALL restore panel layout from localStorage
7. WHEN page reloads, THE frontend SHALL restore last ContentPanel view from localStorage
8. THE frontend SHALL sync localStorage state with server session on reconnection
9. THE frontend SHALL clear localStorage chat history when user logs out
10. THE frontend SHALL NOT persist sensitive data (payment info, passwords) in localStorage

### Requirement 17: Error Handling

**User Story:** As a traveler, I want clear feedback when something goes wrong, so that I know what to do next.

#### Acceptance Criteria

1. WHEN WebSocket disconnects, THE ChatPanel SHALL show offline banner with reconnect button
2. WHEN AI agent returns error, THE ChatPanel SHALL show error message with retry option
3. WHEN ContentPanel fails to render, THE ContentPanel SHALL show error fallback with retry
4. WHEN map fails to load, THE ContentPanel SHALL show static map image fallback
5. WHEN images fail to load, THE ContentPanel SHALL show placeholder with error icon
6. WHEN payment status check fails, THE ContentPanel SHALL show manual refresh button
7. ALL errors SHALL be logged to Sentry with context (session_id, view_type, error details)
8. WHEN rate limit is exceeded, THE ChatPanel SHALL show cooldown timer
9. WHEN backend is unavailable, THE ChatPanel SHALL show maintenance message
10. WHEN user action fails, THE ChatPanel SHALL show inline error with undo option

### Requirement 18: Analytics

**User Story:** As a product owner, I want to track how users interact with the AI interface, so that I can improve the experience.

#### Acceptance Criteria

1. THE frontend SHALL track: panel mode changes, resize events, drag events
2. THE frontend SHALL track: ContentPanel view changes, time spent per view
3. THE frontend SHALL track: action button clicks (select_trip, compare, book, pay)
4. THE frontend SHALL track: map interactions (zoom, pan, marker clicks)
5. THE frontend SHALL track: chat message count, average response time
6. THE frontend SHALL track: booking funnel (discovery → suggestion → booking → payment)
7. THE frontend SHALL track: error occurrences and recovery rates
8. THE frontend SHALL track: device type, viewport size, panel configuration
9. ALL analytics SHALL be anonymized (no PII, no booking references)
10. THE frontend SHALL respect user cookie consent preferences for analytics

---

## Document Relationships

| Document | Purpose |
|----------|---------|
| `requirements.md` | **This document** — functional requirements for split-screen AI interface |
| `design.md` | Architecture, component design, data flow, wireframes |
| `../agentic-llm-chatbot/requirements.md` | AI agent backend requirements (tool calls, WebSocket protocol) |
| `../frontend-nextjs-implementation/design.md` | Frontend app architecture, state management, API client |
| `../../docs/product/prd.md` | Product requirements (F10–F16: AI Travel Concierge) |

---

*This document is a living document. Update it whenever feature scope, priority, or acceptance criteria change.*
