# TripAdvisor "Ollie" AI Chat — Deep Research Report

**Date:** 2026-05-26
**Tested URL:** https://www.tripadvisor.com
**Feature name:** "Plan with AI" / internally called **Ollie** (agent provider: `OLLIE_GPT_4_1`)
**Relevance:** Direct reference for DerLg Vibe Booking auto-render system

---

## Methodology

I tested the feature in a real browser via Playwright, captured the GraphQL traffic, parsed every poll response, and reverse-engineered the content-block schema. Each test case below was run as an independent chat session (new `chatId`).

---

## Architecture Overview

### Network Pattern: GraphQL Polling (not WebSocket)

TripAdvisor uses **GraphQL POST + polling**, not WebSocket streaming. Every operation goes to a single endpoint:

```
POST https://www.tripadvisor.com/data/graphql/ids
```

Requests are batched (multiple operations per HTTP request) and identified by `preRegisteredQueryId` rather than sending raw GraphQL strings — a persisted-query optimization.

### Three Core Operations

| Operation | preRegisteredQueryId | Purpose |
|-----------|---------------------|---------|
| `PlanMode_sendMessage` | `3b00fac012d863cc` | Submit user message, get assistant `messageId` |
| `messages` (poll) | `e6d4861c34afa2cd` | Poll assistant message for accumulating content |
| `userTrackingService__addEvents` | `71a4406fb83d70a3` | Telemetry (AITA team) |

### Lifecycle

```
1. Click Send
   └─> sendMessage mutation
       └─> Returns: { chatId, status: PENDING, newMessages: [user, assistant] }
                                                                ↑ assistant.content = null

2. Polling begins (every ~500ms)
   └─> messages query with assistant.messageId
       └─> Returns growing content[] array

3. Each poll, content[] grows:
   - Phase A: progress blocks ("Thinking..." → tool-call status texts)
   - Phase B: progress blocks replaced by markdown + locations + reviews
   - Phase C: status flips PENDING → COMPLETE → polling stops
```

The `agentProvider` field in the `sendMessage` response explicitly states: **`OLLIE_GPT_4_1`** (GPT-4.1 backed).

---

## The Core Schema: `PlanMode_InterleavedContent`

Every visible piece of an assistant response is one of these blocks:

```typescript
type PlanModeInterleavedContent = {
  __typename: "PlanMode_InterleavedContent";
  blockId: string | null;                    // Unique per block
  contentType: "progress" | "markdown" | "locations" | "place_attributes" | "reviews";
  recommendationBlockId: string | null;      // Groups blocks belonging to one card
  text: string | null;                       // Markdown text or JSON-encoded array
  queriesWithSources: { ... } | null;        // Place/review payload for cards
  sources: { ... } | null;
  link: { ... } | null;
  detectedIntent: string | null;
  tableBlockId: string | null;
  metadata: object | null;
  type: "InterleavedContent";
};
```

The frontend's job is to **walk the content array, group by `recommendationBlockId`, and pick a renderer per `contentType`**. There is no HTML, no JSX, no CSS in the payload.

---

## Test Case 1 — General Question

**Prompt:** `What are the best things to do in Siem Reap, Cambodia?`
**ChatId:** `019e6357-977a-7f41-bc8a-48a0e64282e0`
**Final block count:** 35

### Send-Message Request
```json
{
  "message": "What are the best things to do in Siem Reap, Cambodia?",
  "messageSourceType": "USER_ENTERED",
  "currency": "USD",
  "page": { "pageName": "Home", "title": "Home", "url": "/" },
  "userLocalTime": "2026-05-26T08:12:25.093Z"
}
```

Note: `page` and `userLocalTime` are sent on every message — Ollie always knows where you are and what time it is locally.

### Progress Phase (Polls 1–N)
The `progress` blocks accumulate but UI shows only the latest:

