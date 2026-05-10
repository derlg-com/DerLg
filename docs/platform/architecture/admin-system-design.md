# System Admin Panel — Design Specification

> **Status:** Design Phase | **Date:** 2026-05-10 | **Author:** Senior Developer Review

## 1. Executive Summary

The DerLg System Admin Panel is a role-based administrative interface for managing the Cambodia travel booking platform. It is built as a `(admin)` route group within the existing Next.js frontend and communicates with dedicated NestJS admin controllers at `/v1/admin/*`.

### Scope

- **Transportation operations:** Drivers, vehicles, maintenance, Telegram Bot integration
- **Inventory management:** Hotels, rooms, tour guides
- **Booking operations:** View, modify, cancel, driver assignment
- **Customer support:** Profiles, loyalty points, reviews
- **Emergency response:** Real-time alert monitoring, location tracking, status lifecycle
- **Business intelligence:** Revenue analytics, booking statistics, performance metrics
- **Platform governance:** Admin user management, audit logging, data export, backup
- **Promotions:** Discount codes, student verification review

---

## 2. Architecture

### 2.1 System Context

```
┌──────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                          │
│  ┌────────────────────┐    ┌────────────────────┐            │
│  │  (app) Routes      │    │  (admin) Routes    │            │
│  │  Customer-facing   │    │  Admin panel       │            │
│  │  /home, /chat ...  │    │  /admin/*          │            │
│  └────────┬───────────┘    └────────┬───────────┘            │
│           │                         │                         │
└───────────┼─────────────────────────┼─────────────────────────┘
            │ HTTP REST               │ HTTP REST + WebSocket
            │                         │
┌───────────▼─────────────────────────▼─────────────────────────┐
│                     NestJS Backend                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ /v1/*        │  │ /v1/admin/*  │  │ /v1/telegram │        │
│  │ (public+user)│  │ (13 ctrls)   │  │ (webhook)    │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                  │                 │
│         └─────────────────┼──────────────────┘                 │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────┐   ┌──────────┐   ┌──────────────┐
     │ Supabase │   │  Redis   │   │ Telegram Bot │
     │  (PG)    │   │ (Pub/Sub)│   │  (external)  │
     └──────────┘   └──────────┘   └──────────────┘
```

### 2.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Admin panel as route group, not separate app | Shares auth, API client, i18n, component library; single deploy |
| All data via backend API, never direct DB | Consistent auth, audit logging, validation in one place |
| WebSocket for real-time, not polling | Driver status and emergencies need sub-5-second latency |
| Redis pub/sub as message bus | Decouples Telegram webhook from WebSocket broadcast |
| 4 admin roles with granular permissions | Fleet manager doesn't need customer data; support agent can't touch pricing |

---

## 3. Data Model

### 3.1 New Admin Tables

These extend the existing Prisma schema. Full schema in `backend/prisma/schema.prisma`.

#### `drivers`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default uuid |
| `driver_name` | VARCHAR(255) | NOT NULL |
| `driver_id` | VARCHAR(50) | UNIQUE, NOT NULL (e.g. "DLG-DRV-001") |
| `telegram_id` | VARCHAR(100) | UNIQUE, NOT NULL |
| `phone` | VARCHAR(20) | NOT NULL |
| `vehicle_id` | UUID | FK → `transportation_vehicles.id`, nullable |
| `status` | ENUM | AVAILABLE, BUSY, OFFLINE; default OFFLINE |
| `last_status_update` | TIMESTAMP | default now() |
| `created_at` | TIMESTAMP | default now() |
| `updated_at` | TIMESTAMP | auto-update |

Indexes: `(status)`, `(vehicle_id)`, `(telegram_id)`

#### `driver_assignments`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `driver_id` | UUID | FK → `drivers.id`, NOT NULL |
| `booking_id` | UUID | FK → `bookings.id`, NOT NULL |
| `vehicle_id` | UUID | FK → `transportation_vehicles.id`, NOT NULL |
| `assignment_timestamp` | TIMESTAMP | default now() |
| `completion_timestamp` | TIMESTAMP | nullable |
| `created_at` | TIMESTAMP | default now() |
| `updated_at` | TIMESTAMP | auto-update |

Indexes: `(driver_id)`, `(booking_id)`, `(driver_id, completion_timestamp)`

