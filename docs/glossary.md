# DerLg Glossary

> Domain terms and abbreviations used across product, platform, and feature documentation.

---

## Product Terms

| Term | Definition |
|------|------------|
| **Vibe Booking** | Conversational AI-assisted trip planning and booking via natural language chat. DerLg's core differentiator. |
| **PWA** | Progressive Web App. Installable mobile experience without an app store. |
| **Bakong** | National Cambodian payment system using QR codes. |
| **ABA Pay** | Mobile banking QR payment method widely used in Cambodia. |

## Technical Terms

| Term | Definition |
|------|------------|
| **RLS** | Row-Level Security. PostgreSQL feature used in Supabase to restrict data access per user. |
| **JWT** | JSON Web Token. Used for access tokens (15 min expiry) and refresh tokens (7 days, httpOnly cookie). |
| **NestJS** | Backend framework (Node.js/TypeScript) running on port 3001. |
| **Next.js** | Frontend framework (React/TypeScript) running on port 3000. |
| **LangGraph** | Python framework for building stateful AI agent workflows. |
| **Prisma** | ORM used for database schema, migrations, and queries. |
| **Supabase** | Managed PostgreSQL + Auth + Storage platform used in production. |

## Feature IDs

Features are referenced by `F##` codes defined in [product/feature-decisions.md](./product/feature-decisions.md).

| ID Range | Domain |
|----------|--------|
| F01–F06 | Authentication & Identity |
| F10–F16 | AI Travel Concierge (Vibe Booking) |
| F20–F26 | Trip Discovery & Catalog |
| F30–F38 | Core Booking Engine |
| F40–F47 | Payments |
| F50–F52 | Emergency & Safety |
| F60–F64 | Loyalty & Student Programs |
| F70–F73 | Notifications |
| F80–F85 | Explore, Maps & Content |
| F90–F93 | Progressive Web App |
| F100–F103 | Admin & Operations |
| F110–F114 | DevEx & Infrastructure |
