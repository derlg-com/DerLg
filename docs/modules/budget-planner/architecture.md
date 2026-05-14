# AI Budget Planner — Architecture

> **Feature ID:** F14  
> **Scope:** MVP

---

## Overview

The Budget Planner is an AI-powered cost estimation feature. It leverages the same LangGraph agent as the chat module but with a specialized "budget estimation" tool. The AI queries real inventory prices from the backend and presents structured cost breakdowns.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      AI Service (Python)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Budget Estimation Tool                              │    │
│  │ — Queries backend for real prices                   │    │
│  │ — Applies tier multipliers                          │    │
│  │ — Returns structured breakdown                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          │ HTTP + X-Service-Key             │
│                          ▼                                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Budget Service                                      │    │
│  │ — Aggregate prices from hotels, transport, guides   │    │
│  │ — Calculate ranges by tier                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ PostgreSQL                                          │    │
│  │ (hotels, transport, guides, places)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Estimation Algorithm

```typescript
async function estimateBudget(params: BudgetParams): Promise<BudgetEstimate> {
  const { location, days, travelers, tier, currency } = params;

  // Fetch real prices from inventory
  const [hotels, vehicles, guides, places] = await Promise.all([
    getCheapestHotel(location, tier),
    getCheapestTransport(location, tier),
    getCheapestGuide(location, tier),
    getPlacesByLocation(location),
  ]);

  const nights = days - 1;
  const breakdown = {
    accommodation: {
      min: hotels.min * nights * travelers,
      max: hotels.max * nights * travelers,
    },
    transportation: {
      min: vehicles.min * days,
      max: vehicles.max * days,
    },
    meals: {
      min: MEAL_RATES[tier].min * days * travelers,
      max: MEAL_RATES[tier].max * days * travelers,
    },
    entry_fees: {
      min: sum(places.map(p => p.entry_fee_usd || 0)) * travelers,
      max: sum(places.map(p => p.entry_fee_usd || 0)) * travelers,
    },
    guide: {
      min: guides.min * days,
      max: guides.max * days,
    },
    miscellaneous: {
      min: MISC_RATES[tier].min * days * travelers,
      max: MISC_RATES[tier].max * days * travelers,
    },
  };

  return {
    total_min: sum(Object.values(breakdown).map(b => b.min)),
    total_max: sum(Object.values(breakdown).map(b => b.max)),
    breakdown,
    currency,
  };
}
```

---

## AI Integration

The budget planner is exposed as a LangGraph tool:

```python
@tool
def estimate_trip_budget(
    location: str,
    days: int,
    travelers: int,
    tier: str = "mid-range",
    currency: str = "USD"
) -> dict:
    """Estimate total trip cost based on real inventory prices."""
    response = requests.post(
        f"{BACKEND_URL}/v1/ai-tools/budget/estimate",
        json={"location": location, "days": days, "travelers": travelers, "tier": tier, "currency": currency},
        headers={"X-Service-Key": SERVICE_KEY}
    )
    return response.json()["data"]
```

---

*Aligned with PRD section 7.2 and `.kiro/specs/agentic-llm-chatbot/requirements.md`.*
