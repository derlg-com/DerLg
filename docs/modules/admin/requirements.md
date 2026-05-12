# Admin Dashboard — Requirements

> **Feature ID:** F20–F29  
> **Status:** Planned  
> **Scope:** v2.0 (MVP scaffolding for key endpoints)  
> **Priority:** P1

---

## Overview

The Admin Dashboard module provides a comprehensive back-office interface for managing the DerLg travel booking platform. It covers fleet management (drivers, vehicles, maintenance), booking operations, customer support, content management (hotels, guides), emergency monitoring, loyalty administration, analytics, and platform governance (admin users, audit logs, backups, exports).

**Design principle:** The API follows a micro-endpoint philosophy — each endpoint returns a single, focused data shape. The admin dashboard frontend composes 8–10 parallel requests via React Query to build dashboard views, rather than relying on monolithic "dashboard" endpoints.

---

## Role-Based Access Matrix

| Role | Description | Access Level |
|------|-------------|--------------|
| `SUPER_ADMIN` | Platform owner | Full access: admin users, audit logs, exports, backups |
| `OPERATIONS_MANAGER` | Day-to-day operations | Bookings, assignments, drivers, vehicles, maintenance, emergency, customers, analytics |
| `FLEET_MANAGER` | Fleet & logistics | Drivers, vehicles, maintenance, assignments |
| `SUPPORT_AGENT` | Customer support | Customers, bookings (view/modify), emergency, student verifications, AI sessions |

All admin endpoints require Bearer JWT authentication. The Telegram webhook uses a separate `X-Webhook-Secret` shared-secret scheme.

---

## Functional Requirements

### F20 — Fleet Management (Drivers, Vehicles, Maintenance)

#### Drivers

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F20-01 | As a fleet manager, I want to list all drivers so that I can monitor my fleet. | AC1: Paginated list with status filter (AVAILABLE, BUSY, OFFLINE). AC2: Search by `driver_name` or `driver_id`. AC3: Default pagination: 20 items/page. |
| US-F20-02 | As a fleet manager, I want to see driver counts by status on the dashboard so that I can assess fleet availability at a glance. | AC1: `GET /admin/drivers/count?status={status}` returns a single integer. AC2: Omitting status returns total count. AC3: Response time < 100ms (cached). |
| US-F20-03 | As a fleet manager, I want to view a driver's full profile so that I can see their vehicle and recent assignments. | AC1: Detail endpoint returns driver, assigned vehicle, and recent assignment history. AC2: Vehicle shown as brief object (`VehicleBrief`). |
| US-F20-04 | As a fleet manager, I want to add a new driver so that they can receive assignments. | AC1: Required fields: `driver_name`, `driver_id` (e.g., "DLG-DRV-001"), `telegram_id`, `phone`. AC2: Optional: `vehicle_id`. AC3: `driver_id` max length 50, `phone` max 20. |
| US-F20-05 | As a fleet manager, I want to update a driver's details or reassign their vehicle so that records stay current. | AC1: Updatable: name, phone, vehicle, status. AC2: Status changes trigger availability validation. |

#### Vehicles

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F20-06 | As a fleet manager, I want to list all vehicles so that I can manage fleet inventory. | AC1: Filter by category (VAN, BUS, TUK_TUK) and tier (STANDARD, VIP). AC2: Search by name. |
| US-F20-07 | As a fleet manager, I want to add a new vehicle so that it can be assigned to bookings. | AC1: Required: `name`, `category`, `capacity`, `tier`, `price_per_day`. AC2: Optional: `price_per_km`, `features[]`, `images[]`. |
| US-F20-08 | As a fleet manager, I want to view vehicle details so that I can see assigned driver and maintenance status. | AC1: Detail includes driver assignment and active/upcoming maintenance records. |

#### Maintenance

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F20-09 | As a fleet manager, I want to schedule vehicle maintenance so that fleet health is maintained. | AC1: Required: `vehicle_id`, `maintenance_type`, `scheduled_date`. AC2: Optional notes. |
| US-F20-10 | As a fleet manager, I want to see upcoming maintenance due within 3 days so that I can plan proactively. | AC1: Lightweight endpoint for dashboard pending-actions card. AC2: Returns records where `scheduled_date <= now + 3 days`. AC3: Sorted by scheduled_date ascending. |
| US-F20-11 | As a fleet manager, I want to update maintenance status when work starts or completes so that records are accurate. | AC1: Updatable: status (SCHEDULED → IN_MAINTENANCE → COMPLETED), completion_date, cost, notes. |

