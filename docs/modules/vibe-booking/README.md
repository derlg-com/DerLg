# Vibe Booking (AI Travel Concierge)

> **Feature ID:** F10–F16  
> **Status:** In Progress  
> **Scope:** MVP  
> **Canonical spec:** `.kiro/specs/vibe-booking/`

## Overview

DerLg's core differentiator: a conversational AI concierge powered by LangGraph + NVIDIA gpt-oss-120b that lets travelers discover, plan, and book trips through natural language chat. Supports text, trip cards, hotel cards, action buttons, and payment QR codes inline.

## Canonical Documents

The authoritative implementation spec lives in `.kiro/specs/vibe-booking/`:

| File | Purpose |
|------|---------|
| `requirements.md` | All functional requirements (R1–R14) |
| `design.md` | Architecture, state machine, protocol, deployment |
| `tasks.md` | Implementation task checklist |

The files in this directory (`api.yaml`, `architecture.md`, `requirements.md`) are legacy references. The `.kiro/specs/vibe-booking/` files supersede them.

## Related

- [Product PRD — AI Travel Concierge](../../product/prd.md#72-ai-travel-concierge--vibe-booking-f10f16)
- `.kiro/specs/vibe-booking/`
- Related modules: [`trip-discovery`](../trip-discovery/), [`payments`](../payments/)
