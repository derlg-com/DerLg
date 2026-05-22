# ADR-0003: Auth & session — httpOnly refresh cookie, in-memory access token, middleware guards

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-22 |
| **Deciders** | Frontend platform team |
| **Tags** | `auth`, `security`, `session`, `middleware` |

---

## Context

DerLg has authenticated users (travelers booking trips) and the booking flow handles payments, refunds, and personal data. The backend's auth contract is already defined in [`docs/modules/auth/architecture.md`](../../../modules/auth/architecture.md) and [`docs/platform/architecture/security.md`](../../architecture/security.md):

- **Access token:** JWT issued by NestJS, **15-minute expiry**, returned in the response body of `POST /v1/auth/login`, `/v1/auth/register`, `/v1/auth/refresh`, and `/v1/auth/google/callback`.
- **Refresh token:** opaque (or JWT) handle stored in Redis with a **7-day TTL**, sent to the browser as an `httpOnly Secure SameSite=Strict` cookie. Rotated on every refresh (one-time-use).
- **Refresh endpoint:** `POST /v1/auth/refresh` reads the cookie, validates against Redis, rotates the token, and returns a new access token.
- **Google OAuth:** browser redirects to backend `/v1/auth/google`, which returns to `/v1/auth/google/callback` and finally back to the frontend with a fresh session.

The frontend needs to decide where the access token lives, how requests are authenticated, when the access token gets refreshed, and how protected routes are gated. Three forces shape the answer:

- **XSS risk.** Storing tokens in `localStorage` makes them readable by any script that runs in the page (third-party scripts, AI-rendered content). The frontend renders untrusted AI content (`content_payload`) — see [ADR-0001](./0001-app-router-server-components-default.md) and the AI content trust model — so `localStorage` is the wrong place for anything bearer-equivalent.
- **CSRF risk.** Cookies are sent automatically; if used naively for the access token they become a CSRF target. We mitigate by keeping the access token in JS memory (immune to CSRF) and using the cookie *only* for the refresh endpoint, which is `SameSite=Strict`.
- **Server Components.** The frontend uses Server Components by default ([ADR-0001](./0001-app-router-server-components-default.md)). The middleware runs at the edge and must be able to decide "logged in or not" without the access token (it's not in cookies) — so the middleware's signal is the **presence** of the refresh cookie, not its validity.

When this decision was taken:

- `frontend/middleware.ts` does not exist yet.
- `frontend/lib/api-client.ts` does not exist yet.
- No auth pages exist in `frontend/app/`.
- Backend auth flows are documented but the endpoints are not yet implemented.

Constraints:

- **Refresh token never touches JavaScript.** `httpOnly Secure SameSite=Strict` cookie only.
- **Access token never persisted.** Memory only. A page reload re-acquires it via `/v1/auth/refresh`.
- **Middleware is fast.** Edge runtime; no JWT decoding, no DB calls. Cookie presence check only.
- **Client Components do not call `lib/api-client` directly** — they go through React Query hooks per [ADR-0002](./0002-state-management-split.md). The hooks call `lib/api-client`; the api-client owns the 401 → refresh → retry handshake.

---

## Decision

We will store the **access token in memory only**, inside a Zustand `auth.store.ts`. The **refresh token lives only in an httpOnly cookie** set by the backend. The frontend never reads, writes, or sees the refresh token in JS.

Token refresh is **lazy**: the api-client retries a request once on a 401 by calling `POST /v1/auth/refresh`. If refresh succeeds, the original request is retried with the new access token; if it fails, the user is signed out and redirected to `/login?returnUrl=...`.

Route guards live in **`middleware.ts`** (Edge runtime). Middleware redirects unauthenticated users away from `(app)` routes by checking the **presence** of the refresh cookie — not its validity. Validity is established later by the api-client's first authenticated request.

Server Components requiring an authenticated identity call backend endpoints through a **server-side `lib/api/server.ts`** helper that forwards the request's cookies. Server Components do **not** read the access token (they don't have one); they rely on the cookie + a backend endpoint that accepts cookie auth for SSR-only paths, or they degrade to a public render.

> The boundary is: **`localStorage` never holds anything bearer-equivalent. The access token is JS memory only. The refresh token is httpOnly only. The middleware checks cookie presence; the api-client checks token validity.**

---

## Options considered

### Option A — Access + refresh tokens both in `localStorage`