---

### F21 — Driver-to-Booking Assignments

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F21-01 | As an operations manager, I want to assign a driver to a booking so that transportation is fulfilled. | AC1: Required: `driver_id`, `booking_id`, `vehicle_id`. AC2: Validates driver status is AVAILABLE. AC3: Validates vehicle capacity >= booking passenger count. AC4: Returns 409 Conflict if driver not available. AC5: On success, driver status transitions to BUSY. |
| US-F21-02 | As an operations manager, I want to mark an assignment as complete so that the driver becomes available again. | AC1: Sets `completion_timestamp`. AC2: Frees driver (status → AVAILABLE). AC3: Frees vehicle for next assignment. |
| US-F21-03 | As an operations manager, I want to view active assignments so that I can track ongoing trips. | AC1: Filter by `driver_id`, `booking_id`, or `active=true`. AC2: Active filter shows only uncompleted assignments. |

---

### F22 — Booking Operations & Dashboard Stats

#### Booking Management

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F22-01 | As an operations manager, I want to list bookings with flexible filters so that I can find specific reservations. | AC1: Filter by: `booking_type` (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY), `status`, date range, `ai_assisted`, `unassigned`. AC2: Search by `booking_ref` or customer email. AC3: Default pagination: 20/page. |
| US-F22-02 | As an operations manager, I want to view a booking's full details so that I can handle customer inquiries. | AC1: Returns booking, payment history, and driver assignment. AC2: Links to customer profile and assigned driver. |
| US-F22-03 | As an operations manager, I want to modify a booking so that I can accommodate customer changes. | AC1: Updatable: travel dates, passenger counts, customizations (JSONB). AC2: Audit log entry created for each modification. |
| US-F22-04 | As an operations manager, I want to cancel a booking so that I can process refunds and free resources. | AC1: Processes tiered refund based on cancellation policy. AC2: Releases assigned driver/vehicle. AC3: Updates booking status to CANCELLED. AC4: Triggers customer notification. |

#### Dashboard KPI Endpoints

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F22-05 | As an operations manager, I want to see today's booking count on the dashboard so that I can track daily volume. | AC1: `GET /admin/bookings/today-count` returns `{ count: N }`. AC2: "Today" is server-local date (Asia/Phnom_Penh). |
| US-F22-06 | As an operations manager, I want to see today's confirmed revenue so that I can track daily earnings. | AC1: Returns `{ total_usd, total_khr }`. AC2: Sums only confirmed/completed bookings created today. |
| US-F22-07 | As an operations manager, I want to see booking trends over time so that I can identify patterns. | AC1: `GET /admin/bookings/trend?days=30` returns array of `{ date, count }`. AC2: Default 30 days, inclusive. AC3: Zero-fill dates with no bookings. |

---

### F23 — Hotel & Room Inventory

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F23-01 | As an operations manager, I want to list hotels so that I can manage inventory. | AC1: Search by name. AC2: Paginated, 20/page default. |
| US-F23-02 | As an operations manager, I want to add a new hotel so that it appears in search results. | AC1: Required: `name`, `description`, `location` (lat, lng, address, province). AC2: Optional: images, rating, amenities, check-in/out times, cancellation policy. |
| US-F23-03 | As an operations manager, I want to view a hotel's details so that I can see its rooms and status. | AC1: Includes nested room list. |
| US-F23-04 | As an operations manager, I want to add rooms to a hotel so that guests can book them. | AC1: Required: `name`, `capacity`, `price_per_night`. AC2: Optional: description, images, amenities. |
| US-F23-05 | As an operations manager, I want to update room details so that pricing and availability stay current. | AC1: Any room field is updatable. |

---