#### `vehicle_maintenance`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `vehicle_id` | UUID | FK → `transportation_vehicles.id`, NOT NULL |
| `maintenance_type` | VARCHAR(100) | NOT NULL |
| `scheduled_date` | DATE | NOT NULL |
| `completion_date` | DATE | nullable |
| `maintenance_cost` | DECIMAL(10,2) | nullable |
| `maintenance_notes` | TEXT | nullable |
| `status` | ENUM | SCHEDULED, IN_MAINTENANCE, COMPLETED; default SCHEDULED |
| `created_at` | TIMESTAMP | default now() |
| `updated_at` | TIMESTAMP | auto-update |

Indexes: `(vehicle_id)`, `(status)`, `(scheduled_date)`

#### `admin_users`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id`, UNIQUE, NOT NULL |
| `admin_role` | ENUM | SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER |
| `permissions` | JSONB | default '{}' (granular overrides) |
| `is_active` | BOOLEAN | default true |
| `created_at` | TIMESTAMP | default now() |
| `updated_at` | TIMESTAMP | auto-update |

Indexes: `(user_id)`, `(admin_role)`

#### `backups`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `backup_file_url` | TEXT | NOT NULL |
| `backup_size_bytes` | BIGINT | nullable |
| `created_by_admin_id` | UUID | FK → `users.id`, NOT NULL |
| `created_at` | TIMESTAMP | default now() |

Indexes: `(created_at)`

### 3.2 Existing Tables (leveraged by admin)

The admin module reads and writes to existing tables: `users`, `bookings`, `transportation_vehicles`, `hotels`, `hotel_rooms`, `guides`, `trips`, `payments`, `reviews`, `emergency_alerts`, `discount_codes`, `student_verifications`, `loyalty_transactions`, `audit_logs`, `ai_sessions`.

The `backups` table is new (see 3.1 above) but sits alongside these admin-specific tables.

### 3.3 Enums

```prisma
enum DriverStatus   { AVAILABLE BUSY OFFLINE }
enum MaintStatus    { SCHEDULED IN_MAINTENANCE COMPLETED }
enum AdminRole      { SUPER_ADMIN OPERATIONS_MANAGER SUPPORT_AGENT FLEET_MANAGER }
```

### 3.4 Entity Relationships

```
users ══1:1══ admin_users
users ══1:N══ bookings
users ══1:N══ emergency_alerts
users ══1:N══ reviews
users ══1:N══ loyalty_transactions
users ══1:N══ backups (created_by_admin_id)

drivers ══N:1══ transportation_vehicles
drivers ══1:N══ driver_assignments
driver_assignments ══N:1══ bookings
driver_assignments ══N:1══ transportation_vehicles

transportation_vehicles ══1:N══ vehicle_maintenance

bookings ══1:N══ payments
bookings ══N:1══ trips (optional, for PACKAGE type)
bookings ══N:1══ hotel_rooms (optional, for HOTEL type)
bookings ══N:1══ transportation_vehicles (optional, for TRANSPORT type)
bookings ══N:1══ guides (optional, for GUIDE type)
```

---

## 4. Authorization Model

### 4.1 Role Matrix

| Capability | SUPER_ADMIN | OPS_MANAGER | FLEET_MANAGER | SUPPORT_AGENT |
|------------|:-----------:|:-----------:|:-------------:|:-------------:|
| Dashboard view | full | full | fleet-only | bookings-only |
| Driver CRUD | yes | yes | yes * | no |
| Vehicle CRUD | yes | yes | yes * | no |
| Maintenance CRUD | yes | yes | yes * | no |
| Driver assignment | yes | yes | yes | no |
| Hotel/room CRUD | yes | yes | no | no |
| Guide CRUD | yes | yes | no | no |
| Booking view | yes | yes | no | yes |
| Booking modify/cancel | yes | yes | no | yes |
| Emergency respond | yes | yes | no | no |
| Customer view | yes | yes | no | yes |
| Loyalty adjust | yes | yes | no | no |
| Discount CRUD | yes | yes | no | no |
| Student verify | yes | yes | no | no |
| AI session view | yes | yes | no | no |
| Analytics | yes | yes | no | no |
| Admin user CRUD | yes | no | no | no |
| Audit log view | yes | no | no | no |
| Data export | yes | no | no | no |
| Backup | yes | no | no | no |

