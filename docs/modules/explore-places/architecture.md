# Explore — Historical Places — Architecture

> **Feature IDs:** F80–F82, F85  
> **Scope:** MVP

---

## Overview

The Explore module provides a browsable directory of Cambodian points of interest with an interactive map layer. It is primarily a read-heavy module optimized for fast rendering and SEO.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Places List │  │ Place Detail│  │ Map View            │  │
│  │ (SSR/ISR)   │  │ (SSR)       │  │ (Client Component)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Leaflet.js + OpenStreetMap                          │    │
│  │ (lazy-loaded, only on map-enabled pages)            │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Places      │  │ Search      │  │ Nearby Service      │  │
│  │ Controller  │  │ Controller  │  │ (PostGIS)           │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ PostgreSQL + PostGIS extension                       │    │
│  │ (geospatial queries for nearby places)               │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Map Integration

### Leaflet.js Configuration

```typescript
// Map configuration
const MAP_CONFIG = {
  center: [12.5657, 104.9910], // Cambodia center
  zoom: 7,
  minZoom: 6,
  maxZoom: 18,
  tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors',
};
```

### Marker Clustering

For areas with many places (e.g., Siem Reap), markers cluster automatically:
- Cluster radius: 80px
- Max cluster zoom: 14 (disables clustering at high zoom)
- Spiderfy on click for overlapping markers

### User Location

```typescript
// Request geolocation permission
navigator.geolocation.getCurrentPosition(
  (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 12),
  (err) => console.warn('Geolocation denied'),
  { enableHighAccuracy: true, timeout: 5000 }
);
```

---

## Geospatial Queries (PostGIS)

### Nearby Places

```sql
SELECT id, name, latitude, longitude,
       ST_Distance(
         ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       ) as distance_meters
FROM places
WHERE status = 'ACTIVE'
  AND ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    $3 -- radius in meters
  )
ORDER BY distance_meters
LIMIT 20;
```

---

## SEO Architecture

### SSR for Public Pages

| Page | Strategy | Structured Data |
|------|----------|----------------|
| `/places` | ISR, revalidate 1h | ItemList of TouristAttractions |
| `/places/[slug]` | SSR | TouristAttribution (schema.org) |
| `/trips/[slug]` | SSR | Trip (schema.org) |

### JSON-LD Example (Place Detail)

```json
{
  "@context": "https://schema.org",
  "@type": "TouristAttraction",
  "name": "Angkor Wat",
  "description": "The largest religious monument in the world...",
  "image": "https://cdn.derlg.com/places/angkor-wat.jpg",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 13.4125,
    "longitude": 103.8670
  },
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Siem Reap",
    "addressCountry": "KH"
  },
  "openingHours": "Mo-Su 05:00-17:30",
  "priceRange": "$37"
}
```

---

## Sitemap Generation

```typescript
// app/sitemap.ts (Next.js App Router)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [trips, places] = await Promise.all([
    fetchAllTrips(),
    fetchAllPlaces(),
  ]);

  return [
    { url: 'https://derlg.com', lastModified: new Date() },
    ...trips.map(t => ({
      url: `https://derlg.com/trips/${t.slug}`,
      lastModified: t.updated_at,
    })),
    ...places.map(p => ({
      url: `https://derlg.com/places/${p.slug}`,
      lastModified: p.updated_at,
    })),
  ];
}
```

---

## Operation Flow

### Place Discovery Journey

```
1. User opens /places or map view
2. Frontend calls GET /places (list) or GET /places/nearby (map)
3. User applies category/province filters (re-query with params)
4. User clicks a place card
5. Frontend calls GET /places/{slug} for detail
6. Frontend lazily loads:
   - GET /places/{slug}/related   ("You may also like")
   - GET /places/{slug}/nearby-trips ("Trips that visit here")
7. User taps "Get Directions" → opens external maps app
8. User saves place to a trip (via my-trip module)
```

---

## Non-Functional Requirements

| NFR | Target | Implementation |
|-----|--------|----------------|
| List response time | < 200ms p95 | PostgreSQL index on `(status, category, province)` + Redis cache (TTL 1h) |
| Nearby query time | < 300ms p95 | PostGIS `GIST` index on `ST_Point(longitude, latitude)` |
| Detail response time | < 100ms p95 | Redis cache per slug (TTL 1h); stale-while-revalidate |
| Image delivery | < 50ms | CDN (Supabase Storage + CloudFront); WebP with jpeg fallback |
| Mobile bandwidth | < 500KB initial | Lazy-load gallery images; map tiles only on map view |
| Availability | 99.9% | Read replicas for list/detail; failover cache |
| Rate limit | 100 req/min/IP | `X-RateLimit-*` headers on all endpoints |
| Cache invalidation | < 5s | Write-through cache on admin mutations; slug-based invalidation |
| SEO — page TTFB | < 800ms | Next.js SSR/ISR with 1h revalidation for /places and /places/[slug] |

---

*Aligned with PRD section 7.9 and `.kiro/specs/frontend-nextjs-implementation/requirements.md` (Req 4, 13).*