- **Pros:** Simple. Same code path on first load and after refresh. No cookie setup.
- **Cons:** XSS exposes the refresh token, and the refresh token is the long-lived credential. A successful XSS means full account takeover. Unacceptable for a booking + payments product.

### Option B — Access + refresh tokens both in cookies (httpOnly)

- **Pros:** Browser handles everything; no JS handling at all.
- **Cons:** CSRF surface for the access token (every API call carries it). Requires a CSRF token on every mutation. Complicates third-party domains (e.g., AI agent WebSocket auth). Server Components and Client Components have to know how to read the access token differently, adding mental overhead.

### Option C — Access in memory, refresh in httpOnly cookie *(chosen)*

- **Pros:**
  - XSS cannot exfiltrate the refresh token (JS can't read it).
  - CSRF is mitigated for API calls because the access token rides in `Authorization` header (not in cookies for API calls), so cross-origin POSTs from attacker pages don't carry it.
  - Separates concerns cleanly: the cookie's only job is "let me refresh"; the access token's only job is "authenticate this request".
  - Logout becomes a single backend call that revokes the refresh in Redis and clears the cookie.
- **Cons:**
  - On a hard reload, there's a brief window where the user has a refresh cookie but no access token; the first request transparently triggers a refresh. Mitigated by an explicit "rehydrate" call in `app/providers.tsx` on mount.
  - Server Components that need authenticated data must use cookie-based auth on the backend or accept a degraded public render. We accept this — most authenticated screens fetch data on the client via React Query anyway, which kicks off the rehydrate flow.

### Option D — Access token in cookie + refresh token in cookie + CSRF token

- **Pros:** Strong defense in depth. Industry pattern.
- **Cons:** CSRF token plumbing (issue, store, send-with-every-mutation, validate) is non-trivial for a small team. Adds bundle size and review surface. Option C achieves the same threat-model wins without the CSRF token machinery for a product without same-domain administrative dashboards.

**Chosen:** Option C. The XSS surface is the dominant concern (AI content rendering, third-party scripts on payment pages), and Option C eliminates it for the long-lived credential while keeping the model simple enough for a one-person team to reason about.

---

## Consequences

### Positive

- A successful XSS cannot exfiltrate the refresh token. The blast radius is limited to the in-memory access token, which expires in 15 minutes.
- CSRF on API calls is mitigated by the access token not being in cookies.
- The middleware's logic is trivial (cookie presence) — fast at the edge, no JWT crypto.
- Logout is a single revocation call; clearing client state is straightforward.
- Login flow is uniform whether via email/password or Google OAuth — both end with the backend setting the refresh cookie and returning the access token in the body.

### Negative

- Hard refresh causes a brief flicker as the api-client rehydrates. Acceptable; we'll cover it with a skeleton.
- Server Components for authenticated views can't easily get an access token. They use either: (a) cookie-based backend endpoints for SSR-only data, or (b) skip server-render of authenticated data and let the client hydrate it via React Query. Most pages choose (b) by design.
- The api-client must serialize concurrent 401-triggered refreshes to avoid a thundering herd. We'll implement a single in-flight refresh promise.
- `httpOnly Secure SameSite=Strict` cookies break some cross-site flows (e.g., embedding the app in a different origin's iframe). Not a use case we have, but worth documenting.

### Neutral / things we accept

- The user must complete the OAuth round-trip in the same browser context (no popup-based OAuth). The redirect-based flow is simpler and more reliable on mobile Safari, our primary target.
- If the refresh cookie expires (7 days idle), the user is logged out and must sign in again. We accept this rather than implementing rolling sessions for now.
- Server Actions are not used for auth flows. All auth calls go through React Query mutations against the backend's REST endpoints, consistent with [ADR-0002](./0002-state-management-split.md).

---

## Implementation

### Files added or modified

- **`frontend/stores/auth.store.ts`** — Zustand store with `accessToken`, `user`, `isAuthenticated`, and `setSession`, `clearSession`. Uses `zustand/middleware` `persist` for `user` only — never the access token. The access token is in-memory and is lost on reload (intentional).
- **`frontend/lib/api-client.ts`** — `fetch` wrapper that:
  1. Reads access token from `auth.store` and sets `Authorization: Bearer ...`.
  2. Unwraps `{ success, data, message, error }` envelope; throws `ApiError` on `success: false`.
  3. On a 401, calls `refreshAccessToken()` (which itself hits `POST /v1/auth/refresh` with `credentials: 'include'`). If refresh succeeds, retries the original request once with the new token. If refresh fails, calls `clearSession()` and redirects to `/login?returnUrl=<current path>`.
  4. Serializes concurrent refreshes via a single in-flight promise.
- **`frontend/lib/auth/refresh.ts`** — Standalone refresh helper used by api-client and the rehydrate-on-mount hook.
- **`frontend/middleware.ts`** — Edge middleware that runs `next-intl` (per [ADR-0004](./0004-i18n-routing-strategy.md)) and then checks the refresh cookie presence for `(app)` routes. Redirects to `/login?returnUrl=...` when missing.
- **`frontend/app/providers.tsx`** — Calls `refreshAccessToken()` once on mount in a `useEffect` to populate the in-memory access token from the refresh cookie. Renders an auth-skeleton until the first attempt resolves.
- **`frontend/app/(auth)/login/page.tsx`**, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx` — Forms using React Hook Form + Zod, calling React Query mutations.
- **`frontend/app/(auth)/google/callback/page.tsx`** — Handles the OAuth round-trip return; reads `accessToken` from the response, populates the store, and redirects to `returnUrl`.
- **`frontend/hooks/use-auth.ts`** — React Query mutations for `login`, `register`, `logout`, `forgotPassword`, `resetPassword`. Wires `useChatStore` and `useBookingStore` cleanup on logout.

### Configuration

- `lib/api-client.ts` MUST send `credentials: 'include'` on all backend calls so the refresh cookie travels with same-origin (or properly CORS-configured) requests. Backend CORS must whitelist the frontend origin and `Access-Control-Allow-Credentials: true`.
- The cookie is set by the backend with `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=604800`.
- For local dev, the backend may relax `Secure` to allow HTTP localhost. The frontend doesn't need to know.

### Documentation that flows from this ADR

- [`reference/auth-and-session.md`](../reference/auth-and-session.md) — full contract: store shape, api-client refresh sequence, middleware matcher, OAuth round-trip, logout behavior. Authored once endpoints are implemented.
- [`guides/add-an-authenticated-route.md`](../guides/add-an-authenticated-route.md) — recipe.
- [`explanation/auth-trust-boundaries.md`](../explanation/auth-trust-boundaries.md) — XSS/CSRF threat model.

### Anti-patterns this decision rules out

- ❌ Storing the access token in `localStorage` "to survive refresh". A refresh roundtrip is fast enough; persistence is not worth the XSS exposure.
- ❌ Reading the refresh token in JavaScript "to inspect expiry". The cookie is httpOnly — JS cannot read it. The api-client treats refresh as opaque: try, succeed or fail.
- ❌ Putting auth checks in `layout.tsx`. Auth lives in `middleware.ts`; layouts only render conditional chrome.
- ❌ Calling `/v1/auth/refresh` proactively on a timer. We refresh lazily on 401; proactive refresh wastes requests on idle tabs.
- ❌ Decoding the JWT in the browser to decide whether to render protected UI. The store's `isAuthenticated` flag is the source of truth in the client; the middleware is the source of truth at the route boundary.
- ❌ Mixing logout flows. Logout always: (1) calls `POST /v1/auth/logout` to revoke the cookie + Redis entry, (2) calls `clearSession()` on every relevant store, (3) navigates to `/login`. No partial logouts.

---

## Links

- Related ADRs: [ADR-0001](./0001-app-router-server-components-default.md) (RSC default — required to understand why server-side reads can't access the token), [ADR-0002](./0002-state-management-split.md) (Zustand owns the auth store; React Query owns the auth mutations).
- Related docs: [`docs/modules/auth/architecture.md`](../../../modules/auth/architecture.md), [`docs/modules/auth/api.yaml`](../../../modules/auth/api.yaml), [`docs/platform/architecture/security.md`](../../architecture/security.md), planned [`../reference/auth-and-session.md`](../reference/auth-and-session.md).
- External:
  - [OWASP — Cross-Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
  - [OWASP — Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  - [Auth0 — Token Storage in the Browser](https://auth0.com/docs/secure/security-guidance/data-security/token-storage)

---

## History

| Date | Change |
|------|--------|
| 2026-05-22 | Created and Accepted. Aligns with backend's existing auth contract in `docs/modules/auth/`. |
