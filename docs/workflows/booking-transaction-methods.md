# Booking Transaction Methods Comparison

> Comparison of three architectural approaches for handling package bookings across the three user paths (public prebuilt, private prebuilt, build-from-scratch).

---

## Method 1: Frontend Parallel Requests

In this approach, the frontend acts as the orchestrator. It calls multiple booking APIs in parallel (one per component type) and aggregates the results.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FE as Frontend
    participant HB as Hotel API
    participant TB as Transport API
    participant GB as Guide API
    participant AB as Activity API
    participant PM as Payment API

    User->>FE: Select package + customize
    FE->>HB: POST /hotels/bookings
    FE->>TB: POST /transport/bookings
    FE->>GB: POST /guides/bookings
    FE->>AB: POST /activities/bookings

    HB-->>FE: 201 Created (bookingId: H-123)
    TB-->>FE: 201 Created (bookingId: T-456)
    GB-->>FE: 503 Service Unavailable ❌
    AB-->>FE: 201 Created (bookingId: A-789)

    Note over FE: Guide booking failed.<br/>Hotel, Transport, Activity already committed.<br/>Frontend must now call DELETE on successful ones.

    FE->>HB: DELETE /hotels/bookings/H-123
    FE->>TB: DELETE /transport/bookings/T-456
    FE->>AB: DELETE /activities/bookings/A-789

    HB-->>FE: 200 OK
    TB-->>FE: 200 OK
    AB-->>FE: 200 OK

    FE-->>User: "Booking failed. Please try again."

    Note over FE: Race condition risk:<br/>If DELETE on hotel also fails,<br/>orphaned booking remains.
```

### Operational Characteristics

| Concern | Behavior |
|---------|----------|
| Transaction boundary | No boundary — each API call is independent |
| Rollback mechanism | Frontend-initiated DELETE calls (compensating actions) |
| Failure mode | Partial commits possible; orphaned bookings on rollback failure |
| Consistency | Eventual at best; requires manual reconciliation |
| Retry semantics | Complex — frontend must track which calls succeeded/failed |

---

## Method 2: gRPC Inter-Service Communication

In this approach, the frontend makes a single request to a Booking Service. The Booking Service acts as a saga coordinator, calling internal services via gRPC and executing compensating actions on failure.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FE as Frontend
    participant BS as Booking Service
    participant HS as Hotel Service
    participant TS as Transport Service
    participant GS as Guide Service
    participant PS as Payment Service

    User->>FE: Select package + customize
    FE->>BS: POST /v1/bookings
    Note over FE,BS: {items: [...], payment_method: "stripe"}

    BS->>BS: Start Saga Transaction

    par Parallel gRPC Calls
        BS->>HS: gRPC ReserveHotel(roomId, dates)
        BS->>TS: gRPC ReserveVehicle(vehicleId, dates)
        BS->>GS: gRPC ReserveGuide(guideId, dates)
    end

    HS-->>BS: HotelReserved (success)
    TS-->>BS: VehicleReserved (success)
    GS-->>BS: GuideUnavailable (failure) ❌

    Note over BS: Saga compensating actions triggered

    BS->>HS: gRPC CancelHotelReservation
    BS->>TS: gRPC CancelVehicleReservation

    HS-->>BS: Cancelled
    TS-->>BS: Cancelled

    BS-->>FE: 409 Conflict
    Note over BS,FE: {error: "GUIDE_UNAVAILABLE"}
    FE-->>User: "Selected guide is no longer available"

    alt All Services Succeed
        BS->>PS: gRPC CreatePaymentIntent(amount)
        PS-->>BS: client_secret, intent_id
        BS->>BS: Persist booking + sub-bookings
        BS-->>FE: 201 Created
        Note over BS,FE: {booking_ref, client_secret}
        FE-->>User: "Please complete payment"
    end
```

### Operational Characteristics

| Concern | Behavior |
|---------|----------|
| Transaction boundary | Saga across multiple services |
| Rollback mechanism | Explicit compensating gRPC calls on failure |
| Failure mode | Clean rollback if compensating actions succeed |
| Consistency | Strong (assuming compensating actions are reliable) |
| Retry semantics | Per-service retry with circuit breaker pattern |

---

## Method 3: Backend Orchestrated with Configuration

