# Multi-Language Support — Requirements

> **Feature ID:** F84  
> **Scope:** MVP  
> **Priority:** P0

---

## User Stories

### F84 — Multi-Language Content (EN / ZH / KM)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F84-01 | As a traveler, I want to switch the app language so that I can use the platform in my preferred language. | AC1: Language selector available in header/nav with flags/icons for EN, ZH, KM. AC2: Selection persists across sessions (localStorage + user profile if authenticated). AC3: Page reloads with new locale without data loss. AC4: Default language inferred from browser `Accept-Language` header; fallback to EN. |
| US-F84-02 | As a Chinese tourist, I want all trip content in Mandarin so that I can understand descriptions and make informed bookings. | AC1: All user-facing content (trip names, descriptions, place info, hotel amenities, guide bios) has EN, ZH, and KM translations. AC2: If a translation is missing, fallback to EN with a visual indicator. AC3: AI chat responds in the selected language (or detected language). |
| US-F84-03 | As a backend consumer, I want the API to return localized content based on my language preference so that I don't need client-side translation. | AC1: All content endpoints accept `Accept-Language: en|zh|km` header. AC2: Response includes localized strings for the requested language. AC3: If requested locale unavailable, fallback to EN with `Content-Language: en` response header. |
| US-F84-04 | As an admin, I want to manage translations for content so that the platform stays current across all languages. | AC1: Translation fields editable in admin panel for trips, places, hotels, guides. AC2: Required fields must have EN; ZH and KM are optional but encouraged. AC3: Validation warns when EN is missing. |

---

## Supported Languages

| Code | Language | Script | Primary Market |
|------|----------|--------|----------------|
| `en` | English | Latin | International tourists |
| `zh` | Chinese (Simplified) | Han | Chinese tourists (primary market) |
| `km` | Khmer | Khmer | Local Cambodian users |

---

## Content Translation Matrix

| Content Type | Fields to Translate | Storage Strategy |
|-------------|--------------------|-----------------|
| Trip packages | `name`, `description`, `itinerary_days[*].title`, `itinerary_days[*].description`, `included_items`, `excluded_items` | JSONB `translations` column |
| Places | `name`, `description`, `visitor_tips`, `dress_code` | JSONB `translations` column |
| Hotels | `name`, `description`, `amenities` | JSONB `translations` column |
| Hotel rooms | `name`, `description` | JSONB `translations` column |
| Guides | `bio`, `specialties` | JSONB `translations` column |
| Categories | `name`, `description` | JSONB `translations` column |
| Static UI text | All interface labels, buttons, error messages | next-intl JSON message files (frontend) |
| Email templates | Subject, body | Resend template variants per locale |
| Push notifications | Title, body | FCM message payload with locale key |

---

## Fallback Rules

```
1. User selected language (from profile or localStorage)
2. Browser Accept-Language header
3. Default: EN
```

For content fields:
```
1. Requested locale (e.g., ZH)
2. Fallback locale: EN
3. If EN missing: return key/placeholder with "[Translation missing]" indicator
```

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `I18N_001` | 400 | Unsupported language code in query param |

---

*Aligned with PRD section 7.9 and `.kiro/specs/frontend-nextjs-implementation/requirements.md`.*
