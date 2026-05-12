# Admin Dashboard — Architecture

> **Feature ID:** F20–F31  
> **Scope:** v2.0 (MVP scaffolding for key endpoints)  
> **Priority:** P1

---

## Overview

The Admin Dashboard module is the back-office nerve center of the DerLg platform. It is a **read-heavy, composition-based** interface where the frontend assembles dashboards by firing multiple small, focused API requests in parallel. The backend exposes a flat, domain-oriented REST API with no monolithic "dashboard" endpoints.

The architecture prioritizes:
1. **Endpoint granularity** — each endpoint does one thing well
2. **Parallel composition** — dashboard widgets fetch independently
3. **Role-based access control** — four admin roles with escalating privileges
4. **Auditability** — every mutation is logged immutably
5. **Operational safety** — driver assignments validate fleet state; emergency alerts trigger notifications

---

## System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js — Admin Shell)                   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Dashboard    │  │ Booking      │  │ Fleet        │  │ Support          │ │
│  │ (KPI Cards)  │  │ Ops          │  │ Management   │  │ Center           │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │
│         │                 │                 │                   │           │
│         └─────────────────┴─────────────────┴───────────────────┘           │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ React Query Cache                                                    │   │
│  │ — Parallel queries, stale-while-revalidate, automatic dedup         │   │
│  │ — KPIs refresh: 30s | Lists refresh: 60s | Details: on mount        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ Bearer JWT (Admin Role Claim)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Backend (NestJS — Admin Module)                     │
│                                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Drivers │ │ Vehicles│ │Booking  │ │ Hotels  │ │ Guides  │ │Emergency│  │
│  │ Module  │ │ Module  │ │Module   │ │ Module  │ │ Module  │ │ Module  │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       │           │           │           │           │           │        │
│  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ │
│  │Service  │ │Service  │ │Service  │ │Service  │ │Service  │ │Service  │ │
│  │Controller│ │Controller│ │Controller│ │Controller│ │Controller│ │Controller│ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       └───────────┴───────────┴───────────┴───────────┴───────────┘        │
│                                   │                                         │
│  ┌─────────┐ ┌─────────┐ ┌───────┴───────┐ ┌─────────┐ ┌─────────┐        │
│  │Customer │ │Loyalty  │ │  Analytics    │ │Student  │ │Discount │        │
│  │ Module  │ │ Module  │ │  Aggregator   │ │Verify   │ │ Module  │        │
│  └─────────┘ └─────────┘ └───────────────┘ └─────────┘ └─────────┘        │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Admin Users  │  │ Audit Logs   │  │ Export Jobs  │  │ Backups      │   │
│  │ (RBAC)       │  │ (Immutable)  │  │ (Async)      │  │ (SUPER_ADMIN)│   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Common Layer: Guards, Interceptors, Pipes, Decorators                │   │
│  │ — RolesGuard (SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER, etc.) │   │
│  │ — AuditLogInterceptor (auto-logs mutations)                         │   │
│  │ — ResponseEnvelopeInterceptor (wraps in {success, data, ...})       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        ┌──────────┐      ┌──────────┐      ┌──────────┐
        │ Supabase │      │  Redis   │      │ Supabase │
        │   (PG)   │      │ (Cache / │      │ Storage  │
        │          │      │ PubSub)  │      │          │
        └──────────┘      └──────────┘      └──────────┘
                                  ▲
                                  │
┌─────────────────────────────────┴───────────────────────────────────────────┐
│  External: Telegram Bot Webhook (POST /telegram/driver-status)               │
│  — X-Webhook-Secret auth, publishes driver status update to Redis Pub/Sub    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Design Principles

### 1. Single-Responsibility Endpoints

No endpoint returns a "full dashboard." Each endpoint serves one widget or one action:

| Widget | Endpoint | Response Shape |
|--------|----------|----------------|
| Available drivers count | `GET /admin/drivers/count?status=AVAILABLE` | `{ count: 5 }` |
| Today's revenue | `GET /admin/bookings/today-revenue` | `{ total_usd, total_khr }` |
| Booking trend chart | `GET /admin/bookings/trend?days=30` | `{ data: [{date, count}] }` |
| Pending maintenance | `GET /admin/maintenance/upcoming` | Array of maintenance records |