### F24 — Tour Guide Management

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F24-01 | As an operations manager, I want to list tour guides so that I can manage guide assignments. | AC1: Filter by languages (comma-separated codes) and specialties (comma-separated). AC2: Paginated, 20/page default. |
| US-F24-02 | As an operations manager, I want to add a new guide so that they can be booked. | AC1: Required: `name`, `price_per_day`. AC2: Optional: bio, photo, languages[], specialties[], experience_years, certifications[], price_per_hour. |
| US-F24-03 | As an operations manager, I want to view a guide's profile so that I can assess their performance. | AC1: Includes assignment history and performance metrics (rating, trip count). |

---

### F25 — Emergency Alert Monitoring

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F25-01 | As a support agent, I want to see all emergency alerts so that I can respond to traveler emergencies. | AC1: Filter by `status` (SENT, ACKNOWLEDGED, RESOLVED) and `alert_type` (SOS, MEDICAL, THEFT, LOST). AC2: Paginated, 20/page default. |
| US-F25-02 | As a support agent, I want to view an emergency alert's full details so that I can coordinate response. | AC1: Includes user contact, associated booking, location (lat/lng), and assigned driver info. AC2: Real-time location if available. |
| US-F25-03 | As a support agent, I want to acknowledge or resolve an emergency so that the response is tracked. | AC1: Updatable: status (ACKNOWLEDGED, RESOLVED), resolution_notes. AC2: Resolution triggers customer notification. AC3: Audit log entry created. |

---

### F26 — Customer Management

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F26-01 | As a support agent, I want to list customers so that I can look up traveler accounts. | AC1: Search by name, email, or phone. AC2: Paginated, 20/page default. |
| US-F26-02 | As a support agent, I want to view a customer's full profile so that I can assist them. | AC1: Returns profile data. AC2: Frontend composes with parallel calls to booking history and loyalty transactions. |

---

### F27 — Loyalty & Discount Administration

#### Loyalty Points

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F27-01 | As an operations manager, I want to manually adjust a customer's loyalty points so that I can correct errors or grant bonuses. | AC1: Required: `user_id`, `points` (positive or negative integer), `description`. AC2: Creates audit log entry. AC3: Triggers customer notification. |
| US-F27-02 | As a support agent, I want to view a customer's loyalty transaction history so that I can answer inquiries. | AC1: Filter by `type` (EARNED, REDEEMED, ADJUSTED). AC2: Chronological order, newest first. |

#### Discount Codes

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F27-03 | As an operations manager, I want to create discount codes so that I can run promotions. | AC1: Required: `code`, `discount_percentage` (1–100), `valid_from`, `valid_until`. AC2: Optional: `max_usage`. AC3: Code is unique (case-insensitive). |
| US-F27-04 | As an operations manager, I want to update or deactivate discount codes so that I can manage campaigns. | AC1: Updatable: `is_active`, `max_usage`, `discount_percentage`. |

---

### F28 — Student Verification Review

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F28-01 | As a support agent, I want to view pending student verification requests so that I can review them. | AC1: Filter by `status` (PENDING, APPROVED, REJECTED). AC2: Default shows PENDING first. |
| US-F28-02 | As a support agent, I want to approve or reject student verifications so that eligible travelers receive discounts. | AC1: Required: `status` (APPROVED or REJECTED). AC2: If REJECTED, `rejection_reason` is required. AC3: On approval, applies student discount flag to user profile. AC4: Triggers email notification to user. |

---

### F29 — Analytics & Reporting

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F29-01 | As an operations manager, I want to see revenue broken down by booking type so that I can understand revenue mix. | AC1: Date range filter. AC2: Returns revenue per booking type (PACKAGE, HOTEL_ONLY, etc.). |
| US-F29-02 | As an operations manager, I want booking statistics so that I can monitor conversion and cancellation rates. | AC1: Counts by status + cancellation rate percentage. AC2: Date range filter. |
| US-F29-03 | As an operations manager, I want driver performance metrics so that I can identify top performers. | AC1: Total trips and average rating per driver. AC2: Sortable by trip count or rating. |
| US-F29-04 | As an operations manager, I want to see popular destinations so that I can adjust inventory and marketing. | AC1: Top N destinations by booking count. AC2: Default limit = 10, configurable. |
| US-F29-05 | As an operations manager, I want hotel occupancy rates so that I can manage pricing and availability. | AC1: Date range filter. AC2: Returns occupancy percentage per hotel or aggregated. |
| US-F29-06 | As an operations manager, I want guide utilization rates so that I can optimize guide scheduling. | AC1: Date range filter. AC2: Returns utilization percentage (booked days / available days). |
| US-F29-07 | As an operations manager, I want to track AI-assisted booking success rates so that I can measure the AI feature's impact. | AC1: Returns: total AI-assisted bookings, conversion rate, average booking value. |

