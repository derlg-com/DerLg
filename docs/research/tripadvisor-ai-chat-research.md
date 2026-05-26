# TripAdvisor "Ollie" AI Chat — Deep Research Report

**Date:** 2026-05-26  
**Tested URL:** https://www.tripadvisor.com  
**Feature name:** "Plan with AI" / internally called **Ollie** (agent provider: `OLLIE_GPT_4_1`)  
**Relevance:** Direct reference for DerLg Vibe Booking auto-render system

---

## 1. Entry Point & Layout

The AI chat is a **slide-in panel** anchored to the right side of the page. It does not navigate away — the main page stays visible behind it.

- Trigger: "Plan with AI" button in the top nav
- Panel label: `aria-label="AI Chat Assistant"`
- URL hash routing: `/#/chat/<uuid>` — each session gets a unique ID on first message
- Panel has three tabs: **All chats** | **AI Assistant** (current)
- Header actions: New chat, Share chat, Close

---

## 2. Network Architecture — GraphQL Polling

TripAdvisor uses **GraphQL over HTTPS with polling**, not WebSocket streaming.

### Step 1 — Send Message (Mutation)

**Request** (batched with A/B test queries):
```json
{
  "variables": {
    "message": "What are the best things to do in Siem Reap, Cambodia?",
    "messageSourceType": "USER_ENTERED",
    "currency": "USD",
    "page": { "pageName": "Home", "title": "Home", "url": "/" },
    "userLocalTime": "2026-05-26T08:12:25.093Z"
  },
  "extensions": { "preRegisteredQueryId": "3b00fac012d863cc" }
}
```

**Response** — returns immediately with two message IDs:
```json
{
  "sendMessageResponse": {
    "chatId": "019e6357-977a-7f41-bc8a-48a0e64282e0",
    "status": "PENDING",
    "agentProvider": "OLLIE_GPT_4_1",
    "newMessages": [
      { "messageId": "...", "status": "COMPLETE", "sender": "USER", ... },
      { "messageId": "...", "status": "PENDING", "sender": "ASSISTANT", "content": null }
    ]
  }
}
```

The assistant message starts with `content: null` and `status: PENDING`.

### Step 2 — Poll for Response

The client immediately begins polling with the assistant `messageId`:
```json
{
  "variables": { "messageId": "019e6357-977e-7344-86fe-9492b238df48", "currency": "USD" },
  "extensions": { "preRegisteredQueryId": "e6d4861c34afa2cd" }
}
```

Polling continues until `status` changes from `PENDING` to `COMPLETE`. Each poll response contains the **accumulated content blocks so far** — the array grows with each poll.

---

## 3. Content Block Schema — `PlanMode_InterleavedContent`

Every content item is a `PlanMode_InterleavedContent` object with these fields:

| Field | Type | Purpose |
|-------|------|---------|
| `blockId` | UUID | Unique ID for this block |
| `contentType` | string | Determines how to render (see below) |
| `recommendationBlockId` | UUID \| null | Groups blocks belonging to one recommendation |
| `text` | string \| null | Markdown text or JSON array |
| `queriesWithSources` | object \| null | Location/review data for cards |
| `sources` | object \| null | Additional source data |
| `link` | object \| null | CTA link |
| `metadata` | object \| null | Extra metadata |

### Content Types Observed

| `contentType` | Description | Rendered As |
|---------------|-------------|-------------|
| `progress` | Streaming status text | Animated status line (replaces previous) |
| `markdown` | AI prose with `**bold**` syntax | Parsed markdown paragraph |
| `locations` | Place card data (name, rating, photo, price, URL) | Clickable place card with thumbnail |
| `place_attributes` | JSON array of tags e.g. `["Sunrise", "Guided tour"]` | Tag chips on the card |
| `reviews` | Review snippets tied to a location | Quote cards under the place card |

---

## 4. Streaming Progress — How It Works

During the `PENDING` phase, each poll returns an **accumulating array** of `progress` blocks:

```
Poll 1: ["Thinking..."]
Poll 2: ["Thinking...", "I'm going to pull up top Tripadvisor-backed experiences..."]
Poll 3: [..., "Gathering up the best recommendations for Angkor temples..."]
Poll 4: [..., "Gathering up the best recommendations for best temples beyond Angkor Wat..."]
Poll 5: [..., "Gathering up the best recommendations for floating village Tonle Sap..."]
Poll 6: [..., "Gathering up the best recommendations for Khmer cooking class..."]
Poll 7: [..., "Gathering up the best recommendations for Phare Cambodian Circus..."]
```

The UI shows only the **latest** progress text — it replaces the previous one in-place. This creates the illusion of a live status ticker.

Once the AI finishes, `progress` blocks are replaced by the full `markdown` + `locations` + `reviews` content in the same array.

---

## 5. Recommendation Block Grouping

Each recommendation is a **group of 4 blocks** sharing the same `recommendationBlockId`:

```
recommendationBlockId: "6c47f4ee-..."
  ├── [locations]       → place card data (name, rating, photo, booking URL)
  ├── [place_attributes] → ["Sunrise", "Guided tour", "Hotel pickup", "Top temples"]
  ├── [markdown]        → "Do **Angkor Wat at sunrise with a guide**—..."
  └── [reviews]         → review snippets from real travelers
```

This is the core of the auto-render system: the AI doesn't return HTML — it returns **typed data blocks** that the frontend assembles into a rich card.

