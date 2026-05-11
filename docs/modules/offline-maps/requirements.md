# Offline Maps — Requirements

> **Feature ID:** F83
> **Scope:** v1.1
> **Priority:** P1

---

## User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F83-01 | As a traveler, I want to download map tiles for offline use so that I can navigate without internet. | AC1: Map packs organized by Cambodia province (25 provinces). AC2. Each pack shows: size (MB), estimated download time, last updated date. AC3. One-tap download with progress indicator. AC4. Downloads resume on interruption. AC5. Storage limit: max 500MB of cached tiles per user. AC6. Auto-delete oldest unused packs when limit reached. |
| US-F83-02 | As a traveler, I want the app to use cached maps when offline so that my experience is seamless. | AC1. Service Worker intercepts map tile requests. AC2. Cache-first strategy for tiles: serve from cache, fallback to network. AC3. Visual indicator when viewing cached vs. live tiles. AC4. GPS location dot works offline (device GPS, not network). AC5. Saved places and booking locations visible offline. |
| US-F83-03 | As a traveler, I want to manage my offline map storage so that I can free up space. | AC1. Settings page shows total offline storage used. AC2. List of downloaded packs with delete option. AC3. Bulk delete support. AC4. Warning before deleting pack currently in use. AC5. Auto-update check: notify when newer tile version available. |

---

## Province Map Packs

| Province | Approx. Size | Priority |
|----------|-------------|----------|
| Siem Reap | 45MB | High (tourism hub) |
| Phnom Penh | 38MB | High |
| Sihanoukville | 32MB | High |
| Battambang | 28MB | Medium |
| Kampot | 25MB | Medium |
| Kep | 18MB | Medium |
| Mondulkiri | 35MB | Low (eco-tourism) |
| Ratanakiri | 33MB | Low |
| ... (remaining 17) | 20–30MB each | Low |

**Total all provinces: ~650MB**

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `OFFLINE_001` | 400 | Storage quota exceeded |
| `OFFLINE_002` | 404 | Map pack not found |
| `OFFLINE_003` | 400 | Download interrupted |

---

*Aligned with PRD section 7.9 and `.kiro/specs/frontend-nextjs-implementation/requirements.md` (Req 12, 19).*