### 2. Parallel Query Composition

The frontend uses React Query to fire all dashboard requests simultaneously:

```typescript
// Dashboard page composition
const { data: availableDrivers } = useQuery({
  queryKey: ['admin', 'drivers', 'count', 'AVAILABLE'],
  queryFn: () => api.get('/admin/drivers/count?status=AVAILABLE'),
  refetchInterval: 30000,
});

const { data: busyDrivers } = useQuery({
  queryKey: ['admin', 'drivers', 'count', 'BUSY'],
  queryFn: () => api.get('/admin/drivers/count?status=BUSY'),
  refetchInterval: 30000,
});

const { data: todayRevenue } = useQuery({
  queryKey: ['admin', 'bookings', 'today-revenue'],
  queryFn: () => api.get('/admin/bookings/today-revenue'),
  refetchInterval: 30000,
});

// ... additional parallel queries
```

Benefits:
- **Independent caching:** Each widget caches independently; refreshing one does not invalidate others.
- **Partial failure resilience:** If the analytics service is slow, the dashboard still renders KPIs and lists.
- **Optimized refetching:** KPIs refresh every 30s; lists every 60s; details only on mount.

### 3. Consistent Response Envelope

All JSON responses follow the platform envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": null,
  "error": null
}
```

The `ResponseEnvelopeInterceptor` wraps all controller responses automatically. Raw file downloads (CSV exports, backups) bypass the envelope.

---

## Module Breakdown

### Fleet Management (Drivers + Vehicles + Maintenance)

**Responsibility:** Manage the transportation fleet, driver profiles, and vehicle maintenance schedules.

```
┌────────────────────────────────────────┐
│          FleetModule                   │
│  ┌─────────────┐  ┌─────────────────┐ │
│  │ Drivers     │  │ Vehicles        │ │
│  │ Controller  │  │ Controller      │ │
│  │ — list()    │  │ — list()        │ │
│  │ — count()   │  │ — create()      │ │
│  │ — detail()  │  │ — detail()      │ │
│  │ — create()  │  │ — update()      │ │
│  │ — update()  │  └─────────────────┘ │
│  └─────────────┘                      │
│  ┌─────────────────┐                  │
│  │ Maintenance     │                  │
│  │ Controller      │                  │
│  │ — list()        │                  │
│  │ — upcoming()    │                  │
│  │ — schedule()    │                  │
│  │ — update()      │                  │
│  └─────────────────┘                  │
└────────────────────────────────────────┘
```

**Key behaviors:**
- `GET /admin/drivers/count` is optimized with a `COUNT(*)` query + Redis cache (TTL: 10s).
- Driver status transitions: AVAILABLE → BUSY (on assignment), BUSY → AVAILABLE (on completion).
- Maintenance `upcoming` endpoint queries `scheduled_date BETWEEN now AND now + interval '3 days'`.

### Assignment Module

**Responsibility:** Orchestrate driver-to-booking assignments with state validation.

```
┌────────────────────────────────────────┐
│      AssignmentService                 │
│                                        │
│  assign(driverId, bookingId, vehicleId)│
│    1. Lock driver row (SELECT FOR UPDATE)│
│    2. Verify driver.status = AVAILABLE │
│    3. Verify vehicle.capacity >= booking.passengers│
│    4. Create assignment record         │
│    5. Update driver.status = BUSY      │
│    6. Publish "assignment.created" to Redis│
│    7. Return assignment                │
│                                        │
│  complete(assignmentId)                │
│    1. Set completion_timestamp = now() │
│    2. Update driver.status = AVAILABLE │
│    3. Publish "assignment.completed"   │
└────────────────────────────────────────┘
```

**Concurrency:** Use database row-level locking (`SELECT FOR UPDATE`) on the driver row to prevent double-assignment race conditions.

### Booking Operations Module

**Responsibility:** Booking lifecycle management, cancellation, and dashboard statistics.

**Statistics aggregation strategy:**
- `today-count`: Query `bookings` table filtered by `created_at >= CURRENT_DATE`.
- `today-revenue`: Aggregate `total_amount` from confirmed bookings created today, grouped by currency.
- `trend`: Generate a date series (using `generate_series`) LEFT JOIN with daily booking counts.

**Cancellation flow:**
```
POST /admin/bookings/{id}/cancel
  1. Load booking with payments (SELECT)
  2. Calculate refund based on cancellation policy
  3. Create refund record (if applicable)
  4. Release driver assignment (if any)
  5. Update booking.status = CANCELLED
  6. Trigger customer notification (FCM + email)
  7. Audit log: "booking.cancelled"