```
"Thinking..."
→ "I'm going to pull up top Tripadvisor-backed experiences and attractions in Siem Reap..."
→ "Gathering up the best recommendations and tips for Angkor temples and sunrise experiences..."
→ "Gathering up the best recommendations and tips for best temples beyond Angkor Wat..."
→ "Gathering up the best recommendations and tips for floating village Tonle Sap sunset boat tour..."
→ "Gathering up the best recommendations and tips for Khmer cooking class..."
→ "Gathering up the best recommendations and tips for Phare Cambodian Circus show..."
```

Each progress text reveals a **tool-call query** the agent ran. This is leaked planning — useful for our team to study. The pattern is: one user question → one planner intent → 5–6 parallel sub-tool queries.

### Final Content Structure

```
[0–6]   progress    × 7   (status ticker frames)
[7–8]   markdown    × 2   (intro + framing line, no rec_id)
[9–13]  REC GROUP 1: Angkor Wat Sunrise Tour
          locations → place_attributes → markdown × 2 → reviews
[14–18] REC GROUP 2: Ta Prohm
[19–23] REC GROUP 3: Bayon Temple
[24–28] REC GROUP 4: Tonlé Sap Floating Village
[29–33] REC GROUP 5: Phare Cambodian Circus
[34]    markdown          (summary with 🏆 top pick + 📍 alternatives + 💡 tip)
```

**Pattern:** `intro → 5× (card + 2 prose paragraphs about it) → summary.`

### Follow-Up Affordance: Preference Pills
Below the response the UI rendered eight chips derived from `place_attributes`:

```
[Sunrise viewing] [Jungle ruins] [Floating village] [Evening show]
[Intricate carvings] [Atmospheric ruins] [Water reflections] [Cultural experience]
```

Selecting a chip + Submit fires a follow-up message with `messageSourceType: "PREFERENCE_PILL"`:

```json
{
  "message": "Recommend me more with these preferences: Sunrise viewing",
  "chatId": "019e6357-...",
  "messageSourceType": "PREFERENCE_PILL",
  "actionContext": {
    "actionType": "PREFERENCE_PILL",
    "preferencePillsContext": { "selectedPreferences": ["Sunrise viewing"] }
  }
}
```

**Important:** The chip text becomes part of the natural-language message. Ollie does not consume `selectedPreferences` as structured input — it re-reads it from the message string. The structured field exists for telemetry only.

---

## Test Case 2 — Trip Planning ("give me a trip to Cambodia")

**Prompt:** `give me a trip to Cambodia`
**ChatId:** `019e6363-3460-7cd9-9370-0fac6dbf7591`
**Final block count:** 21

This case is **fundamentally different** from Case 1. Same surface (chat panel + cards + summary), but the agent picked a different planner and different output structure.

### Progress Phase — Different Tool Plan
```
"Thinking..."
→ "I'll pull a quick set of top Cambodia picks (temples, city highlights, beaches/islands, and food)
   so I can stitch them into one tight 7–10 day plan..."
→ "Gathering up the best recommendations and tips for must-see temples and cultural sights in Siem Reap..."
→ "Gathering up the best recommendations and tips for best things to do and landmarks in Phnom Penh..."
→ "Gathering up the best recommendations and tips for best beaches and island things to do in Koh Rong..."
→ "Gathering up the best recommendations and tips for best restaurants and local Khmer food in Phnom Penh..."
→ "HOTELS_SUPERSET"   ← raw internal tool name, not localized for the user
```

Two notable differences from Case 1:
1. The planner stage explicitly states the output shape it intends to produce: *"stitch them into one tight 7–10 day plan."* That changes how the rest of the response is laid out.
2. One progress entry leaked a raw internal tool identifier — **`HOTELS_SUPERSET`** — instead of a friendly status string. This is a UI bug; the localization fallback didn't fire. It's also a clue that the agent has at least one tool that returns hotel inventory pre-bundled by region.

### Final Content Structure — Day-Based, Not Card-Based