> \* **Known spec conflict:** Requirement 10.4 restricts FLEET_MANAGER to read-only (GET only) on drivers/vehicles/maintenance. However, Tasks 3.2, 4.2, 5.2, and 6.2 grant write access (POST/PATCH) to FLEET_MANAGER. The task-level assignments take precedence since they represent the implementation-level decision. Resolve with product owner before implementation.

### 4.2 Implementation

Two-layer guard system:

1. **`AdminGuard`** — Checks `user.role ∈ {ADMIN, SUPPORT}` on the JWT. Applied at the admin module level.
2. **`@AdminRoles()` decorator + `AdminRoleGuard`** — Checks `admin_users.admin_role` against the allowed list. Applied per-endpoint.

Permissions are cached in Redis (key `admin:permissions:{userId}`, TTL 5 min) to avoid querying `admin_users` on every request.

### 4.3 Token Lifecycle

- Access token: 15 min JWT in memory
- Refresh token: 7 days in `httpOnly Secure SameSite=Strict` cookie
- Auto-refresh via interceptor when 401 received
- Logout increments `users.token_version` → invalidates all tokens
- Deactivating admin sets `admin_users.is_active = false` **and** increments `token_version`

---

## 5. API Specification

### 5.1 Conventions

- Prefix: `/v1/admin`
- Auth: `Authorization: Bearer <JWT>`
- Envelope: `{ success: boolean, data: T, message?: string, error?: string }`
- Pagination: `?page=1&limit=20` → `{ data: T[], meta: { page, limit, total, totalPages } }`
- Filtering: query params (e.g., `?status=AVAILABLE&search=`)
- Sorting: `?sortBy=created_at&order=desc`

### 5.2 Endpoints

#### Dashboard

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/dashboard` | all | Aggregated KPIs: bookings today, revenue today, active drivers, 30-day trend, pending actions, recent emergencies, driver availability summary, upcoming bookings (24h) |

Response:
```json
{
  "total_bookings_today": 12,
  "total_revenue_today": 2450.00,
  "active_drivers_count": 8,
  "booking_trends": [{ "date": "2026-05-10", "count": 12 }, ...],
  "pending_actions": {
    "unassigned_bookings": 3,
    "upcoming_maintenance": 2,
    "pending_verifications": 5
  },
  "recent_emergencies": [{ "id": "...", "alert_type": "SOS", "user_name": "...", "time_since": "5m" }],
  "driver_summary": { "AVAILABLE": 5, "BUSY": 3, "OFFLINE": 2 },
  "upcoming_bookings": [{ "booking_ref": "DLG-2026-0012", "travel_date": "...", "customer_name": "..." }]
}
```

#### Drivers

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/drivers` | FLEET, OPS, SUPER | List with `?status=&search=&page=&limit=` |
| `GET` | `/v1/admin/drivers/:id` | FLEET, OPS, SUPER | Detail with vehicle, assignments, performance |
| `POST` | `/v1/admin/drivers` | FLEET, OPS, SUPER | Create driver profile |
| `PATCH` | `/v1/admin/drivers/:id` | FLEET, OPS, SUPER | Update driver (or deactivate: `{ status: "OFFLINE" }`) |

#### Vehicles

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/vehicles` | FLEET, OPS, SUPER | List with `?category=&tier=&search=` |
| `GET` | `/v1/admin/vehicles/:id` | FLEET, OPS, SUPER | Detail with assigned driver, maintenance status |
| `POST` | `/v1/admin/vehicles` | FLEET, OPS, SUPER | Create vehicle |
| `PATCH` | `/v1/admin/vehicles/:id` | FLEET, OPS, SUPER | Update vehicle |

#### Maintenance

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/maintenance` | FLEET, OPS, SUPER | List with `?vehicle_id=&start_date=&end_date=` |
| `GET` | `/v1/admin/maintenance/upcoming` | FLEET, OPS, SUPER | Maintenance due within 3 days |
| `POST` | `/v1/admin/maintenance` | FLEET, OPS, SUPER | Schedule maintenance |
| `PATCH` | `/v1/admin/maintenance/:id` | FLEET, OPS, SUPER | Update status/cost/notes |

