# Async Architecture

> **Phase 6** — Event-driven and time-sensitive plumbing. This doc covers the *transport and routing* only; notification content, loyalty rules, and emergency flows live in `docs/modules/`.

---

## Event System

**Chosen transport:** NestJS `EventEmitter` for intra-process events; Redis Pub/Sub as bridge if/when horizontal scaling is needed.

**Rationale:** `EventEmitter` is sufficient for a single-node deployment. Redis Pub/Sub can be introduced later without changing event definitions.

### Naming Convention

`PascalCase` + `Event` suffix: `BookingCreatedEvent`, `PaymentSucceededEvent`, `UserRegisteredEvent`.

### Event Payload Contract

```typescript
interface DomainEvent {
  eventId: string;      // UUID for idempotency
  occurredAt: string;   // ISO 8601 UTC
  aggregateId: string;  // ID of the affected entity
  payload: unknown;     // event-specific data
}
```

---

## Background Jobs

**Scheduler:** `@nestjs/schedule` with Redis-backed locking to prevent duplicate runs in multi-instance deployments.

**Job categories:**

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `cleanupExpiredBookings` | Every 5 minutes | Cancel bookings where `reserved_until` has passed |
| `sendTravelReminders` | Daily at 09:00 Asia/Phnom_Penh | Notify users with confirmed bookings for tomorrow |
| `sendFestivalAlerts` | Daily at 08:00 Asia/Phnom_Penh | Notify users about upcoming festivals in visited provinces |

**Scheduling rules:**
- All cron expressions use explicit `timeZone: 'Asia/Phnom_Penh'`
- Jobs must be idempotent — safe to run twice without side effects
- Long-running jobs should yield periodically or run as separate worker processes (future)

---

## Notification Plumbing

| Concern | Architecture |
|---------|--------------|
| Channels | Email (Resend), Push (FCM). SMS is reserved for emergency only. |
| Delivery | Event-driven; `NotificationService` listens to domain events and routes to correct channel adapter |
| Retry | Failed deliveries retried 3× with exponential backoff; dead-letter logged after final failure |
| Templates | Feature-level concern — `docs/modules/notifications/` owns copy and design |

---

## Transaction Boundaries

- **Prisma `$transaction`:** Used when multiple DB writes must succeed or fail together.
- **Saga pattern:** For multi-step flows that cross module boundaries (e.g., booking + payment + inventory), define compensating actions explicitly.
- **Outbox pattern:** Not required initially; document if event publishing must be atomic with DB writes.

---

## Checklist

- [ ] `EventEmitterModule` configured globally
- [ ] Base `DomainEvent` interface defined
- [ ] Naming convention enforced across modules
- [ ] Redis-backed schedule locking for cron jobs
- [ ] Notification channel adapters (Resend, FCM) stubbed
- [ ] Retry policy for failed notification deliveries documented
- [ ] Compensating actions defined for multi-step booking saga