---

## 6. Full Response Structure (Completed)

For the query "What are the best things to do in Siem Reap, Cambodia?", the final response had **35 content blocks**:

```
[0-6]   progress blocks (7 status messages, shown sequentially during loading)
[7-8]   markdown (intro paragraphs — no recommendationBlockId)
[9-13]  Recommendation 1: Angkor Wat Sunrise Tour
          locations → place_attributes → markdown × 2 → reviews
[14-18] Recommendation 2: Ta Prohm
          locations → place_attributes → markdown × 2 → reviews
[19-23] Recommendation 3: Bayon Temple
          locations → place_attributes → markdown × 2 → reviews
[24-28] Recommendation 4: Tonlé Sap Floating Village
          locations → place_attributes → markdown × 2 → reviews
[29-33] Recommendation 5: Phare Cambodian Circus
          locations → place_attributes → markdown × 2 → reviews
[34]    markdown (summary with 🏆 top pick + 📍 alternatives + 💡 tip)
```

---

## 7. Location Card Data Shape

Each `locations` block's `queriesWithSources.querySourceMappings[].sources.locations[]` contains:

```json
{
  "locationId": 12005675,
  "name": "Angkor Wat Highlights and Sunrise Guided Tour from Siem Reap",
  "url": "/AttractionProductReview-g297390-d12005675-...",
  "placeType": "ACTIVITY",
  "reviewSummary": { "count": 3000, "rating": 4.9 },
  "thumbnail": {
    "photoSizeDynamic": {
      "urlTemplate": "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/...?w={width}&h={height}&s=1",
      "maxWidth": 720,
      "maxHeight": 480
    }
  },
  "parent": { "locationId": 297390, "latitude": 13.363545, "longitude": 103.86083 },
  "locationV2": {
    "details": {
      "productDetails": {
        "paymentOptions": ["RESERVE_NOW_PAY_LATER", "DEFAULT"],
        "cancellationConditions": { ... },
        "pricing": { ... }
      }
    }
  }
}
```

The photo URL uses a **template pattern** with `{width}` and `{height}` placeholders — the client fills these in based on the rendered card size.

---

## 8. Interactive Follow-Up Chips

After the response, the UI renders **preference chips** derived from the `place_attributes` blocks across all recommendations:

- "Sunrise viewing", "Jungle ruins", "Floating village", "Evening show", "Intricate carvings", "Atmospheric ruins", "Water reflections", "Cultural experience"

Selecting a chip marks it `[active]` and reveals a **Submit** button. This sends a follow-up message to refine the recommendations.

---

## 9. A/B Testing & Experiments

Every send-message request is batched with A/B test evaluation queries. Observed experiment keys:

- `plan_mode_text_only_vs_gpt_1773701346` — testing text-only vs GPT-4.1 responses
- `user_context_messages_in_plan_mode_chat_1778166785` — user context injection
- `plan_mode__multiple_photo_cards_1776342661` — multiple photo cards layout
- `plan_mode__create_place_attribute_labels_for_pois_1775825805` — attribute label generation
- `plan_mode__auto_expand_ugc_snippets_1774352979` — auto-expand review snippets
- `plan_mode__show_contextual_tips_during_thinking_1774116082` — tips during loading
- `ai_travel_assistant___internal_alpha_feedback_1747759102` — internal alpha feedback

The agent provider is explicitly named in the response: **`OLLIE_GPT_4_1`** (GPT-4.1 based).

---

## 10. Context Injection

The send-message mutation includes:
- `page.pageName` — what page the user was on ("Home", "Hotel", etc.)
- `page.url` — current URL path
- `userLocalTime` — client timestamp

The UI also shows "Asked while viewing [page name]" under each user message, confirming the AI uses page context.

---

## 11. Key Takeaways for DerLg Vibe Booking

### Architecture Decision: Polling vs WebSocket

TripAdvisor chose **GraphQL polling** over WebSocket. For DerLg, the existing WebSocket approach is actually superior because:
- True push (no polling overhead)
- Lower latency for streaming updates
- Already implemented in the Python agent

### Content Block Pattern to Adopt

The `PlanMode_InterleavedContent` pattern maps directly to DerLg's `content_payload` system:

| TripAdvisor | DerLg Equivalent |
|-------------|-----------------|
| `progress` blocks | `typing_start` + status text in `agent_message` |
| `locations` block | `trip_cards` / `hotel_cards` content_payload |
| `place_attributes` | Tag chips rendered inside card components |
| `reviews` | Review snippets inside card components |
| `markdown` | Plain `agent_message` text |
| `recommendationBlockId` grouping | Single `content_payload` object per recommendation |

### UI Patterns to Implement

1. **Progress ticker**: Show the latest tool-call status text, replacing previous one in-place. Text like "Searching for hotels in Phnom Penh..." updates as each tool runs.

2. **Grouped recommendation cards**: Each card = place photo + name + rating + tags + 1-2 AI sentences + review snippet. All from one `content_payload` object.

3. **Photo URL templates**: Use `{width}×{height}` template URLs from the backend — let the renderer fill in dimensions based on card size.

4. **Preference chips after response**: Extract key attributes from the response and render as selectable chips for follow-up refinement.

5. **Context injection**: Always send current page/route context with each message so the AI knows what the user was looking at.

6. **Markdown rendering**: The AI returns `**bold**` markdown inline — parse it client-side, never trust raw HTML.
