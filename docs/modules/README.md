# Feature Modules

> Per-feature specifications. Each module contains requirements, architecture, and API contracts for one feature.

---

## Feature List

| # | Feature | Folder | Status |
|---|---------|--------|--------|
| 01 | AI Travel Concierge Chat | [`ai-chat/`](./ai-chat/) | Planned |
| 02 | Trip Discovery & Smart Suggestions | [`trip-discovery/`](./trip-discovery/) | Planned |
| 03 | Transportation Booking | [`transportation/`](./transportation/) | Planned |
| 04 | Hotel Booking | [`hotel-booking/`](./hotel-booking/) | Planned |
| 05 | Tour Guide Booking | [`tour-guide/`](./tour-guide/) | Planned |
| 06 | Explore — Historical Places | [`explore-places/`](./explore-places/) | Planned |
| 07 | Festival Calendar & Event Alerts | [`festivals/`](./festivals/) | Planned |
| 08 | Payment & Checkout | [`payments/`](./payments/) | Planned |
| 09 | Emergency & Safety System | [`emergency/`](./emergency/) | Planned |
| 10 | Student Discount Verification | [`student-discount/`](./student-discount/) | Planned |
| 11 | Loyalty & Bonus Points | [`loyalty/`](./loyalty/) | Planned |
| 12 | Offline Maps | [`offline-maps/`](./offline-maps/) | Planned |
| 13 | Multi-Language Support | [`multilanguage/`](./multilanguage/) | Planned |
| 14 | AI Budget Planner | [`budget-planner/`](./budget-planner/) | Planned |
| 15 | My Trip — Booking Management | [`my-trip/`](./my-trip/) | Planned |
| 16 | User Profile & Account Settings | [`profile/`](./profile/) | Planned |

---

## Module Template

Each feature module follows the same inner structure:

```
modules/<feature-name>/
├── README.md              # Overview, status, owner, quick links
├── requirements.md        # User stories & acceptance criteria
├── architecture.md        # Module design, state flow, diagrams
└── api.yaml               # OpenAPI contract for this module
```

---

## Product & Platform

- For product requirements and decisions, see [`../product/`](../product/)
- For system architecture and roadmaps, see [`../platform/`](../platform/)
