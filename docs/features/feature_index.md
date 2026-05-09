# DerLg.com — Feature Index

**Platform:** Cambodia Travel Booking Platform  
**Total Features:** 16  
**Focus:** User experience, flows, and UI behavior

---

## Feature List

| # | Feature | Folder | Requirement | Architecture | API Contract |
|---|---------|--------|-------------|--------------|--------------|
| 01 | AI Travel Concierge Chat | [`F01-ai-chat/`](./F01-ai-chat/) | [Business Rules](./F01-ai-chat/requirement.md) | [Diagrams](./F01-ai-chat/architecture.md) | [Technical Contract](./F01-ai-chat/api.yaml) |
| 02 | Trip Discovery & Smart Suggestions | [`F02-trip-discovery/`](./F02-trip-discovery/) | [Business Rules](./F02-trip-discovery/requirement.md) | [Diagrams](./F02-trip-discovery/architecture.md) | [Technical Contract](./F02-trip-discovery/api.yaml) |
| 03 | Transportation Booking | [`F03-transportation/`](./F03-transportation/) | [Business Rules](./F03-transportation/requirement.md) | [Diagrams](./F03-transportation/architecture.md) | [Technical Contract](./F03-transportation/api.yaml) |
| 04 | Hotel Booking | [`F04-hotel-booking/`](./F04-hotel-booking/) | [Business Rules](./F04-hotel-booking/requirement.md) | [Diagrams](./F04-hotel-booking/architecture.md) | [Technical Contract](./F04-hotel-booking/api.yaml) |
| 05 | Tour Guide Booking | [`F05-tour-guide/`](./F05-tour-guide/) | [Business Rules](./F05-tour-guide/requirement.md) | [Diagrams](./F05-tour-guide/architecture.md) | [Technical Contract](./F05-tour-guide/api.yaml) |
| 06 | Explore — Historical Places | [`F06-explore-places/`](./F06-explore-places/) | [Business Rules](./F06-explore-places/requirement.md) | [Diagrams](./F06-explore-places/architecture.md) | [Technical Contract](./F06-explore-places/api.yaml) |
| 07 | Festival Calendar & Event Alerts | [`F07-festivals/`](./F07-festivals/) | [Business Rules](./F07-festivals/requirement.md) | [Diagrams](./F07-festivals/architecture.md) | [Technical Contract](./F07-festivals/api.yaml) |
| 08 | Payment & Checkout | [`F08-payment/`](./F08-payment/) | [Business Rules](./F08-payment/requirement.md) | [Diagrams](./F08-payment/architecture.md) | [Technical Contract](./F08-payment/api.yaml) |
| 09 | Emergency & Safety System | [`F09-emergency/`](./F09-emergency/) | [Business Rules](./F09-emergency/requirement.md) | [Diagrams](./F09-emergency/architecture.md) | [Technical Contract](./F09-emergency/api.yaml) |
| 10 | Student Discount Verification | [`F10-student-discount/`](./F10-student-discount/) | [Business Rules](./F10-student-discount/requirement.md) | [Diagrams](./F10-student-discount/architecture.md) | [Technical Contract](./F10-student-discount/api.yaml) |
| 11 | Loyalty & Bonus Points | [`F11-loyalty-points/`](./F11-loyalty-points/) | [Business Rules](./F11-loyalty-points/requirement.md) | [Diagrams](./F11-loyalty-points/architecture.md) | [Technical Contract](./F11-loyalty-points/api.yaml) |
| 12 | Offline Maps | [`F12-offline-maps/`](./F12-offline-maps/) | [Business Rules](./F12-offline-maps/requirement.md) | [Diagrams](./F12-offline-maps/architecture.md) | [Technical Contract](./F12-offline-maps/api.yaml) |
| 13 | Multi-Language Support | [`F13-multilanguage/`](./F13-multilanguage/) | [Business Rules](./F13-multilanguage/requirement.md) | [Diagrams](./F13-multilanguage/architecture.md) | [Technical Contract](./F13-multilanguage/api.yaml) |
| 14 | AI Budget Planner | [`F14-budget-planner/`](./F14-budget-planner/) | [Business Rules](./F14-budget-planner/requirement.md) | [Diagrams](./F14-budget-planner/architecture.md) | [Technical Contract](./F14-budget-planner/api.yaml) |
| 15 | My Trip — Booking Management | [`F15-my-trip/`](./F15-my-trip/) | [Business Rules](./F15-my-trip/requirement.md) | [Diagrams](./F15-my-trip/architecture.md) | [Technical Contract](./F15-my-trip/api.yaml) |
| 16 | User Profile & Account Settings | [`F16-profile/`](./F16-profile/) | [Business Rules](./F16-profile/requirement.md) | [Diagrams](./F16-profile/architecture.md) | [Technical Contract](./F16-profile/api.yaml) |

---

## Folder Structure Map

```
docs/features/
├── feature_index.md          ← You are here
│
├── F01-ai-chat/              # AI Travel Concierge Chat
│   ├── requirement.md        # Business Rules
│   ├── architecture.md       # Diagrams
│   └── api.yaml              # Technical Contract
│
├── F02-trip-discovery/       # Trip Discovery & Smart Suggestions
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F03-transportation/       # Transportation Booking
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F04-hotel-booking/        # Hotel Booking
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F05-tour-guide/           # Tour Guide Booking
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F06-explore-places/       # Explore — Historical Places
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F07-festivals/            # Festival Calendar & Event Alerts
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F08-payment/              # Payment & Checkout
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F09-emergency/            # Emergency & Safety System
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F10-student-discount/     # Student Discount Verification
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F11-loyalty-points/       # Loyalty & Bonus Points
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F12-offline-maps/         # Offline Maps
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F13-multilanguage/        # Multi-Language Support
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F14-budget-planner/       # AI Budget Planner
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
├── F15-my-trip/              # My Trip — Booking Management
│   ├── requirement.md
│   ├── architecture.md
│   └── api.yaml
│
└── F16-profile/              # User Profile & Account Settings
    ├── requirement.md
    ├── architecture.md
    └── api.yaml
```

---

## Legend

| File | Purpose |
|------|---------|
| `requirement.md` | Business rules, acceptance criteria, user stories, and functional requirements |
| `architecture.md` | System diagrams, flowcharts, data models, and component relationships |
| `api.yaml` | OpenAPI/Swagger technical contract defining endpoints, schemas, and operations |