---

### F30 — Platform Governance (SUPER_ADMIN Only)

#### Admin User Management

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F30-01 | As a super admin, I want to list admin users so that I can audit platform access. | AC1: Returns all admin accounts with roles and active status. |
| US-F30-02 | As a super admin, I want to create admin users so that I can grant platform access. | AC1: Required: `email`, `name`, `admin_role`. AC2: Optional: custom `permissions` object. AC3: Email must be unique. AC4: Welcome email sent with temporary password setup link. |
| US-F30-03 | As a super admin, I want to update admin roles or deactivate accounts so that I can manage access lifecycle. | AC1: Updatable: `admin_role`, `permissions`, `is_active`. AC2: Deactivation immediately revokes JWT access (blacklist or short expiry). |

#### Audit Logs

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F30-04 | As a super admin, I want to view audit logs so that I can trace admin actions. | AC1: Filter by date range, `admin_user_id`, `action_type`. AC2: Paginated, 50/page default (more than standard). AC3: Immutable records — no delete or modify API. |
| US-F30-05 | As a super admin, I want to export audit logs as CSV so that I can perform offline analysis. | AC1: Date range filter. AC2: CSV download with standard columns: timestamp, admin, action, entity, entity_id, details. |

#### Data Export

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F30-06 | As a super admin, I want to export bookings data so that I can perform external analysis. | AC1: Date range filter. AC2: Format: CSV or JSON. AC3: CSV default. |
| US-F30-07 | As a super admin, I want to export driver performance data so that I can analyze fleet efficiency. | AC1: Includes all driver metrics in a single export. |
| US-F30-08 | As a super admin, I want to export payment data so that I can reconcile with Stripe. | AC1: Date range filter. AC2: Export is encrypted (password-protected ZIP or GPG). AC3: Contains sensitive payment data — handled per PCI compliance. |

#### Backups

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F30-09 | As a super admin, I want to list available database backups so that I can verify backup health. | AC1: Returns backup list with timestamps, sizes, and download links (signed URLs). |
| US-F30-10 | As a super admin, I want to trigger a database backup so that I can create on-demand snapshots. | AC1: Creates Supabase database dump. AC2: Stores in Supabase Storage with date-stamped filename. AC3: Returns 202 Accepted (async operation). AC4: Backup completes within 5 minutes for typical database size. |

---

### F31 — AI Session Review & Telegram Integration

#### AI Sessions

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F31-01 | As a support agent, I want to view a customer's AI chat history so that I can understand their booking intent. | AC1: Fetches conversation from Redis (7-day TTL). AC2: Returns "Session expired" if not found. AC3: Read-only — no modification. |

#### Telegram Driver Status Webhook

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F31-02 | As a system, I want to receive driver status updates from a Telegram Bot so that drivers can update availability without the mobile app. | AC1: Endpoint: `POST /telegram/driver-status` (not under `/admin`). AC2: Auth: `X-Webhook-Secret` header. AC3: Required fields: `telegram_id`, `vehicle_id`, `driver_name`, `status`. AC4: Updates driver record and publishes to Redis Pub/Sub for real-time dashboard updates. AC5: Returns 200 on success. AC6: Invalid secret returns 401. |

---

## Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Dashboard KPI endpoints (count, revenue, trend) | < 100ms p95 |
| List endpoints (drivers, bookings, etc.) | < 200ms p95 |
| Detail endpoints | < 150ms p95 |
| Analytics aggregation queries | < 500ms p95 |
| Export generation | < 10s for 30-day range |
| Backup trigger | 202 Accepted, completes async < 5 min |

### Scalability

