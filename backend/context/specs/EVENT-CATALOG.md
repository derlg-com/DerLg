# DerLg Domain Event Catalog

> All domain events: who emits them, who listens, and what the payload looks like. Events are the glue between modules. No cross-module imports — only events.

---

## Conventions

- Event names: `domain.action` (e.g., `booking.created`)
- Payloads: plain objects, JSON-serializable, no circular references
- Emission: fire-and-forget (`eventEmitter.emit()`, no `await`)
- Handlers: async, error-isolated (one handler failure doesn't break others)
- Transport: NestJS `EventEmitter` (intra-process) → Redis Pub/Sub (future scaling)

---

## Event Registry

### `user.registered`
Emitted when a new user completes registration.

**Producer:** `AuthService`
**Consumers:**
- `NotificationsService` → send welcome email
- `LoyaltyService` → create loyalty account with 0 points
- `AuditLogService` → log registration event

**Payload:**
```typescript
interface UserRegisteredEvent {
  userId: string;
  email: string;
  name: string | null;
  registeredAt: string; // ISO 8601
}
```

---

### `user.password_changed`
Emitted when a user resets or changes their password.

**Producer:** `AuthService`
**Consumers:**
- `NotificationsService` → send security alert email
- `AuditLogService` → log password change

**Payload:**
```typescript
interface UserPasswordChangedEvent {
  userId: string;
  changedAt: string;
  ipAddress: string | null;
}
```

---

### `booking.created`
Emitted when a booking is created (HOLD status).

**Producer:** `BookingService`
**Consumers:**
- `NotificationsService` → send booking confirmation email
- `RedisService` → set booking hold TTL
- `AuditLogService` → log booking creation
- `LoyaltyService` → award points on booking (when confirmed, not here)

**Payload:**
```typescript
interface BookingCreatedEvent {
  bookingId: string;
  userId: string;
  bookingType: 'trip' | 'guide' | 'hotel' | 'transportation';
  reference: string;
  startDate: string;
  endDate: string;
  totalPriceUsd: number;
  status: 'HOLD';
  createdAt: string;
}
```

---

### `booking.confirmed`
Emitted when a booking transitions to CONFIRMED (payment completed).

**Producer:** `PaymentService` (via webhook handler)
**Consumers:**
- `NotificationsService` → send booking confirmed email + push
- `RedisService` → remove booking hold key
- `LoyaltyService` → award loyalty points (e.g., 10 points per $100)
- `AuditLogService` → log confirmation
- `GuideService` → notify guide (if guide booking)
- `HotelService` → update room inventory (if hotel booking)

**Payload:**
```typescript
interface BookingConfirmedEvent {
  bookingId: string;
  userId: string;
  paymentId: string;
  confirmedAt: string;
}
```

---

### `booking.cancelled`
Emitted when a booking is cancelled.

**Producer:** `BookingService`
**Consumers:**
- `NotificationsService` → send cancellation email
- `RedisService` → remove booking hold if exists
- `LoyaltyService` → revert pending points
- `AuditLogService` → log cancellation
- `PaymentService` → trigger refund if applicable
- `GuideService` → release guide dates
- `HotelService` → release room inventory

**Payload:**
```typescript
interface BookingCancelledEvent {
  bookingId: string;
  userId: string;
  cancelledAt: string;
  reason: string | null;
  refundAmountUsd: number | null;
  refundPercentage: number | null;
}
```

---

### `booking.expired`
Emitted when a booking hold expires (Redis TTL).

**Producer:** `BookingCleanupJob` (cron)
**Consumers:**
- `NotificationsService` → send expiry notification
- `AuditLogService` → log expiry
- `GuideService` → release guide dates
- `HotelService` → release room inventory

**Payload:**
```typescript
interface BookingExpiredEvent {
  bookingId: string;
  userId: string;
  expiredAt: string;
}
```

---

### `payment.completed`
Emitted when Stripe confirms a payment.

**Producer:** `StripeWebhookService`
**Consumers:**
- `BookingService` → transition booking to CONFIRMED
- `NotificationsService` → send payment receipt
- `AuditLogService` → log payment

**Payload:**
```typescript
interface PaymentCompletedEvent {
  paymentId: string;
  bookingId: string;
  userId: string;
  amountUsd: number;
  stripePaymentIntentId: string;
  completedAt: string;
}
```

---

### `payment.failed`
Emitted when Stripe reports a failed payment.

**Producer:** `StripeWebhookService`
**Consumers:**
- `NotificationsService` → send payment failed email
- `BookingService` → keep booking in HOLD (allow retry)

**Payload:**
```typescript
interface PaymentFailedEvent {
  paymentId: string;
  bookingId: string;
  userId: string;
  amountUsd: number;
  failureMessage: string;
  failedAt: string;
}
```

---

### `payment.refunded`
Emitted when a refund is processed.

**Producer:** `PaymentService`
**Consumers:**
- `NotificationsService` → send refund confirmation email
- `AuditLogService` → log refund

**Payload:**
```typescript
interface PaymentRefundedEvent {
  refundId: string;
  paymentId: string;
  bookingId: string;
  userId: string;
  amountUsd: number;
  percentage: number;
  refundedAt: string;
}
```

---

### `review.created`
Emitted when a verified review is submitted.

**Producer:** `ReviewService`
**Consumers:**
- `LoyaltyService` → award 50 points (first review per booking only)
- `TripService` → recalculate trip average rating
- `GuideService` → recalculate guide average rating
- `NotificationsService` → notify guide owner
- `AuditLogService` → log review

**Payload:**
```typescript
interface ReviewCreatedEvent {
  reviewId: string;
  userId: string;
  tripId: string | null;
  guideId: string | null;
  rating: number;
  isVerified: boolean;
  createdAt: string;
}
```

---

### `review.deleted`
Emitted when a review is permanently deleted.

**Producer:** `ReviewService`
**Consumers:**
- `LoyaltyService` → revert loyalty points earned for this review
- `TripService` → recalculate trip average rating
- `GuideService` → recalculate guide average rating

**Payload:**
```typescript
interface ReviewDeletedEvent {
  reviewId: string;
  userId: string;
  tripId: string | null;
  guideId: string | null;
  rating: number;
}
```

---

### `student.verification_approved`
Emitted when admin approves student verification.

**Producer:** `AdminService`
**Consumers:**
- `NotificationsService` → send approval email
- `UserService` → update user role to `student`
- `LoyaltyService` → award bonus points for verification
- `AuditLogService` → log approval

**Payload:**
```typescript
interface StudentVerificationApprovedEvent {
  verificationId: string;
  userId: string;
  approvedBy: string; // admin user ID
  approvedAt: string;
}
```

---

### `student.verification_rejected`
Emitted when admin rejects student verification.

**Producer:** `AdminService`
**Consumers:**
- `NotificationsService` → send rejection email with reason
- `AuditLogService` → log rejection

**Payload:**
```typescript
interface StudentVerificationRejectedEvent {
  verificationId: string;
  userId: string;
  rejectedBy: string;
  rejectionReason: string;
  rejectedAt: string;
}
```

---

### `emergency.alert_created`
Emitted when a user creates an emergency alert.

**Producer:** `EmergencyService`
**Consumers:**
- `NotificationsService` → immediate push to admins + SMS
- `AuditLogService` → log emergency

**Payload:**
```typescript
interface EmergencyAlertCreatedEvent {
  alertId: string;
  userId: string;
  type: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}
```

---

### `emergency.alert_resolved`
Emitted when an emergency alert is resolved.

**Producer:** `EmergencyService`
**Consumers:**
- `NotificationsService` → notify user that alert is resolved
- `AuditLogService` → log resolution

**Payload:**
```typescript
interface EmergencyAlertResolvedEvent {
  alertId: string;
  userId: string;
  resolvedBy: string | null;
  resolvedAt: string;
}
```

---

### `notification.sent`
Emitted when a notification is successfully sent.

**Producer:** `NotificationsService`
**Consumers:**
- `AuditLogService` → log notification delivery (optional)

**Payload:**
```typescript
interface NotificationSentEvent {
  notificationId: string;
  userId: string;
  channel: 'email' | 'push' | 'in_app';
  sentAt: string;
}
```

---

### `notification.failed`
Emitted when a notification fails to send.

**Producer:** `NotificationsService`
**Consumers:**
- `AuditLogService` → log failure for retry analysis

**Payload:**
```typescript
interface NotificationFailedEvent {
  notificationId: string;
  userId: string;
  channel: 'email' | 'push' | 'in_app';
  error: string;
  failedAt: string;
}
```

---

## Event Summary Table

| Event | Producer | Consumers | Priority |
|-------|----------|-----------|----------|
| `user.registered` | Auth | Notifications, Loyalty, Audit | Normal |
| `user.password_changed` | Auth | Notifications, Audit | Normal |
| `booking.created` | Booking | Notifications, Redis, Audit | Normal |
| `booking.confirmed` | Payment | Notifications, Redis, Loyalty, Audit, Guide, Hotel | High |
| `booking.cancelled` | Booking | Notifications, Redis, Loyalty, Audit, Payment, Guide, Hotel | High |
| `booking.expired` | Cron | Notifications, Audit, Guide, Hotel | Normal |
| `payment.completed` | Stripe Webhook | Booking, Notifications, Audit | High |
| `payment.failed` | Stripe Webhook | Notifications, Booking | Normal |
| `payment.refunded` | Payment | Notifications, Audit | Normal |
| `review.created` | Review | Loyalty, Trip, Guide, Notifications, Audit | Normal |
| `review.deleted` | Review | Loyalty, Trip, Guide | Normal |
| `student.verification_approved` | Admin | Notifications, User, Loyalty, Audit | Normal |
| `student.verification_rejected` | Admin | Notifications, Audit | Normal |
| `emergency.alert_created` | Emergency | Notifications, Audit | **Critical** |
| `emergency.alert_resolved` | Emergency | Notifications, Audit | Normal |
| `notification.sent` | Notifications | Audit | Low |
| `notification.failed` | Notifications | Audit | Low |

---

## Implementation Notes

### Emitting Events

```typescript
// In service method
this.eventEmitter.emit('booking.created', {
  bookingId: booking.id,
  userId: booking.userId,
  bookingType: 'guide',
  reference: booking.reference,
  startDate: booking.startDate.toISOString(),
  endDate: booking.endDate.toISOString(),
  totalPriceUsd: Number(booking.totalPriceUsd),
  status: 'HOLD',
  createdAt: booking.createdAt.toISOString(),
});
```

### Handling Events

```typescript
@Injectable()
export class BookingNotificationsHandler {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('booking.created')
  async handleBookingCreated(event: BookingCreatedEvent): Promise<void> {
    await this.notifications.sendEmail({
      to: event.userId,
      template: 'booking-confirmation',
      data: { reference: event.reference },
    });
  }
}
```

### Error Isolation

```typescript
@Injectable()
export class EventErrorHandler {
  @OnEvent('booking.created')
  async handleWithIsolation(event: BookingCreatedEvent): Promise<void> {
    try {
      await this.process(event);
    } catch (error) {
      // Log but don't throw — other handlers must still run
      this.logger.error('Handler failed', { event, error });
    }
  }
}
```

---

## References

- Async architecture: `docs/platform/backend/async-architecture.md`
- Constitution: `CONSTITUTION.md` §7
- Backend design: `.kiro/specs/backend-nestjs-supabase/design.md`