In this approach, the booking is split into two phases: a lightweight configuration step (no inventory lock) and an atomic database transaction (inventory lock). All external side effects happen asynchronously via an outbox.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FE as Frontend
    participant CS as Configuration Service
    participant BS as Booking Service
    participant DB as PostgreSQL
    participant RC as Redis
    participant OB as Outbox Processor
    participant SE as Resend/FCM

    Note over User,SE: Phase 1: Configuration (No Inventory Lock)

    User->>FE: Select package + customize
    FE->>CS: POST /v1/package-configurations
    Note over FE,CS: {mode, trip_id, overrides}

    CS->>CS: Validate selections
    Note over CS: Check availability
    Note over CS: Calculate prices
    CS->>DB: INSERT configuration
    Note over CS,DB: snapshot + expiry
    DB-->>CS: config_id: cfg-123

    CS-->>FE: 200 OK
    Note over CS,FE: {configuration_id, total, itinerary}
    FE-->>User: Display summary + "Confirm"

    Note over User,SE: Phase 2: Atomic Booking (Inventory Lock)

    User->>FE: Tap "Confirm & Book"
    FE->>BS: POST /v1/bookings
    Note over FE,BS: {configuration_id}

    BS->>DB: BEGIN TRANSACTION
    Note over BS,DB: SERIALIZABLE

    BS->>DB: SELECT configuration
    Note over BS,DB: FOR UPDATE
    DB-->>BS: cfg-123 (VALID)

    BS->>DB: UPDATE configuration
    Note over BS,DB: SET status = BOOKED
    BS->>DB: UPDATE hotel_rooms
    Note over BS,DB: SET available = available - 1
    BS->>DB: UPDATE transport
    Note over BS,DB: SET available = available - 1
    BS->>DB: INSERT bookings
    Note over BS,DB: status: HOLD, expiry: +15min
    BS->>DB: INSERT booking_items
    Note over BS,DB: hotel, transport, activities

    BS->>DB: COMMIT

    alt Redis Available
        BS->>RC: SETEX booking:hold:123 900 1
    else Redis Unavailable
        Note over BS: Skip cache.<br/>Use hold_expires_at as fallback.
    end

    BS-->>FE: 201 Created
    Note over BS,FE: {booking_id, reference, status: HOLD}
    FE-->>User: "Booking held. Complete payment."

    Note over User,SE: Phase 3: Payment (Independent)

    User->>FE: Enter card details
    FE->>PS: Stripe.confirmPayment

    PS->>BS: Webhook: payment_intent.succeeded

    BS->>DB: BEGIN TRANSACTION
    BS->>DB: UPDATE bookings
    Note over BS,DB: SET status = CONFIRMED
    BS->>DB: INSERT payments
    Note over BS,DB: status: SUCCEEDED
    BS->>DB: INSERT outbox_events
    Note over BS,DB: email, push, qr
    BS->>DB: COMMIT

    alt Async Side Effects
        OB->>DB: Poll outbox_events
        Note over OB,DB: WHERE status = PENDING
        DB-->>OB: [email_event, push_event]
        OB->>SE: Send email + push
        SE-->>OB: Accepted
        OB->>DB: UPDATE outbox_events
        Note over OB,DB: SET status = COMPLETED
    end

    BS-->>PS: 200 OK
```

### Operational Characteristics

| Concern | Behavior |
|---------|----------|
| Transaction boundary | Single database transaction with serializable isolation |
| Rollback mechanism | Automatic — database transaction rollback on any failure |
| Failure mode | All-or-nothing; no partial state possible |
| Consistency | Immediate (ACID) |
| Retry semantics | Configuration step is idempotent; booking step retries with fresh configuration |

---

## Comparative Analysis

| Aspect | Method 1: Frontend Parallel | Method 2: gRPC Saga | Method 3: Backend Orchestrated |
|--------|----------------------------|---------------------|-------------------------------|
| **Frontend complexity** | High — manages retries, rollbacks, partial states | Low — single API call | Low — single API call |
| **Backend complexity** | Low — simple CRUD APIs | High — saga coordinator, compensating actions | Medium — configuration service + transaction |
| **Failure recovery** | Manual, fragile | Automatic via compensating transactions | Automatic via database rollback |
| **Consistency** | Eventual, prone to orphans | Strong (with reliable compensations) | Strong (ACID) |
| **Latency** | Multiple round-trips | Multiple internal hops | Single fast transaction |
| **Network resilience** | Poor — frontend must handle all failures | Good — service-level retries | Excellent — single request/response |
| **Operational burden** | High — debug frontend state, reconcile orphans | High — distributed tracing, saga monitoring | Low — single transaction log |
| **Infrastructure needs** | Simple HTTP | gRPC, service mesh, circuit breakers | Standard HTTP + PostgreSQL |
| **Team scaling** | Poor — frontend team owns transaction logic | Good — service teams own boundaries | Good — single backend team owns flow |

---

## Recommendation for DerLg

**Method 3 (Backend Orchestrated with Configuration)** is the recommended approach for the current architecture because:

1. **DerLg is a monolithic NestJS application** with a single PostgreSQL database. The gRPC overhead in Method 2 adds complexity without benefit since all data lives in one database.

2. **All three booking paths** (public prebuilt, private prebuilt, build-from-scratch) resolve to the same operational pattern: user selections → validated configuration → atomic booking. Method 3 unifies them naturally.

3. **The configuration phase separates heavy validation from the inventory lock.** This keeps the booking transaction fast and simple, reducing lock contention under load.

4. **External API failures** (email, push notifications) are isolated from the critical path via the outbox pattern. The booking succeeds even if Resend or FCM is temporarily unavailable.

5. **No partial booking state** is possible. If anything fails during the booking transaction, PostgreSQL rolls back automatically. There are no orphaned reservations requiring manual cleanup.

---

## Decision Record

| Question | Decision |
|----------|----------|
| Who orchestrates the booking? | Backend (Booking Service) |
| How many API calls does the frontend make? | Two: one to configure, one to book |
| Where does validation happen? | Configuration phase (before inventory lock) |
| Where does pricing happen? | Server-side during configuration |
| How is inventory locked? | Atomic database transaction with serializable isolation |
| What happens if payment fails? | Booking remains in HOLD status; user retries payment |
| What happens if email/push fails? | Async outbox retry; booking is still confirmed |
| What happens if Redis fails? | Database timestamp fallback; cron handles expiry |