#### Assignments

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/assignments` | FLEET, OPS, SUPER | List with `?driver_id=&booking_id=` |
| `POST` | `/v1/admin/assignments` | FLEET, OPS, SUPER | Assign driver to booking. Returns 409 if driver not AVAILABLE |
| `PATCH` | `/v1/admin/assignments/:id/complete` | FLEET, OPS, SUPER | Complete assignment, free driver |

#### Bookings

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/bookings` | SUPPORT, OPS, SUPER | List with `?booking_type=&status=&start_date=&end_date=&search=&ai_assisted=` |
| `GET` | `/v1/admin/bookings/:id` | SUPPORT, OPS, SUPER | Full detail: trip/hotel/vehicle/guide + payment history + driver assignment |
| `PATCH` | `/v1/admin/bookings/:id` | SUPPORT, OPS, SUPER | Modify travel_date, end_date, num_adults, num_children, customizations |
| `POST` | `/v1/admin/bookings/:id/cancel` | SUPPORT, OPS, SUPER | Cancel booking, process refund, release resources |

#### Hotels

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/hotels` | OPS, SUPER | List with pagination |
| `GET` | `/v1/admin/hotels/:id` | OPS, SUPER | Detail with rooms |
| `POST` | `/v1/admin/hotels` | OPS, SUPER | Create hotel |
| `PATCH` | `/v1/admin/hotels/:id` | OPS, SUPER | Update hotel |
| `GET` | `/v1/admin/hotels/:id/rooms` | OPS, SUPER | List rooms |
| `POST` | `/v1/admin/hotels/:id/rooms` | OPS, SUPER | Add room |
| `PATCH` | `/v1/admin/hotels/:hotelId/rooms/:roomId` | OPS, SUPER | Update room |

#### Guides

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/guides` | OPS, SUPER | List with `?languages=&specialties=` |
| `GET` | `/v1/admin/guides/:id` | OPS, SUPER | Detail with assignments and performance |
| `POST` | `/v1/admin/guides` | OPS, SUPER | Create guide |
| `PATCH` | `/v1/admin/guides/:id` | OPS, SUPER | Update guide |

#### Emergency

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/emergency` | OPS, SUPER | List with `?status=&alert_type=` |
| `GET` | `/v1/admin/emergency/:id` | OPS, SUPER | Detail with user contact, booking, location, driver info |
| `PATCH` | `/v1/admin/emergency/:id` | OPS, SUPER | Acknowledge or resolve with notes |

#### Customers

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/customers` | SUPPORT, OPS, SUPER | List with `?search=&page=&limit=` (search by name/email/phone) |
| `GET` | `/v1/admin/customers/:id` | SUPPORT, OPS, SUPER | Profile + booking history + loyalty + reviews + emergencies |
| `POST` | `/v1/admin/loyalty/adjust` | OPS, SUPER | Adjust loyalty points (`{ user_id, points, description }`) |

#### Discounts & Student Verification

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/discounts` | OPS, SUPER | List discount codes |
| `POST` | `/v1/admin/discounts` | OPS, SUPER | Create discount code |
| `PATCH` | `/v1/admin/discounts/:id` | OPS, SUPER | Update or deactivate (`{ is_active: false }`) |
| `GET` | `/v1/admin/student-verifications` | OPS, SUPER | List with `?status=` filter |
| `PATCH` | `/v1/admin/student-verifications/:id` | OPS, SUPER | Approve (`{ status: "APPROVED" }`) or reject with reason |

#### Analytics

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/analytics/revenue` | SUPER, OPS | Revenue by booking_type, `?start_date=&end_date=` |
| `GET` | `/v1/admin/analytics/bookings` | SUPER, OPS | Counts by status, cancellation rate |
| `GET` | `/v1/admin/analytics/drivers` | SUPER, OPS | Driver performance: trips, avg rating |
| `GET` | `/v1/admin/analytics/ai-bookings` | SUPER, OPS | AI-assisted booking success rate |
| `GET` | `/v1/admin/analytics/ai-performance` | SUPER, OPS | AI booking time, satisfaction from reviews |
| `GET` | `/v1/admin/analytics/export` | SUPER | `?format=csv&metric=revenue&start_date=&end_date=` |

#### Admin Users

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/users` | SUPER | List admin users |
| `POST` | `/v1/admin/users` | SUPER | Create admin user (creates `users` + `admin_users` record) |
| `PATCH` | `/v1/admin/users/:id` | SUPER | Update role, permissions, or deactivate |

#### Audit Logs

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/audit-logs` | SUPER | List with `?start_date=&end_date=&admin_user_id=&action_type=` |
| `GET` | `/v1/admin/audit-logs/export` | SUPER | Export as CSV |

