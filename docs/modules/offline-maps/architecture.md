# Offline Maps — Architecture

> **Feature ID:** F83
> **Scope:** v1.1

---

## Overview

Offline Maps uses a Service Worker to cache OpenStreetMap tiles by province. Travelers can pre-download map packs before traveling to rural areas with poor connectivity.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js / PWA)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Map Pack    │  │ Download    │  │ Offline Map         │  │
│  │ List        │  │ Manager     │  │ Viewer              │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Service Worker (sw.js)                              │    │
│  │ — Intercept tile requests                           │    │
│  │ — Cache-first strategy                              │    │
│  │ — Background sync for downloads                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Cache Storage API (browser)                         │    │
│  │ — Named caches per province                         │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Service Worker Strategy

```javascript
// sw.js — Map tile caching
const TILE_CACHE = 'derlg-tiles-v1';
const TILE_URL_PATTERN = /^https:\/\/.*\.tile\.openstreetmap\.org\//;

self.addEventListener('fetch', (event) => {
  if (TILE_URL_PATTERN.test(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        // Return cached tile immediately
        if (cached) return cached;

        // Fetch and cache for next time
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(TILE_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
```

---

## Map Pack Download

```typescript
async function downloadMapPack(province: string, bbox: BoundingBox) {
  const tiles = calculateTilesForBBox(bbox, ZOOM_LEVELS); // zoom 10–16
  const cache = await caches.open(`derlg-tiles-${province}`);

  for (const tile of tiles) {
    const url = `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
    try {
      const response = await fetch(url);
      await cache.put(url, response.clone());
      updateProgress(tiles.indexOf(tile), tiles.length);
    } catch (err) {
      // Retry once, then skip
      console.warn(`Failed to download tile: ${url}`);
    }
  }

  // Store metadata
  await db.mapPacks.put({
    province,
    downloadedAt: new Date(),
    tileCount: tiles.length,
    sizeBytes: await calculateCacheSize(cache),
  });
}
```

---

## Storage Management

```typescript
const MAX_OFFLINE_STORAGE_MB = 500;

async function enforceStorageLimit() {
  const packs = await db.mapPacks.orderBy('lastAccessed').toArray();
  let totalMb = packs.reduce((sum, p) => sum + p.sizeMb, 0);

  while (totalMb > MAX_OFFLINE_STORAGE_MB && packs.length > 0) {
    const oldest = packs.shift();
    await caches.delete(`derlg-tiles-${oldest.province}`);
    await db.mapPacks.delete(oldest.province);
    totalMb -= oldest.sizeMb;
  }
}
```

---

*Aligned with PRD section 7.9 and `.kiro/specs/frontend-nextjs-implementation/requirements.md`.*
