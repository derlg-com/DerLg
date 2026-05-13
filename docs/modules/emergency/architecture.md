# Emergency & Safety System — Architecture

> **Feature IDs:** F50–F52
> **Scope:** v1.2

---

## Overview

The Emergency module provides critical safety features: one-tap SOS alerts with GPS, live location sharing, and province-specific emergency contacts. It is designed for high reliability and low latency.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js / PWA)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ SOS Button  │  │ Location    │  │ Emergency Contacts  │  │
│  │ (Floating)  │  │ Share Link  │  │ (Offline Cached)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Background Geolocation (navigator.geolocation)      │    │
│  │ — Watch position, batch uploads every 5 min         │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON / WebSocket
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Emergency   │  │ Location    │  │ Contacts            │  │
│  │ Controller  │  │ Controller  │  │ Controller          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Emergency Service                                   │    │
│  │ — alert dispatch, escalation, location tracking     │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│  │ PostgreSQL│     │  Redis   │     │  FCM /   │            │
│  │ (alerts)  │     │ (pub/sub)│     │  SMS     │            │
│  └──────────┘     └──────────┘     └──────────┘            │
└──────────────────────────────────────────────────────────────┘
```

---

## SOS Alert Flow

```
[User presses SOS]
        │
        ▼
[5-second countdown with cancel]
        │
        ▼
[Get GPS position]
        │
        ▼
[POST /v1/emergency/alerts]
        │
        ▼
[Create alert record: SENT]
[Push to support team (FCM)]
[SMS to on-call number]
        │
        ▼
[Show "Alert sent" with status]
        │
        ▼
[Support acknowledges]
[Status: ACKNOWLEDGED]
[Notify user]
```

---

## Location Sharing Flow

```
[User enables location sharing]
        │
        ▼
[Generate unique token]
[Create share record with expiry]
        │
        ▼
[Start background geolocation]
[Upload position every 5 minutes]
        │
        ▼
[Share link: https://derlg.com/locate/{token}]
        │
        ▼
[Recipient opens link]
[See live map with location dot]
[History trail (last 24h)]
```

---

## Non-Functional Requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| Alert delivery latency | < 5 seconds | From SOS trigger to push + SMS dispatch |
| Location sharing update | Every 5 minutes | Battery-efficient batch uploads |
| Location accuracy | < 10 meters | GPS accuracy requirement |
| System availability | 99.9% | 24/7 monitoring for emergency endpoints |
| Location data retention | 30 days | After share expiry or revocation |
| Emergency contacts response | < 200ms | Cached locally; API for updates |

---

## Alert Delivery & Retry

If the initial push notification (FCM) fails, the system retries:

1. Retry FCM up to 3 times with exponential backoff (1s, 2s, 4s).
2. If all retries fail, escalate to SMS fallback to the on-call number.
3. If SMS also fails, mark alert as `ESCALATED` and notify the supervisor directly.

---

## GDPR & Privacy — Location Data

- **Consent**: Location sharing requires explicit user consent before link generation.
- **Retention**: Location data is retained for 30 days after share expiry or revocation, then purged.
- **Access**: Only the recipient with the unique token can access shared location data.
- **Revocation**: Users can revoke sharing at any time; revoked data is immediately inaccessible.
- **Audit**: All location share creations and revocations are logged with user ID and timestamp.

---

## Auto-Escalation

```typescript
// Cron job every minute
async function checkUnacknowledgedAlerts() {
  const alerts = await db.emergencyAlerts.findMany({
    where: {
      status: 'SENT',
      created_at: { lt: subMinutes(new Date(), 5) },
    },
  });

  for (const alert of alerts) {
    await escalateToSupervisor(alert);
    await db.emergencyAlerts.update({
      where: { id: alert.id },
      data: { status: 'ESCALATED' },
    });
  }
}
```

---

*Aligned with PRD section 7.6 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
