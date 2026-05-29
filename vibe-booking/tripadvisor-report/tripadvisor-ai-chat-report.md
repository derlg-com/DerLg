# TripAdvisor "Plan with AI" (Ollie) — Test Report

## How It Works

### Architecture Overview

TripAdvisor's AI chat feature is called **Ollie**. It lives as a persistent side panel (`complementary` ARIA role, "AI Chat Assistant") that overlays the main page without a full navigation.

**UI Rendering Flow:**
1. User clicks "Plan with AI" in the top nav → panel slides in from the right
2. URL hash updates to `#/chat/<uuid>` when a message is sent (each session gets a unique ID)
3. While the AI is generating, a "Gathering up the best recommendations..." loading text appears in the response area
4. The "Send message" button becomes "Cancel this message" during streaming
5. Once complete, the full response renders with:
   - Structured paragraphs with `<strong>` highlights
   - Follow-up suggestion buttons (3 pre-generated follow-ups)
   - A "Close results" toggle button
   - A "Scroll down" button if content overflows

**Key UI Patterns:**
- Streaming indicator: loading text replaced by streamed content chunks
- Follow-up suggestions auto-generated based on the response topic
- "Dates & travelers" context button at top of chat (lets user set trip context)
- Disclaimer: "AI-generated; may contain inaccuracies" with links to Terms, Privacy, and "How Ollie Works"
- Chat history accessible via "All chats" tab

---

## Test Cases

---

### Case 1 — "give me the trip in Cambodia"

**Prompt:** `give me the trip in Cambodia`

**Response Summary:**
Ollie returned a structured **7-day Cambodia itinerary** covering:
- Days 1–2: Phnom Penh — Royal Palace, National Museum
- Days 3–4: Siem Reap — Angkor Wat (sunrise), Bayon Temple, Angkor Archaeological Park
- Day 5: Optional detour — Bokor National Park (Kampot)
- Days 6–7: Koh Rong — Long Set Beach

**Top Pick highlighted:** Angkor Wat sunrise + unrushed second visit

**Follow-up suggestions rendered:**
1. "Show budget-friendly Cambodia trips under $1000"
2. "Find top-rated Cambodia beaches for families"
3. "Discover Cambodia tours with beachside accommodations"

**UI Rendering Observations:**
- Loading state: "Gathering up the best recommendations and tips for nature day trips (waterfalls, national park, viewpoints) in Kampot, Cambodia..." appeared first
- Response rendered as rich HTML: `<paragraph>`, `<strong>` tags, emoji bullets (🏆, 📍, 💡)
- 3 follow-up suggestion buttons auto-rendered below the response
- "Close results" toggle button appeared after completion
- "Scroll down" button appeared (content exceeded panel height)
- Send button re-disabled after response completed

**Status:** ✅ PASS — AI returned a complete, structured itinerary with rich UI rendering

---

### Case 2 — Follow-up suggestion: "Show budget-friendly Cambodia trips under $1000"

**Prompt:** Clicked auto-generated follow-up button from Case 1

**Response Summary:**
Ollie returned **3 budget trip options** (all under $1000/person excl. flights):
- Trip 1 (5–6 days): "Angkor Focus" — Siem Reap base, Angkor Thom + Ta Prohm
- Trip 2 (5–7 days): "Phnom Penh City + Culture" — cheapest option, walkable sights
- Trip 3 (7–9 days): "Temples + Island Finish" — Angkor + Koh Rong beach

**Top Pick highlighted:** Trip 1 (Angkor Focus) — highest "wow per dollar"

**New UI Pattern — Preference Filter Chips:**
After the response, Ollie rendered an interactive chip selector: "To narrow things down, pick up to 3 preferences that matter most to you." with 8 chips:
- Budget under $1000 / 5-9 days / Shared transport / Low-cost attractions
- Modern accommodation / Walkable city / Easy trips between sights / Beach nearby

**UI Rendering Observations:**
- Previous Case 1 response collapsed to a "Open results" toggle (conversation history preserved but folded)
- New response rendered in same rich paragraph + `<strong>` format
- **New element:** Interactive preference chip grid appeared below response (not present in Case 1)
- "Close results" toggle and "Scroll down" button appeared again
- Chat session UUID remained the same — same session, new turn

**Status:** ✅ PASS — Follow-up context maintained; new preference chip UI rendered correctly

---

### Case 3 — Preference chip selection: "Budget under $1000" → Submit

**Prompt:** Selected "Budget under $1000" chip then clicked Submit  
Auto-generated prompt sent: `"Recommend me more with these preferences: Budget under $1000"`

**Response Summary:**
Ollie triggered a completely different UI mode — a **split-panel results view** with real TripAdvisor listings. Returned 4 specific places in Phnom Penh:

Hotels:
- **Mad Monkey Phnom Penh** — 4.5★ (2,296 reviews), from $12/night. Social hostel, clean rooms.
- **Onederz Phnom Penh** — 4.2★ (111 reviews), from $20/night. Rooftop pool, comfort on a budget.

Restaurants:
- **Kabbas Restaurant** — 4.5★ (1,012 reviews), Asian/Healthy, $. Khmer staples under $10 for two.
- **Davids Noodle** — 4.4★ (1,270 reviews), Asian/Cambodian, $. Travelers' Choice 2025 Winner.

**New UI Pattern — Split Results Panel:**
A second panel (`e1530`) appeared alongside the chat panel with:
- Heading: `Results for "more with these preferences: budget under $1000"`
- Left column: listing cards with photos, star ratings, review counts, prices, AI-written summaries, real user review quotes, "Ask about this place" button, "Check availability"/"Menu" links
- Right column: **Mapbox interactive map** with pins for each result
- "Compare my options" button at top
- "Expand map" button
- "Was this helpful? Yes/No" feedback widget at bottom
- Each listing card links back to TripAdvisor detail pages with `#/active-chat/<uuid>` appended (preserves chat session on navigation)

**Key Observation — Context Preservation in Links:**
All listing URLs include `#/active-chat/019e636f-57f2-79ac-9d39-3325ab6cc874` — the chat session UUID is appended so the AI panel reopens on the destination page.

**Status:** ✅ PASS — Preference chip triggered a full results panel with real listings, map, and review data

---

### Summary: How the UI Auto-Renders When AI Responds

| Trigger | UI Component Rendered |
|---|---|
| Open "Plan with AI" | Side panel slides in (chat input + disclaimer) |
| Send free-text message | Loading text → streamed paragraphs with `<strong>` highlights + emoji bullets |
| Response completes | 3 follow-up suggestion buttons + "Close results" toggle + "Scroll down" button |
| Click follow-up suggestion | New turn in same session; previous response collapses to toggle |
| Response includes options | Preference chip grid appears below response with Submit button |
| Select chip + Submit | Entire second panel opens: listing cards (photos, ratings, prices, AI summaries, real quotes) + Mapbox map |
| Click listing link | Navigates to TripAdvisor detail page with chat session UUID preserved in URL hash |

**Streaming mechanism:** The loading text (e.g. "Gathering up the best recommendations...") is a placeholder that gets replaced by the actual streamed response. The "Send" button becomes "Cancel" during generation and re-disables after completion. The URL hash updates to `#/chat/<uuid>` on first send, then stays stable for the session.

---

*Report generated: 2026-05-26*
*Tested on: https://www.tripadvisor.com*
