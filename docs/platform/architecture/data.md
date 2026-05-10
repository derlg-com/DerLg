# Data Architecture

> **Scope:** Where data lives, how it moves, who owns it, and how it is cached.

---

## Primary Database — PostgreSQL (Supabase)

| Attribute | Detail |
|-----------|--------|
| **Role** | Source of truth for all business data |
| **Production** | Supabase managed PostgreSQL |
| **Development** | Docker `postgres:15-alpine` |
| **ORM** | Prisma |
| **Schema file** | `backend/prisma/schema.prisma` |

### Hosting Strategy

- **Production:** Supabase provides managed PostgreSQL with automatic backups, connection pooling, and Row-Level Security (RLS).
- **Development:** A local Docker container spun up via `docker-compose.yml`.
- **Connection pooling:** PgBouncer or Supabase pooler is used in production to handle burst traffic from the NestJS backend.

### ORM & Migration Strategy

- **Prisma** is the only allowed way to access PostgreSQL.
- Schema changes follow this workflow:
  1. Edit `schema.prisma`
  2. Run `npx prisma migrate dev` (local) or `npx prisma migrate deploy` (CI)
  3. Generate client: `npx prisma generate`
- Prisma Studio (`npx prisma studio`) is the recommended local database GUI.

### Row-Level Security (RLS)

- RLS is **enabled on all tables** in Supabase production.
- Backend bypasses RLS using the `service_role` key; all authorization logic lives in NestJS guards and services.
- Direct client access to Supabase (if ever needed) will use anon/key-authenticated policies.

---

## Cache & Sessions — Redis

| Attribute | Detail |
|-----------|--------|
| **Role** | Session store, rate-limiting counter, pub/sub bus, AI conversation state |
| **Production** | Upstash (managed Redis with TLS) |
| **Development** | Docker `redis:7-alpine` |
| **Client** | `ioredis` or `redis` (NestJS) |

### Key Patterns & TTL Policies

| Key Prefix | Purpose | TTL | Example |
|------------|---------|-----|---------|
| `sess:` | User session metadata | 7 days | `sess:user_123` |
| `refresh:` | JWT refresh token whitelist | 7 days | `refresh:abc123` |
| `ratelimit:` | Per-IP request counter | 5 minutes | `ratelimit:192.168.1.1` |
| `ai:conv:` | AI conversation state (LangGraph) | 7 days | `ai:conv:user_456` |
| `cache:` | General API response cache | 1 hour | `cache:hotels:siem_reap` |

### Pub / Sub Channels

| Channel | Publisher | Subscriber | Purpose |
|---------|-----------|------------|---------|
| `payment:status:{bookingId}` | Backend (Stripe webhook handler) | Frontend (SSE subscriber) | Real-time payment status updates |
| `emergency:broadcast` | Backend (emergency module) | All connected clients | Emergency alert push |

---

## File Storage — Supabase Storage

| Attribute | Detail |
|-----------|--------|
| **Role** | Avatars, ID verifications, hotel images, receipt PDFs |
| **Production** | Supabase Storage bucket |
| **Development** | Supabase local CLI or cloud project |

### Buckets & Access Patterns

| Bucket | Access | Content | URL Type |
|--------|--------|---------|----------|
| `public-images` | Public | Hotel photos, place images, festival banners | Public URL (no expiry) |
| `user-uploads` | Private | Avatar images, student ID scans | Signed URL (1-hour expiry) |
| `receipts` | Private | Booking receipt PDFs | Signed URL (24-hour expiry) |

### Upload Flow

1. Frontend requests a **signed upload URL** from the backend.
2. Backend generates the signed URL via Supabase Storage API.
3. Frontend uploads the file directly to Supabase Storage (bypassing backend bandwidth).
4. Backend stores the returned public/signed file path in PostgreSQL.

---

## Data Flow Diagrams

### Read Flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend
    participant P as Prisma
    participant PG as PostgreSQL
    participant R as Redis

    F->>B: GET /v1/hotels/:id (JWT)
    B->>R: GET cache:hotels:{id}
    alt Cache hit
        R-->>B: Cached JSON
    else Cache miss
        B->>P: findUnique({ id })
        P->>PG: SQL SELECT
        PG-->>P: Row data
        P-->>B: Hotel object
        B->>R: SET cache:hotels:{id} (TTL 1h)
    end
    B-->>F: 200 OK { success, data }
```

### Write Flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend
    participant P as Prisma
    participant PG as PostgreSQL
    participant R as Redis

    F->>B: POST /v1/bookings (JWT + DTO)
    B->>B: Validate DTO (class-validator)
    B->>P: create({ ... })
    P->>PG: SQL INSERT
    PG-->>P: Row data
    P-->>B: Booking object
    B->>R: DEL cache:bookings:user_{id}
    B->>R: PUBLISH booking:created { userId, bookingId }
    B-->>F: 201 Created { success, data }
```

### AI Flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant A as AI Agent<br/>(FastAPI)
    participant C as Claude API
    participant B as Backend
    participant P as Prisma
    participant PG as PostgreSQL
    participant R as Redis

    F->>A: WebSocket: "Book a hotel in Siem Reap"
    A->>R: GET ai:conv:user_123
    R-->>A: Conversation state
    A->>C: messages + tools
    C-->>A: tool_call: search_hotels
    A->>B: GET /v1/ai-tools/hotels?city=siem_reap<br/>X-Service-Key: ***
    B->>P: findMany({ city })
    P->>PG: SQL SELECT
    PG-->>P: Results
    P-->>B: Hotel list
    B-->>A: 200 OK { hotels }
    A->>C: tool_result: hotels
    C-->>A: "Here are 3 hotels..."
    A->>R: SET ai:conv:user_123 (TTL 7d)
    A-->>F: WebSocket: "Here are 3 hotels..."
```

---

## Data Ownership Rules

| Data Type | Owner | Storage | Backup |
|-----------|-------|---------|--------|
| User accounts & profiles | Backend | PostgreSQL | Supabase automated backups |
| Bookings, payments, loyalty | Backend | PostgreSQL | Supabase automated backups |
| AI conversation history | AI Agent | Redis (7d TTL) + PostgreSQL (archived) | Redis AOF + nightly PG archive |
| Session tokens | Backend | Redis | None (ephemeral) |
| Uploaded files | Supabase Storage | S3-backed buckets | Supabase bucket replication |
| Cached API responses | Backend | Redis | None (rebuildable) |

---

*For authentication and authorization, see [`security.md`](./security.md). For payment data flows, see [`payments.md`](./payments.md).*
