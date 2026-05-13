# Trip Discovery & Smart Suggestions — Architecture

> **Feature IDs:** F20–F26  
> **Scope:** MVP (F26: v1.1)

---

## Overview

The Trip Discovery module is the primary conversion surface. It serves curated content (featured trips, categories), supports faceted search/filtering, and renders rich detail pages. Data is fetched from the NestJS backend with Redis caching for performance.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Home Page   │  │ Trip Detail │  │ Search Page         │  │
│  │ (SSR/ISR)   │  │ (SSR)       │  │ (Client fetch)      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Trip Store (Zustand) — filters, sort, search state  │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Trips       │  │ Search      │  │ Reviews             │  │
│  │ Controller  │  │ Controller  │  │ Controller          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Trips Service — business logic, caching, sorting    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│  │ PostgreSQL│     │  Redis   │     │ Meilisearch│          │
│  │ (trips)  │     │ (cache)  │     │ (search)   │          │
│  └──────────┘     └──────────┘     └──────────┘            │
└──────────────────────────────────────────────────────────────┘
```

---

## State Flow: Home Screen

```
[User opens app] ──> [Next.js SSR fetches /v1/trips?featured=true]
                          │
                          ▼
                   [Cache hit?]
                     /      \
                   Yes      No
                   /          \
                  ▼            ▼
            [Redis]    [Query PostgreSQL]
                          │
                          ▼
                   [Store in Redis (5 min TTL)]
                          │
                          ▼
                   [Render page with trip cards]
```

---

## State Flow: Search Autocomplete

```
[User types in search bar] ──> [Debounce 300ms]
                                    │
                                    ▼
                             [Meilisearch multi-index query]
                                    │
                                    ▼
                             [Return top 8 results grouped by type]
                                    │
                                    ▼
                             [Render dropdown with keyboard nav]
```

---

## Data Flow: Category Filtering

```
[User selects "Temples"] ──> [Update Zustand store]
                              │
                              ▼
                       [Update URL: ?category=Temples]
                              │
                              ▼
                       [SWR/React Query revalidates]
                              │
                              ▼
                       [GET /v1/trips?category=Temples&sort=featured]
                              │
                              ▼
                       [Cache check → DB query → Response]
```

---

## Search Architecture

### Meilisearch Indexes

| Index | Fields | Filterable | Sortable |
|-------|--------|-----------|----------|
| `trips` | name, description, category, location, price | category, location, duration_days, price | price, rating_average, duration_days |
| `places` | name, description, category, location | category, location | |
| `hotels` | name, description, location, amenities | location, price_range | price |
| `guides` | name, bio, specialties, languages | languages, location | rating |

### Search API Aggregation

The search endpoint queries all four indexes in parallel and merges results:

```typescript
async search(query: string, locale: string) {
  const [trips, places, hotels, guides] = await Promise.all([
    meili.index('trips').search(query, { limit: 3, filter: `locale = ${locale}` }),
    meili.index('places').search(query, { limit: 2 }),
    meili.index('hotels').search(query, { limit: 2 }),
    meili.index('guides').search(query, { limit: 1 }),
  ]);
  return { trips, places, hotels, guides };
}
```

---

## Caching Strategy

| Endpoint | Cache Key | TTL | Invalidation |
|----------|-----------|-----|--------------|
| `GET /v1/trips?featured=true` | `trips:featured` | 5 min | On trip create/update/delete |
| `GET /v1/trips/:id` | `trip:${id}` | 10 min | On trip update/delete |
| `GET /v1/trips?category=X` | `trips:category:${X}` | 5 min | On trip create/update |
| `GET /v1/trips/:id/reviews` | `trip:${id}:reviews` | 2 min | On new review |
| Search autocomplete | `search:${query}` | 1 min | N/A (short TTL) |

---

## SSR Strategy

| Page | Strategy | Reason |
|------|----------|--------|
| Home (`/`) | ISR, revalidate 60s | Featured trips change infrequently; stale-while-revalidate |
| Trip detail (`/trips/[slug]`) | SSR | SEO-critical; fresh data on every request with caching |
| Search (`/search`) | Client-side | Highly dynamic; user input driven |
| Category (`/trips?category=X`) | ISR, revalidate 300s | Semi-static filtering |

---

## Operation Flow: Browse → Book Journey

End-to-end user journey through the Trip Discovery module:

```
1. [User opens app] ──> [GET /v1/trips?featured=true]
                              │
                              ▼
2. [Browse home screen] ──> [Tap category filter]
                              │
                              ▼
3. [GET /v1/trips?category=X&sort=featured]
                              │
                              ▼
4. [Tap trip card] ──> [GET /v1/trips/{slug}]
                              │
                              ▼
5. [View detail page] ──> [Scroll to "You might also like"]
                              │
                              ▼
6. [GET /v1/trips/{slug}/related]
                              │
                              ▼
7. [Scroll to reviews] ──> [GET /v1/trips/{tripId}/reviews]
                              │
                              ▼
8. [Tap heart icon] ──> [POST /v1/users/me/favorites/{tripId}]
                              │
                              ▼
9. [Tap share button] ──> [POST /v1/trips/{slug}/share]
                              │
                              ▼
10. [Tap Book Now] ──> [Navigate to booking flow]
```

---

## Non-Functional Requirements (NFRs)

| NFR | Target | Implementation |
|-----|--------|----------------|
| Search response time | < 500ms p95 | Meilisearch + Redis cache; autocomplete cached 1 min |
| Trip list response time | < 200ms p95 | PostgreSQL indexed queries + Redis cache (5 min TTL) |
| Trip detail response time | < 150ms p95 | Redis cache (10 min TTL); ISR for SSR pages |
| Cache hit ratio | > 80% | Featured trips and category lists cached with long TTL |
| Rate limit — search | 30 requests / min / IP | Redis-backed sliding window; 429 on exceed |
| Rate limit — reviews | 5 requests / min / user | Prevent spam; applies to POST/PATCH/DELETE |
| Rate limit — favorites | 60 requests / min / user | Toggle-heavy endpoint; generous but bounded |
| Max results per type (search) | 50 per entity type | `limit` parameter capped at 50 |
| Max favorites per user | 100 | Hard limit enforced at API layer |
| CDN | Trip images served via CDN | Cover and gallery images use `cdn.derlg.com` with automatic WebP conversion |
| Image optimization | Responsive sizes | CDN serves `?w=400`, `?w=800`, `?w=1200` based on device |
| Availability | 99.9% uptime | Trip discovery is the primary conversion surface; monitored with alerting |

---

*Aligned with PRD section 7.3 and `.kiro/specs/frontend-nextjs-implementation/requirements.md`.*