#### Data Export & Backup

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/export/bookings` | SUPER | `?start_date=&end_date=&format=csv` |
| `GET` | `/v1/admin/export/drivers` | SUPER | Driver data + performance |
| `GET` | `/v1/admin/export/payments` | SUPER | Encrypted financial export |
| `POST` | `/v1/admin/backup` | SUPER | Trigger Supabase DB dump |
| `GET` | `/v1/admin/backups` | SUPER | List backups with download links |

#### AI Monitoring

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/admin/ai-sessions/:sessionId` | OPS, SUPER | Retrieve AI conversation from Redis (7-day TTL) |

### 5.3 Telegram Webhook (separate module)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/telegram/driver-status` | Webhook secret | `{ telegram_id, vehicle_id, driver_name, status }` — updates/creates driver, publishes to Redis |

### 5.4 Backend Module Structure

```
backend/src/
├── admin/
│   ├── admin.module.ts
│   ├── controllers/
│   │   ├── admin-dashboard.controller.ts
│   │   ├── admin-drivers.controller.ts
│   │   ├── admin-vehicles.controller.ts
│   │   ├── admin-maintenance.controller.ts
│   │   ├── admin-assignments.controller.ts
│   │   ├── admin-bookings.controller.ts
│   │   ├── admin-hotels.controller.ts
│   │   ├── admin-guides.controller.ts
│   │   ├── admin-emergency.controller.ts
│   │   ├── admin-customers.controller.ts
│   │   ├── admin-discounts.controller.ts
│   │   ├── admin-analytics.controller.ts
│   │   ├── admin-users.controller.ts
│   │   ├── admin-audit.controller.ts
│   │   ├── admin-export.controller.ts
│   │   └── admin-ai-monitoring.controller.ts
│   ├── services/
│   │   ├── admin-dashboard.service.ts
│   │   ├── admin-drivers.service.ts
│   │   ├── admin-vehicles.service.ts
│   │   ├── admin-maintenance.service.ts
│   │   ├── admin-assignments.service.ts
│   │   ├── admin-bookings.service.ts
│   │   ├── admin-hotels.service.ts
│   │   ├── admin-guides.service.ts
│   │   ├── admin-emergency.service.ts
│   │   ├── admin-customers.service.ts
│   │   ├── admin-discounts.service.ts
│   │   ├── admin-analytics.service.ts
│   │   ├── admin-users.service.ts
│   │   ├── admin-audit.service.ts
│   │   ├── admin-export.service.ts
│   │   └── admin-ai-monitoring.service.ts
│   ├── dto/
│   │   ├── create-driver.dto.ts
│   │   ├── update-driver.dto.ts
│   │   ├── create-vehicle.dto.ts
│   │   ├── update-vehicle.dto.ts
│   │   ├── schedule-maintenance.dto.ts
│   │   ├── update-maintenance.dto.ts
│   │   ├── assign-driver.dto.ts
│   │   ├── update-booking.dto.ts
│   │   ├── create-hotel.dto.ts
│   │   ├── update-hotel.dto.ts
│   │   ├── create-room.dto.ts
│   │   ├── update-room.dto.ts
│   │   ├── create-guide.dto.ts
│   │   ├── update-guide.dto.ts
│   │   ├── update-emergency.dto.ts
│   │   ├── adjust-loyalty.dto.ts
│   │   ├── create-discount.dto.ts
│   │   ├── update-discount.dto.ts
│   │   ├── review-student-verification.dto.ts
│   │   ├── create-admin-user.dto.ts
│   │   ├── update-admin-user.dto.ts
│   │   ├── export-request.dto.ts
│   │   └── dashboard-overview.dto.ts
│   ├── guards/
│   │   └── admin-role.guard.ts
│   ├── interceptors/
│   │   └── audit-log.interceptor.ts
│   └── websocket/
│       └── admin.gateway.ts
├── telegram/
│   ├── telegram.module.ts
│   ├── telegram.controller.ts
│   └── telegram.service.ts
└── common/
    ├── decorators/
    │   └── admin-roles.decorator.ts
    └── dto/
        └── driver-status-webhook.dto.ts
```

This structure matches the design.md spec exactly, plus the two additional controllers/services revealed during cross-check: AdminExportController/Service and AdminAIMonitoringController/Service.

---

## 6. Real-Time Architecture

### 6.1 Event Flow