```

### Hotel & Guide Content Modules

**Responsibility:** CRUD operations for hotel inventory and tour guide profiles.

**Hotel structure:**
```
Hotel
 ├── Rooms[] (1:N)
 └── Location (lat, lng, address, province)
```

Room management is nested under `/admin/hotels/{hotelId}/rooms` to maintain clear ownership.

**Guide structure:**
```
Guide
 ├── languages[] (e.g., ["en", "zh"])
 ├── specialties[] (e.g., ["temples", "food", "history"])
 └── Assignments[] (1:N)
```

### Emergency Monitoring Module

**Responsibility:** Real-time alert tracking and resolution workflow.

```
┌────────────────────────────────────────┐
│      EmergencyAlert Lifecycle          │
│                                        │
│  SENT ──▶ ACKNOWLEDGED ──▶ RESOLVED   │
│     │            │              │      │
│     │            │              │      │
│     ▼            ▼              ▼      │
│  Dashboard   Notify ops    Notify user │
│  red badge   (push/email)  (email/SMS) │
│                                        │
└────────────────────────────────────────┘
```

- `GET /admin/emergency?status=SENT&limit=5` powers the "Active Alerts" dashboard card.
- Status changes trigger notifications and are logged to the audit trail.

### Analytics Aggregator

**Responsibility:** Compute and serve aggregated business metrics.

**Implementation approach:**
- Use raw SQL/Prisma aggregations for performance.
- Cache expensive queries in Redis (TTL: 5 minutes for analytics).
- Each metric is a separate endpoint to allow independent caching and partial rendering.

| Endpoint | Aggregation Logic |
|----------|-------------------|
| `/analytics/revenue` | `SUM(total_amount) GROUP BY booking_type` |
| `/analytics/booking-stats` | `COUNT(*) GROUP BY status` + cancellation rate |
| `/analytics/driver-performance` | `COUNT(assignments) + AVG(review.rating) GROUP BY driver_id` |
| `/analytics/popular-destinations` | `COUNT(bookings) GROUP BY destination ORDER BY count DESC` |
| `/analytics/hotel-occupancy` | `SUM(booked_nights) / SUM(total_nights)` |
| `/analytics/guide-utilization` | `COUNT(assigned_days) / COUNT(available_days)` |
| `/analytics/ai-bookings` | `COUNT(*) WHERE ai_assisted = true` + conversion metrics |

### Platform Governance Modules (SUPER_ADMIN)

#### Admin Users

- Roles are hierarchical but flat: `SUPER_ADMIN` > all others.
- JWT payload includes `admin_role` claim; `RolesGuard` checks against endpoint metadata.
- Deactivating an admin should add their JWT jti to a Redis blacklist (or rely on short 15-minute expiry).

#### Audit Logs

```
┌────────────────────────────────────────┐
│      AuditLogInterceptor               │
│                                        │
│  On every POST/PATCH/DELETE:           │
│    1. Capture admin_user_id from JWT   │
│    2. Capture action_type (method+path)│
│    3. Capture entity and entity_id     │
│    4. Serialize request body (sanitized)│
│    5. Insert into audit_logs table     │
│                                        │
│  Excluded paths:                       │
│    — GET requests (read-only)          │
│    — /admin/audit-logs/* (meta)        │
│    — /telegram/* (external)            │
└────────────────────────────────────────┘
```

**Table schema:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,        -- e.g., "booking.cancel"
  entity TEXT NOT NULL,             -- e.g., "booking"
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- Audit logs are **immutable** — no UPDATE or DELETE API exists.
- Export as CSV streams from DB to response to minimize memory usage.

#### Export Jobs

- **Bookings export:** Stream rows to CSV/JSON writer; supports date filtering.
- **Payments export:** Must be encrypted. Options: password-protected ZIP or GPG encryption with platform key.
- **Async consideration:** Large exports (> 100k rows) should return 202 and provide a download URL via Supabase Storage.

#### Backups

```
POST /admin/backups
  1. Validate SUPER_ADMIN role
  2. Insert "backup.pending" record
  3. Trigger Supabase pg_dump via Edge Function (async)
  4. Upload dump to Supabase Storage with signed URL
  5. Update record to "backup.completed" with download URL
  6. Return 202 Accepted
```

---

## Security Architecture

### Authentication Flow

```
┌─────────┐     POST /v1/auth/admin-login     ┌─────────┐
│  Admin  │ ─────────────────────────────────▶│ Backend │
│ Browser │     { email, password }           │         │
│         │◀─────────────────────────────────│         │
│         │     { accessToken, refreshToken } │         │
│         │                                    │         │
│         │     GET /v1/admin/drivers          │         │
│         │ ─────────────────────────────────▶│         │
│         │     Authorization: Bearer <token> │         │
│         │◀─────────────────────────────────│         │
│         │     { success, data }             │         │
└─────────┘                                    └─────────┘
```

### Authorization Matrix

| Endpoint Pattern | SUPER_ADMIN | OPERATIONS_MANAGER | FLEET_MANAGER | SUPPORT_AGENT |
|-----------------|-------------|-------------------|---------------|---------------|
| `/admin/drivers/*` | ✓ | ✓ | ✓ | ✗ |
| `/admin/vehicles/*` | ✓ | ✓ | ✓ | ✗ |
| `/admin/maintenance/*` | ✓ | ✓ | ✓ | ✗ |
| `/admin/assignments/*` | ✓ | ✓ | ✓ | ✗ |
| `/admin/bookings/*` | ✓ | ✓ | ✗ | ✓ (view only) |
| `/admin/hotels/*` | ✓ | ✓ | ✗ | ✗ |
| `/admin/guides/*` | ✓ | ✓ | ✗ | ✗ |
| `/admin/emergency/*` | ✓ | ✓ | ✗ | ✓ |
| `/admin/customers/*` | ✓ | ✓ | ✗ | ✓ |
| `/admin/loyalty/*` | ✓ | ✓ | ✗ | ✓ (view only) |
| `/admin/discounts/*` | ✓ | ✓ | ✗ | ✗ |
| `/admin/student-verifications/*` | ✓ | ✓ | ✗ | ✓ |
| `/admin/analytics/*` | ✓ | ✓ | ✗ | ✗ |
| `/admin/users/*` | ✓ | ✗ | ✗ | ✗ |
| `/admin/audit-logs/*` | ✓ | ✗ | ✗ | ✗ |
| `/admin/export/*` | ✓ | ✗ | ✗ | ✗ |
| `/admin/backups/*` | ✓ | ✗ | ✗ | ✗ |
| `/admin/ai-sessions/*` | ✓ | ✓ | ✗ | ✓ |

### Telegram Webhook Security

The Telegram driver-status webhook uses a **different auth scheme** from the admin API:

```
Telegram Bot ──POST /telegram/driver-status──▶ Backend
Headers:
  Content-Type: application/json
  X-Webhook-Secret: <shared_secret>

Backend:
  1. Compare X-Webhook-Secret against WEBHOOK_SECRET env var
  2. If mismatch → 401 Unauthorized
  3. If match → process update → publish to Redis → 200 OK
```

This endpoint is **not** protected by JWT — it is a machine-to-machine integration.

---

## Data Flow: Dashboard Composition

```
┌─────────────────────────────────────────────────────────────────┐
│                     Admin Dashboard Page Load                    │
│                                                                  │
│  Step 1: Fire 10 parallel queries via React Query               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ useQueries([                                             │   │
│  │   { queryKey: ['drivers','count','AVAILABLE'], ... },   │   │
│  │   { queryKey: ['drivers','count','BUSY'], ... },        │   │
│  │   { queryKey: ['bookings','today-count'], ... },        │   │
│  │   { queryKey: ['bookings','today-revenue'], ... },      │   │
│  │   { queryKey: ['bookings','trend'], ... },              │   │
│  │   { queryKey: ['bookings','unassigned'], ... },         │   │
│  │   { queryKey: ['maintenance','upcoming'], ... },        │   │
│  │   { queryKey: ['emergency','active'], ... },            │   │
│  │   { queryKey: ['bookings','next-24h'], ... },           │   │
│  │ ])                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  Step 2: Each query hits a dedicated lightweight endpoint       │
│                              │                                   │
│  Step 3: Responses cached independently                         │
│                              │                                   │
│  Step 4: Widgets render as data arrives (suspense boundaries)   │
│                              │                                   │
│  Step 5: Background refetch every 30s (KPIs) / 60s (lists)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database & Entity Relationships

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │◄──────┤  bookings   │◄──────┤ assignments │
│  (customers)│   1:N │             │   1:1 │             │
└─────────────┘       └──────┬──────┘       └──────┬──────┘
                             │                      │
                    ┌────────┴────────┐      ┌─────┴─────┐
                    │  booking_type   │      │  drivers  │
                    │  enum: PACKAGE  │      │           │
                    │       HOTEL_ONLY│      └─────┬─────┘
                    │       etc.      │            │
                    └─────────────────┘            │
                                                   │
                              ┌────────────────────┘
                              │
                        ┌─────┴─────┐
                        │  vehicles │
                        │           │
                        └─────┬─────┘
                              │
                        ┌─────┴──────────┐
                        │  maintenance   │
                        │  (1:N vehicles)│
                        └────────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   hotels    │◄──────┤    rooms    │       │   guides    │
│             │   1:N │             │       │             │
└─────────────┘       └─────────────┘       └──────┬──────┘
                                                    │
                                              ┌─────┴─────┐
                                              │assignments│
                                              │  (1:N)    │
                                              └───────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  emergency  │◄──────┤   users     │       │   loyalty   │
│   alerts    │   N:1 │             │       │transactions │
└─────────────┘       └─────────────┘       └──────┬──────┘
                                                    │
                                              ┌─────┴─────┐
                                              │   users   │
                                              └───────────┘

┌─────────────┐       ┌─────────────┐
│admin_users  │◄──────┤ audit_logs  │
│             │   1:N │             │
└─────────────┘       └─────────────┘
```

---

## Implementation Considerations

### NestJS Module Structure

```
backend/src/
├── admin/
│   ├── admin.module.ts              # Aggregates all admin sub-modules
│   ├── common/
│   │   ├── guards/roles.guard.ts
│   │   ├── interceptors/
│   │   │   ├── audit-log.interceptor.ts
│   │   │   └── response-envelope.interceptor.ts
│   │   └── decorators/roles.decorator.ts
│   ├── drivers/
│   ├── vehicles/
│   ├── maintenance/
│   ├── assignments/
│   ├── bookings/
│   ├── hotels/
│   ├── guides/
│   ├── emergency/
│   ├── customers/
│   ├── loyalty/
│   ├── discounts/
│   ├── student-verifications/
│   ├── analytics/
│   ├── admin-users/
│   ├── audit-logs/
│   ├── export/
│   ├── backups/
│   └── ai-sessions/
└── telegram/
    └── telegram.controller.ts       # Webhook endpoint (outside admin guard)
```

### Caching Strategy

| Data | Cache Layer | TTL | Invalidation |
|------|-------------|-----|--------------|
| Driver counts | Redis | 10s | On assignment create/complete |
| Today KPIs | Redis | 30s | Time-based (auto-expire) |
| Booking trend | Redis | 5 min | End of day |
| Analytics aggregates | Redis | 5 min | Manual or scheduled |
| AI sessions | Redis | 7 days (origin) | TTL only |

### Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Standard admin read | 100 req/min per admin |
| Standard admin write | 30 req/min per admin |
| Export | 5 req/hour per admin |
| Backup trigger | 10 req/day per admin |
| Telegram webhook | 1000 req/min per IP |

### Frontend State Management

- React Query handles server state (caching, refetching, deduplication).
- Zustand stores handle local UI state (selected filters, modal visibility, toast notifications).
- No global fetch wrapper needed — React Query `queryFn` attaches the Bearer token from the auth store.

---

*Aligned with PRD section 8.0 (Admin & Operations) and `docs/modules/admin/api.yaml`.*
