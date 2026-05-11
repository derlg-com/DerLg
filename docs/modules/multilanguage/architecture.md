# Multi-Language Support — Architecture

> **Feature ID:** F84  
> **Scope:** MVP

---

## Overview

Multi-language support spans three layers: **frontend rendering** (next-intl), **API content negotiation** (Accept-Language header), and **database storage** (JSONB translations). The design prioritizes API-driven localization so that content is served in the correct language without client-side translation of dynamic data.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ next-intl   │    │ Language    │    │ localStorage    │  │
│  │ (messages)  │    │ Selector    │    │ (guest pref)    │  │
│  └──────┬──────┘    └──────┬──────┘    └─────────────────┘  │
│         │                  │                                 │
│         │ Set Accept-Lang  │                                 │
│         └──────────────────┘                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP Request + Accept-Language: zh
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                        │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │ I18nInterceptor   │    │ Content Service                │  │
│  │ (extract locale)  │───▶│ (resolve JSONB translations)   │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ SELECT translations->>'zh' as name
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Database (PostgreSQL)                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ trips.translations: {en: "...", zh: "...", km: "..."}   │ │
│  │ places.translations: {en: "...", zh: "...", km: "..."}  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend: next-intl Integration

### Directory Structure

```
frontend/
├── app/
│   ├── [locale]/          # Dynamic locale segment: /en, /zh, /km
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/               # API routes (locale-agnostic)
├── i18n/
│   ├── config.ts          # next-intl configuration
│   └── routing.ts         # Locale path strategy
├── messages/
│   ├── en.json            # Static UI strings (English)
│   ├── zh.json            # Static UI strings (Chinese)
│   └── km.json            # Static UI strings (Khmer)
```

### Locale Resolution

```
1. URL path prefix (/zh/trips) — highest priority
2. User profile preferred_language (if authenticated)
3. localStorage 'locale' (if guest)
4. navigator.language (browser setting)
5. Default: 'en'
```

### Middleware

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const locale = negotiateLocale(request);
  // Redirect /trips → /en/trips (or detected locale)
  // Rewrite /en/api/* → /api/* (API routes are locale-agnostic)
}
```

---

## Backend: Content Localization

### I18nInterceptor

Extracts `Accept-Language` header and attaches `req.locale` to the request object.

```typescript
@Injectable()
export class I18nInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const accepted = req.headers['accept-language'] || 'en';
    req.locale = this.resolveLocale(accepted); // 'en' | 'zh' | 'km'
    return next.handle();
  }
}
```

### Translation Resolution Strategy

```typescript
function getLocalizedField(
  translations: Record<string, any>,
  field: string,
  locale: string,
  fallback = 'en'
): string {
  const localized = translations?.[field]?.[locale];
  if (localized) return localized;
  const fallbackVal = translations?.[field]?.[fallback];
  if (fallbackVal) return fallbackVal; // Optionally mark as fallback
  return `[${field}]`; // Last resort: return key
}
```

### Prisma JSONB Query Pattern

```sql
-- Fetch trip with localized name and description
SELECT
  id,
  translations->'name'->>'zh' as name,
  translations->'description'->>'zh' as description,
  price,
  duration_days
FROM trips
WHERE id = $1;
```

---

## Database Schema: JSONB Translations

### Generic Pattern (applied to trips, places, hotels, guides, categories)

```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... other columns ...
  translations JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- GIN index for fast JSONB queries
CREATE INDEX idx_trips_translations ON trips USING GIN (translations);
```

### JSONB Structure

```json
{
  "name": {
    "en": "Angkor Wat Sunrise Tour",
    "zh": "吴哥窟日出之旅",
    "km": "ដំណើរកំសាន្តថ្ងៃរះនៅអង្គរវត្ត"
  },
  "description": {
    "en": "Witness the majestic sunrise...",
    "zh": "见证壮观的日出...",
    "km": "មើលថ្ងៃរះដ៏អស្ចារ្យ..."
  },
  "itinerary_days": {
    "en": [{"title": "Day 1: Arrival", "description": "..."}],
    "zh": [{"title": "第一天：抵达", "description": "..."}],
    "km": [{"title": "ថ្ងៃទី១៖ មកដល់", "description": "..."}]
  }
}
```

---

## Email & Push Localization

### Email Templates (Resend)

Templates stored per locale:
- `booking-confirmation-en`
- `booking-confirmation-zh`
- `booking-confirmation-km`

Template selection based on `users.preferred_language` at send time.

### Push Notifications (FCM)

```json
{
  "notification": {
    "title_loc_key": "booking_confirmed_title",
    "body_loc_key": "booking_confirmed_body"
  },
  "data": {
    "booking_id": "...",
    "locale": "zh"
  }
}
```

---

## API Contract

All content endpoints (`/v1/trips/*`, `/v1/places/*`, `/v1/hotels/*`, `/v1/guides/*`) accept:

| Header | Values | Default | Description |
|--------|--------|---------|-------------|
| `Accept-Language` | `en`, `zh`, `km` | `en` | Requested content locale |

Response includes:

| Header | Description |
|--------|-------------|
| `Content-Language` | Actual locale returned (may differ from request if fallback used) |

---

## Performance Considerations

1. **JSONB GIN indexes** on `translations` columns for fast key lookups.
2. **Redis caching** per locale: `trips:zh`, `trips:en`, `trips:km` to avoid repeated JSONB extraction.
3. **Static message files** are bundled at build time; no runtime fetch for UI strings.

---

*Aligned with PRD section 7.9 and `.kiro/specs/frontend-nextjs-implementation/requirements.md`.*
