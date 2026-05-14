# Package Booking Workflows

> End-to-end user journeys for booking prebuilt trip packages with customization.

---

## Files

| File | Description |
|------|-------------|
| [`01-homepage-search-package-journey.md`](01-homepage-search-package-journey.md) | Full workflow doc with API calls, request/response examples, error handling, and edge cases |
| [`flow.md`](flow.md) | Visual mermaid diagrams: sequence flow, customization detail, state machine, error recovery |

## Shared Concepts

| Term | Definition |
|------|------------|
| **Journey Map** | Prebuilt day-by-day itinerary template. Users customize activities, hotels, transport. |
| **Draft** | Saved customization that persists across sessions. No inventory held. |
| **Hold** | 15-minute inventory reservation created at checkout. |
| **Activity Pool** | Compatible activities per day that users can add or swap. Each has its own price. |
| **Price Delta** | Real-time price adjustment shown as user customizes. |

## Booking Status Flow

```
[HOLD] ──15m timeout──▶ [EXPIRED]dont 
   │
   │ Payment initiated
   ▼
[PENDING_PAYMENT] ──success──▶ [CONFIRMED]
   │                              │
   │ failed/cancelled             │ trip completed
   ▼                              ▼
[EXPIRED]                    [COMPLETED]
   │
   │ User cancellation
   ▼
[CANCELLED]
```