```
Telegram Bot ──POST──► /v1/telegram/driver-status
                            │
                            ▼
                    TelegramService
                      │         │
                      ▼         ▼
                  UPDATE      Redis.publish(
                  drivers     "driver_status_changed:{id}",
                    │         { driver_id, status, timestamp })
                    │              │
                    │              ▼
                    │        AdminGateway (WebSocket)
                    │         broadcasts to connected
                    │         admin clients by role
                    │
                    ▼
              audit_logs INSERT
```

### 6.2 Redis Channels

| Channel | Publisher | Subscribers | Payload |
|---------|-----------|-------------|---------|
| `driver_status_changed:{driver_id}` | TelegramService, AdminAssignmentsService | AdminGateway | `{ driver_id, status, timestamp }` |
| `admin_events` | BookingService, PaymentService | AdminGateway | `{ type: "BOOKING_CREATED", booking_id, booking_ref, timestamp }` |
| `emergency_alerts` | EmergencyService | AdminGateway | `{ alert_id, alert_type, user_id, lat, lng, timestamp }` |
| `driver_assignments` | AdminAssignmentsService | AdminGateway | `{ assignment_id, driver_id, booking_id, timestamp }` |

### 6.3 WebSocket Protocol

Connection: `wss://api.derlg.com/v1/admin/ws?token=<JWT>`

Server → Client messages:
```json
{ "event": "DRIVER_STATUS_UPDATE", "data": { "driver_id": "...", "status": "AVAILABLE", "timestamp": "..." } }
{ "event": "BOOKING_CREATED", "data": { "booking_id": "...", "booking_ref": "DLG-2026-0015", "booking_type": "PACKAGE" } }
{ "event": "EMERGENCY_ALERT", "data": { "alert_id": "...", "alert_type": "SOS", "user_name": "...", "lat": 13.4, "lng": 103.8 } }
{ "event": "DRIVER_ASSIGNMENT", "data": { "assignment_id": "...", "driver_id": "...", "booking_id": "..." } }
```

Reconnection: Exponential backoff (10s, 20s, 40s, max 60s). Connection status indicator in admin top bar.

---

## 7. Frontend Architecture

### 7.1 Route Structure

```
frontend/app/(admin)/
├── layout.tsx                        # AdminLayout: sidebar + topbar + WebSocket provider
├── admin/
│   ├── dashboard/page.tsx            # GET /v1/admin/dashboard
│   ├── drivers/
│   │   ├── page.tsx                  # DriverList
│   │   └── [id]/page.tsx             # DriverDetailView
│   ├── vehicles/
│   │   ├── page.tsx                  # VehicleList + MaintenanceScheduler
│   │   └── [id]/page.tsx             # VehicleDetail + MaintenanceHistory
│   ├── bookings/
│   │   ├── page.tsx                  # BookingList
│   │   └── [id]/page.tsx             # BookingDetailView + DriverAssignmentPanel
│   ├── hotels/
│   │   ├── page.tsx                  # HotelList
│   │   ├── [id]/page.tsx             # HotelDetail
│   │   └── [id]/rooms/page.tsx       # RoomManagement
│   ├── guides/
│   │   ├── page.tsx                  # GuideList
│   │   └── [id]/page.tsx             # GuideDetailView
│   ├── emergency/
│   │   ├── page.tsx                  # EmergencyAlertList
│   │   └── [id]/page.tsx             # EmergencyDetailView + EmergencyMap
│   ├── customers/
│   │   ├── page.tsx                  # CustomerList
│   │   └── [id]/page.tsx             # CustomerProfileView
│   ├── discounts/
│   │   ├── page.tsx                  # DiscountCodeList
│   │   └── student-verifications/
│   │       └── page.tsx              # StudentVerificationQueue
│   ├── analytics/page.tsx            # AnalyticsDashboard
│   ├── users/page.tsx                # AdminUserList (SUPER_ADMIN only)
│   └── audit-logs/page.tsx           # AuditLogViewer (SUPER_ADMIN only)
```

### 7.2 Component Tree (40+ components)