```
[0–6]   progress    × 7
[7]     markdown          intro: "Here's a tight, classic 8-day Cambodia loop..."
[8–10]  DAY GROUP 1: Days 1–3 Siem Reap
          markdown (header) → markdown (detail) → locations
[11–13] DAY GROUP 2: Days 4–5 Phnom Penh
          markdown (header) → markdown (detail) → locations
[14–16] DAY GROUP 3: Days 6–8 Koh Rong
          markdown (header) → markdown (detail) → locations
[17–19] FOOD GROUP: Khmer food picks
          markdown × 2 → locations
[20]    markdown          summary with 🏆 / 📍 / 💡
```

**Pattern shift compared to Case 1:**

| | Case 1 ("things to do") | Case 2 ("give me a trip") |
|--|--|--|
| Group key | per-attraction | per-day-range |
| Group order | `locations → attributes → markdown × 2 → reviews` | `markdown × 2 → locations` |
| `place_attributes` | present on every group | **absent everywhere** |
| `reviews` blocks | present on every group | **absent everywhere** |
| Card count | 5 | 4 (3 day-groups + 1 food group) |
| Itinerary structure | implicit (a list) | explicit (Days 1–3, 4–5, 6–8) |

The agent **changes its own block schema** based on the detected intent. "Trip" triggers an itinerary planner that omits attributes/reviews and uses markdown headers as day labels. "Best things to do" triggers a recommendation planner that emits cards with full review snippets.

Yet **the renderers don't change** — the frontend handles both layouts because the contract is just "render what's in the array, in order, grouping by `recommendationBlockId`."

### Follow-Up Suggestions Were Different Too
After Case 2, the UI offered:
- *"Add a budget limit for accommodations in Cambodia"*
- *"Find top-rated activities for families in Siem Reap"*
- *"Search for beachfront resorts with private villas"*

These are full sentences (not preference pills). They click as `USER_ENTERED` follow-ups. So the UI has **two follow-up modes**:
- **Preference pills** — short attribute tags, sent with `messageSourceType: "PREFERENCE_PILL"`
- **Suggestion buttons** — full prompt sentences, sent as normal `USER_ENTERED` messages

The agent decides which mode to attach based on the response type.

### Side-Effect Calls
While the assistant message was building, the client also fired side-load queries for each location:

```
{ locationId: 13947201, locale: "en-US" }    // location detail enrichment
{ attractions: [{ locationId: 317907, ... }] } // attraction product/price counts
```

These run in parallel with polling — the chat doesn't wait for them. Photos, cancellation policies, and pricing arrive as they arrive, and re-render the cards in place.

---

## Cross-Case Findings

### 1. The "Progress Ticker" Is a Tool-Call Trace
Each progress block corresponds to a tool the agent ran. This is the agent's plan, made visible. For DerLg, this means:
- Stream the **tool name** (or a friendly label for it) the moment a tool starts.
- Replace, don't append — the user only needs to see the latest action.
- Localize before sending. TripAdvisor's `HOTELS_SUPERSET` leak is a small but real UX bug we should not copy.

### 2. The Same Card Schema Fits Both Layouts
Both itinerary days and standalone recommendations use the same `locations` block. The frontend never branched on intent — it just rendered the array. **Auto-render means: one schema, many layouts, layout is implicit in ordering.**

### 3. `recommendationBlockId` Is the Glue
This is the only thing tying a place card to its surrounding prose. Without it, you'd have a flat stream of disconnected blocks. With it, the renderer can box-group prose + photo + tags into one cohesive card.

For DerLg's `content_payload`, the equivalent is: every payload object should carry a stable group ID so the chat panel can wrap it with the right surrounding text.

### 4. Photo URLs Use Templates
```
https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1b/c5/c8/5d/caption.jpg?w={width}&h={height}&s=1
```

