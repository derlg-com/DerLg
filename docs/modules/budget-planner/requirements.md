# AI Budget Planner — Requirements

> **Feature ID:** F14  
> **Scope:** MVP  
> **Priority:** P1

---

## User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F14-01 | As a traveler, I want the AI to estimate my total trip cost so that I can budget before committing. | AC1: AI accepts natural language budget queries ("How much for 3 days in Siem Reap?"). AC2: Cost breakdown by category: accommodation, transportation, meals, entry fees, guide, miscellaneous. AC3: Each category shows min/max range based on actual inventory prices. AC4: Total shown in user's preferred currency (USD/KHR/CNY). AC5: Comparison tiers: Budget, Mid-Range, Luxury. AC6: Estimates saved to chat session for later reference. |
| US-F14-02 | As a traveler, I want to adjust budget parameters so that the estimate matches my preferences. | AC1: AI asks follow-up questions: travel dates, group size, accommodation preference, transport preference. AC2: Real-time re-estimation as parameters change. AC3: Slider or quick-select for budget tier in chat UI. |
| US-F14-03 | As a traveler, I want the budget estimate to link to actual bookings so that I can book directly from the estimate. | AC1: Each budget line item has "Find options" button. AC2: Tapping navigates to filtered search for that category. AC3: AI can pre-fill booking form with estimated selections. AC4: Actual booked prices replace estimates in the breakdown. |

---

## Budget Categories

| Category | Description | Data Source |
|----------|-------------|-------------|
| Accommodation | Hotel/nightly rate × nights | `hotel_rooms.price_per_night_usd` |
| Transportation | Vehicle/day or distance × rate | `transportation_vehicles` pricing |
| Meals | Estimated per person per day | Fixed estimates ($10 budget, $25 mid, $50 luxury) |
| Entry Fees | Temple/museum tickets | `places.entry_fee_usd` |
| Guide | Per day rate | `guides.price_per_day_usd` |
| Miscellaneous | Tips, snacks, souvenirs | Fixed estimate ($5–$20/day) |

---

## Cost Tiers

| Tier | Accommodation | Transport | Meals/Day | Guide | Misc/Day |
|------|--------------|-----------|-----------|-------|----------|
| Budget | Hostel/Guesthouse ($15–30) | Tuk-tuk ($25/day) | $10 | Self-guided | $5 |
| Mid-Range | 3-star ($40–80) | Van ($80/day) | $25 | Shared guide ($60/day) | $10 |
| Luxury | 4–5 star ($100–300) | Private car ($120/day) | $50 | Private guide ($100/day) | $20 |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `BUDGET_001` | 400 | Invalid budget query parameters |
| `BUDGET_002` | 404 | No pricing data available for requested location |

---

*Aligned with PRD section 7.2 and `.kiro/specs/agentic-llm-chatbot/requirements.md`.*