```
AdminLayout
├── AdminSidebar (role-filtered nav items)
├── TopBar
│   ├── ConnectionIndicator (WebSocket status)
│   ├── LanguageSelector
│   └── NotificationBell (unread badge + dropdown)
├── DashboardOverview
│   ├── MetricCard × N
│   └── BookingTrendChart (recharts LineChart)
├── DriverList → DataTable + FilterDropdown + SearchInput
│   └── DriverStatusBadge (green/yellow/gray, pulse animation)
├── DriverForm (React Hook Form + Zod)
├── DriverDetailView → assignment history, performance metrics
├── VehicleList → DataTable + filter by category/tier
├── VehicleForm (image upload via Supabase Storage)
├── MaintenanceScheduler (calendar + form)
├── MaintenanceHistory (table with cost sum)
├── BookingList → DataTable + AI-assisted flag
├── BookingDetailView
│   ├── DriverAssignmentPanel (available driver dropdown)
│   └── BookingModificationForm
├── HotelList → DataTable
├── HotelForm (Leaflet.js location picker)
├── RoomManagement → RoomForm
├── GuideList → DataTable + language/specialty filters
├── GuideForm (multi-select for languages/specialties)
├── GuideDetailView → availability calendar
├── EmergencyAlertList (urgent styling for SENT, sound alert)
├── EmergencyDetailView
│   └── EmergencyMap (Leaflet.js with marker)
├── CustomerList → DataTable + search
├── CustomerProfileView → booking history, loyalty tx, reviews
├── DiscountCodeList → DataTable
├── DiscountCodeForm
├── StudentVerificationQueue
├── StudentVerificationReview (side-by-side image comparison)
├── AnalyticsDashboard
│   ├── RevenueChart (recharts BarChart)
│   └── PerformanceMetrics (sortable table)
├── AdminUserList → DataTable (SUPER_ADMIN only)
├── AdminUserForm
├── AuditLogViewer → DataTable + expandable JSON rows
├── DataTable (shared, with sorting/filtering/pagination)
├── SearchInput (shared, debounced)
├── FilterDropdown (shared, multi-select)
├── ConfirmDialog (shared, shadcn/ui AlertDialog)
└── ImageUpload (shared, Supabase Storage, preview + progress)
```

### 7.3 State Management

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Zustand Stores │    │  React Query     │    │  WebSocket      │
│  (client state) │    │  (server state)  │    │  (real-time)    │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ auth store      │    │ useDashboard()   │    │ useAdminWS()    │
│ - user          │    │ useDrivers()     │    │ - connection    │
│ - adminRole     │    │ useVehicles()    │    │ - subscribe     │
│ - permissions   │    │ useBookings()    │    │ - reconnect     │
│                 │    │ useHotels()      │    │                 │
│ language store  │    │ useGuides()      │    │ on message:     │
│ - locale        │    │ useEmergency()   │    │ → invalidate RQ │
│                 │    │ useCustomers()   │    │ → update store  │
│ notification    │    │ useAnalytics()   │    │                 │
│ store           │    │ useAuditLogs()   │    │                 │
│ - items[]       │    │ ...              │    │                 │
│ - unreadCount   │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 8. Audit Logging

Every admin action writes to `audit_logs`:

| Field | Example |
|-------|---------|
| `admin_user_id` | UUID of the admin who acted |
| `action_type` | `DRIVER_ASSIGNMENT`, `BOOKING_MODIFICATION`, `PRICING_CHANGE`, `USER_ROLE_CHANGE`, `DRIVER_STATUS_UPDATE`, `EMERGENCY_RESPONSE`, `STUDENT_VERIFICATION`, `LOYALTY_ADJUSTMENT`, `DISCOUNT_CODE_CHANGE` |
| `affected_resource_id` | UUID of the modified entity |
| `resource_type` | `DRIVER`, `BOOKING`, `VEHICLE`, `HOTEL`, `GUIDE`, `USER`, `EMERGENCY`, `DISCOUNT` |
| `changed_fields` | JSON diff: `{ "status": { "old": "AVAILABLE", "new": "BUSY" } }` |
| `timestamp` | Server timestamp |

Implemented via a NestJS interceptor at the controller level, not scattered in services. Retention: 365 days minimum, no automatic deletion.

---

## 9. Implementation Sequencing

Given the project is in early scaffolding, the admin panel depends on core infrastructure being built first.

### Phase 0: Foundation (prerequisites)

1. Prisma schema with all 18 base models + 5 admin models (drivers, driver_assignments, vehicle_maintenance, admin_users, backups)
2. Auth module (JWT, refresh tokens, guards)
3. Users module (profile, roles)
4. Common module (decorators, interceptors, filters, pipes)

### Phase 1: Admin Core (this design)