- Dashboard composition fires 8–10 parallel requests; backend must handle burst concurrency per admin session.
- React Query provides automatic caching and deduplication on the frontend.
- Backend list endpoints should support cursor-based pagination for large datasets (future enhancement).

### Availability

- Admin dashboard is not customer-facing; brief maintenance windows acceptable.
- Target: 99.5% uptime during business hours (Cambodia time, UTC+7).

### Security

- All `/admin/*` endpoints require valid Bearer JWT with admin role claim.
- `SUPER_ADMIN` endpoints must reject requests from non-super-admin roles with 403.
- Audit log entries created for all mutating operations (POST, PATCH, cancel).
- Payment exports must be encrypted.
- Telegram webhook must validate `X-Webhook-Secret` against a configured secret.

---

## Data Requirements

### Response Envelope

All admin API responses (except exports and webhooks) use a standard envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message",
  "error": null
}
```

### Pagination

List responses include metadata:

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Key Entities

| Entity | Key Fields | Relationships |
|--------|-----------|---------------|
| Driver | `driver_id` (business ID), `telegram_id`, `phone`, `status` | 1:1 Vehicle (optional), 1:N Assignments |
| Vehicle | `category`, `capacity`, `tier`, `price_per_day` | 1:1 Driver (optional), 1:N Maintenance |
| Maintenance | `maintenance_type`, `scheduled_date`, `status`, `cost` | N:1 Vehicle |
| Assignment | `driver_id`, `booking_id`, `vehicle_id`, `completion_timestamp` | N:1 Driver, N:1 Booking |
| Booking | `booking_ref`, `booking_type`, `status`, `travel_date` | N:1 Customer, 1:1 Assignment (optional) |
| Hotel | `name`, `location` (lat/lng/address/province), `rating` | 1:N Rooms |
| Room | `name`, `capacity`, `price_per_night` | N:1 Hotel |
| Guide | `languages[]`, `specialties[]`, `price_per_day` | 1:N Assignments |
| Emergency Alert | `alert_type`, `status`, `location` | N:1 Customer, N:1 Booking (optional) |
| Discount | `code`, `discount_percentage`, `valid_from`, `valid_until`, `max_usage` | N:N Bookings (via usage tracking) |
| Admin User | `email`, `name`, `admin_role`, `permissions`, `is_active` | 1:N Audit Logs |
| Audit Log | `timestamp`, `admin_user_id`, `action_type`, `entity`, `entity_id`, `details` | N:1 Admin User |

---

## Error Handling

| Scenario | HTTP | Response |
|----------|------|----------|
| Invalid JWT or expired token | 401 | `{ success: false, error: "Unauthorized" }` |
| Insufficient role privileges | 403 | `{ success: false, error: "Forbidden: requires SUPER_ADMIN" }` |
| Resource not found | 404 | `{ success: false, error: "Driver not found" }` |
| Driver not available for assignment | 409 | `{ success: false, error: "Driver is not available" }` |
| Validation error | 422 | `{ success: false, error: "Validation failed", data: { fieldErrors } }` |
| Telegram webhook secret invalid | 401 | `{ success: false, error: "Invalid webhook secret" }` |

---

## Dashboard Composition

The `/admin/dashboard` page fires the following requests in parallel via React Query:

```
GET /v1/admin/drivers/count?status=AVAILABLE    →  { count: 5 }
GET /v1/admin/drivers/count?status=BUSY         →  { count: 3 }
GET /v1/admin/bookings/today-count              →  { count: 12 }
GET /v1/admin/bookings/today-revenue            →  { total_usd: 2450.00 }
GET /v1/admin/bookings/trend?days=30            →  [{ date, count }, ...]
GET /v1/admin/bookings?unassigned=true&limit=5  →  [...]
GET /v1/admin/maintenance/upcoming              →  [...]
GET /v1/admin/emergency?status=SENT&limit=5     →  [...]
GET /v1/admin/bookings?start=now&end=+24h       →  [...]
```

Each widget is independently cached and refreshes on its own interval (e.g., KPIs every 30s, lists every 60s).

---

*Aligned with PRD section 8.0 (Admin & Operations) and `docs/modules/admin/api.yaml`.*
