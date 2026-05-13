# Customize Package Workflows

> End-to-end user journeys for booking private tours — prebuilt templates and build-from-scratch.

---

## Files

| File | Description |
|------|-------------|
| [`01-prebuilt-private-package.md`](01-prebuilt-private-package.md) | Prebuilt private package: browse, view details, customize, or book as-is |
| [`flow.md`](flow.md) | Visual mermaid diagrams for customize-package flows |

## Shared Concepts

| Term | Definition |
|------|------------|
| **Private Package** | A tour template for private group travel (family/friends only). Not shared with strangers. Admin-created. |
| **Public Package** | A group tour where travelers join a shared bus/van with other customers. Priced per person. |
| **Journey Map** | Day-by-day itinerary template inside a private package. Users can reorder, add, or remove days. |
| **Draft** | Saved customization state. Persists across sessions. No inventory held. |
| **Hold** | 15-minute inventory reservation created at checkout. |

## Private vs Public Package

| Aspect | Private Package | Public Package |
|--------|-----------------|----------------|
| Group type | Family / friends only | Shared with strangers |
| Pricing | Per group or per person with min/max group size | Per person, fixed price |
| Customization | Full flexibility: reorder/add/remove days, swap everything | Limited: swap activities/hotel/transport within fixed structure |
| Kid-friendly | Configurable per template (yes/no flag) | Varies |
| Discovery | App section, direct link, AI chat recommendation | Homepage, search, featured |

## Booking Status Flow

Same state machine as public packages:

```
[HOLD] --15m timeout--> [EXPIRED]
   |
   | Payment initiated
   ▼
[PENDING_PAYMENT] --success--> [CONFIRMED]
   |                              |
   | failed/cancelled             | trip completed
   ▼                              ▼
[EXPIRED]                    [COMPLETED]
   |
   | User cancellation
   ▼
[CANCELLED]
```