1. **Database migration** — Run migration for `drivers`, `driver_assignments`, `vehicle_maintenance`, `admin_users`
2. **Admin module scaffold** — Module, AdminRoleGuard, @AdminRoles decorator
3. **Dashboard endpoint** — Single aggregation endpoint for the overview

### Phase 2: Transportation Operations

4. Drivers CRUD + Telegram webhook
5. Vehicles CRUD + maintenance scheduling
6. Driver assignments (depends on bookings existing)
7. WebSocket gateway + Redis pub/sub

### Phase 3: Inventory Management

8. Hotels & rooms CRUD
9. Guides CRUD

### Phase 4: Operations

10. Booking admin endpoints (view, modify, cancel)
11. Emergency management
12. Customer support (view profiles, adjust loyalty)
13. Discount codes + student verifications

### Phase 5: Intelligence & Governance

14. Analytics endpoints
15. Admin user management
16. Audit log viewer
17. Data export & backup

### Phase 6: Frontend (in parallel with backend)

18. Admin layout + sidebar + auth protection
19. Dashboard page
20. Driver + vehicle pages
21. Booking pages
22. Hotel + guide pages
23. Emergency pages
24. Customer + discount pages
25. Analytics + users + audit pages
26. WebSocket hook + real-time integration
27. i18n translation files (EN/ZH/KM)
28. Shared components (DataTable, SearchInput, etc.)

### Phase 7: Quality

29. Backend unit tests (Jest + mocked Prisma)
30. Backend E2E tests (supertest)
31. Frontend component tests (React Testing Library)
32. Integration tests for critical flows (driver assignment, emergency response)

---

## 10. Security Considerations

1. **All admin endpoints behind JWT + AdminRoleGuard** — Never expose raw database access
2. **Rate limiting** — 100 req/min per admin IP (higher than public endpoints)
3. **Audit trail** — Every mutation logged; logs are append-only
4. **Token invalidation** — Immediate via `token_version` increment on deactivation
5. **CORS** — Admin panel origin explicitly whitelisted
6. **WebSocket auth** — JWT validated on connection upgrade; connections dropped on token expiry
7. **Export encryption** — CSV exports containing PII (email, phone) encrypted with AES-256
8. **Telegram webhook** — Signature verification if Telegram Bot provides it; rate-limited separately
9. **No direct DB access from frontend** — All mutations go through backend, ensuring consistent validation and audit logging

---

## 11. Validation Checklist

- [ ] All 20 requirements from `requirements.md` are addressed
- [ ] Role matrix covers every endpoint and UI component
- [ ] Database schema has proper indexes for admin queries
- [ ] WebSocket reconnection handles network partitions gracefully
- [ ] Audit log is append-only and retained 365+ days
- [ ] Emergency alert flow delivers notification within 5 seconds
- [ ] Driver assignment prevents double-booking (status check + transaction)
- [ ] Maintenance schedule prevents assigning vehicles in maintenance
- [ ] Export files are encrypted when containing PII
- [ ] i18n covers EN, ZH, KM for all admin UI strings

---

## 12. References

### Specification Files

These four files define the full admin system specification. Use them according to the workflow in `Prompt.Format.md`:

| File | Purpose |
|------|---------|
| `.kiro/specs/system-admin-panel/requirements.md` | 20 requirements with numbered acceptance criteria (1.1–20.7) |
| `.kiro/specs/system-admin-panel/design.md` | Visual/interaction intent — component specs, route trees, module structure |
| `.kiro/specs/system-admin-panel/tasks.md` | 39 implementation tasks, each referencing requirement IDs |
| `.kiro/specs/system-admin-panel/admin.all.combination.task.md` | All three merged inline — each task with its requirements, design patterns, and verification checklist |

### How to Use These Files

1. Read the task from `admin.all.combination.task.md`
2. Cross-reference the requirement IDs listed in the task
3. Check the design file for visual context
4. Implement the code
5. Mark the task complete (`[ ]` → `[x]`)

Each task includes a verification checklist:
- All referenced acceptance criteria satisfied
- Design patterns followed (file structure, naming, tech stack)
- Sub-steps completed with tests passing
- No extra features beyond current task scope

### Other References

- Product requirements: `docs/product/prd.md`
- Feature registry: `docs/product/feature-decisions.md`
- System architecture: `docs/platform/architecture/system-overview.md`
- Project conventions: `AGENTS.md`
- Tech stack decisions: `.kiro/steering/tech.md`
- Planned directory structure: `.kiro/steering/structure.md`