The client picks the size based on the rendered card. We should adopt the same pattern: backend returns a template, frontend fills `{width}`/`{height}`. Saves bandwidth and keeps the API agnostic to layout.

### 5. Heavy A/B Testing Surface
Each `sendMessage` request is co-batched with experiment evaluations:
- `plan_mode_text_only_vs_gpt_1773701346` — fallback to text-only mode
- `user_context_messages_in_plan_mode_chat_1778166785` — context injection
- `plan_mode__multiple_photo_cards_1776342661` — multi-photo card layout
- `plan_mode__create_place_attribute_labels_for_pois_1775825805` — auto-attribute generation
- `plan_mode__auto_expand_ugc_snippets_1774352979` — review auto-expand
- `plan_mode__show_contextual_tips_during_thinking_1774116082` — tips during loading
- `ai_travel_assistant___internal_alpha_feedback_1747759102` — internal alpha feedback

This implies the entire feature is treated as a continuously-experimented surface, not a static product. We should plan for the same: feature flags on (a) tool selection, (b) card layout, (c) preference pill generation, (d) summary block formatting.

### 6. Telemetry Is Per-Card
Every card impression and click fires a `userTrackingService__addEvents` mutation with:
- `team: "AITA"` (AI Travel Assistant team)
- `item_type: "aitaLocationCard"` / `"aitaSourcesCta"` / `"aitaMessagesPanel"`
- `item_group: <chatId>`
- `external_key: <messageId>`
- `viewType: "LIST"` or `"MAP"`

We need an equivalent surface to evaluate Vibe Booking quality. Without per-card impressions and clicks, we can't tell which content_payload types convert.

### 7. Two Unrelated Behaviors That Surprised Me
- **URL hash routing for chat sessions.** `/#/chat/<uuid>` lets users back-button between chats without a full page reload. The chat panel is a separate SPA layer over the main page.
- **The send button doubles as cancel.** While the assistant message is `PENDING`, the same button shows a stop icon and cancels in-flight polling. We should mirror this — a separate cancel button is a wasted slot.

---

## Implications for DerLg Vibe Booking

### Adopt
1. **Block-level `content_payload` schema.** Every chunk of agent output is a typed block. The renderer chooses the component.
2. **Group ID per recommendation.** Carry a stable ID across the markdown, card, and review blocks of a single suggestion so the chat panel can wrap them visually.
3. **Progress ticker tied to tool calls.** Stream localized tool labels, replace-in-place, never queue.
4. **Two follow-up modes:** short preference chips (after card-style responses) and full-sentence suggestions (after itinerary responses). Mode is chosen by the agent, not the UI.
5. **Photo URL templates** with `{width}`/`{height}` placeholders.
6. **Per-card telemetry** with `chatId`, `messageId`, content type, and view mode.
7. **Cancel-via-send-button** during streaming.

### Improve On
1. **Use WebSocket, not polling.** Our agent already pushes; no reason to copy their polling overhead.
2. **Localize every progress label before it leaves the agent.** No `HOTELS_SUPERSET`-style leaks.
3. **Validate every block with Zod before rendering.** TripAdvisor crashes silently on malformed blocks; ours should fall back to a `ContentError` component.
4. **Render itinerary days as a dedicated `itinerary` content type** instead of overloading `markdown` headers. Cleaner mobile rendering, easier to extract a structured trip object for booking.

---

## Answer to Your Side Question

> *"What is the first thing you need to do when I prompt 'give me a trip to Cambodia'?"*

The first thing is **call the trip-search tool against the backend** — `searchTrips({ country: "Cambodia" })` or the equivalent — before producing any text. The agent has no business writing prose about Cambodian itineraries until it knows what trips/places/hotels we actually have for that country. Everything else (intro paragraph, day breakdown, summary) is downstream of that tool result.

If the tool returns nothing, the second action is to fall back to `searchPlaces` to surface attractions we can scaffold a trip around. Only after the data arrives does the agent write a single character of response text.
