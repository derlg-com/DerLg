# Frontend Foundation

> The runtime contract for the DerLg frontend: language, framework, package manager, environment variables, and the local commands that get the app running. Lock these before anything else; everything in `architecture.md` and feature docs depends on them.

| Field | Value |
|-------|-------|
| **Owner** | Frontend platform team |
| **Status** | Active |
| **Last reviewed** | 2026-05-22 |
| **Related ADRs** | [ADR-0001](./adr/0001-app-router-server-components-default.md) |
| **Related code** | [`frontend/package.json`](../../../frontend/package.json), [`frontend/tsconfig.json`](../../../frontend/tsconfig.json), [`frontend/next.config.ts`](../../../frontend/next.config.ts) |
| **Steering** | [`.kiro/steering/tech.md`](../../../.kiro/steering/tech.md) |

---

## TL;DR

- **Next.js 16.2.6**, **React 19.2.4**, **TypeScript 5 strict**.
- **Node.js 20 LTS** for development and CI. `engines` in `package.json` enforces the floor.
- **npm** is the package manager (lockfile committed at `frontend/package-lock.json`). Do not introduce `yarn.lock` or `pnpm-lock.yaml`.
- All commands run from `frontend/` unless explicitly stated.
- Public environment variables MUST be prefixed with `NEXT_PUBLIC_`. Anything else stays server-only.

---

## Runtime contract

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | Next.js 16 (App Router) | No Pages Router. New routes go under `app/`. |
| UI library | React 19.2 | Server Components by default; `'use client'` is opt-in. |
| Language | TypeScript 5.x, `strict: true` | No implicit `any`, no unchecked indexed access. |
| Module resolution | `bundler` | Aligned with Next.js + Turbopack. |
| Package manager | npm 10+ | Single lockfile. PRs that change dependencies must commit the updated `package-lock.json`. |
| Node | 20 LTS (development, CI, Docker) | Specified via `.nvmrc` (commit one if missing). Build images use `node:20-alpine`. |
| Bundler | Turbopack (dev) / Webpack (build, until Turbopack production GA) | Configured by Next.js defaults; do not customize without an ADR. |

### Why these choices

- Next.js 16 + React 19 unlock Server Components, which materially reduce JS shipped to mobile users on Cambodian 4G/3G networks. This is the primary performance lever.
- npm (over pnpm/yarn) is chosen for tooling compatibility (Vercel, GitHub Actions, the rest of the monorepo). See [ADR-template] when revisiting.
- TypeScript strict mode is non-negotiable: AI-generated content payloads need runtime validation **and** compile-time guarantees on the renderer side.

---

## TypeScript configuration

`frontend/tsconfig.json` enforces:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./*"] }
  }
}
```

Rules:
1. **MUST** use the `@/` alias for imports outside the current feature folder. Relative imports stay within a feature.
2. **MUST NOT** weaken strictness for a single file with `// @ts-nocheck`. If a third-party type is wrong, augment it in `types/` and document why.
3. **MUST** type all exported functions explicitly (return types). Internal helpers can rely on inference.

---

## Environment variables

`.env.local` is gitignored. Every developer creates one. Required keys:

| Key | Public? | Purpose | Example |
|-----|---------|---------|---------|
| `NEXT_PUBLIC_API_URL` | ✅ | NestJS backend base URL | `http://localhost:3001` |
| `NEXT_PUBLIC_AI_WS_URL` | ✅ | AI agent WebSocket base URL | `ws://localhost:8000` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Self URL (used in canonical tags, share links) | `http://localhost:3000` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe Elements client key | `pk_test_...` |
| `NEXT_PUBLIC_SENTRY_DSN` | ✅ | Sentry browser SDK | `https://...@sentry.io/...` |
| `NEXT_PUBLIC_GA_ID` | ✅ | Analytics (optional) | `G-...` |
| `INTERNAL_API_KEY` | ❌ | Used only by Server Components / route handlers if needed | — |

Rules:
1. **MUST** prefix any browser-exposed variable with `NEXT_PUBLIC_`. Anything without the prefix is server-only and must never appear in client bundles.
2. **MUST NOT** put secrets (Stripe secret key, service tokens) in `NEXT_PUBLIC_*`.
3. **MUST** validate required env vars at startup. Fail fast in development; do not let undefined env values bubble into runtime.
4. **MUST** keep `frontend/.env.example` in sync with this table.

A startup validator like `lib/env.ts` using Zod is recommended:

```typescript
// frontend/lib/env.ts
import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_AI_WS_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
})

export const env = schema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_AI_WS_URL: process.env.NEXT_PUBLIC_AI_WS_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
})
```

Import `env` everywhere instead of `process.env`.

---

## Common scripts

Run from `frontend/`.

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start development server on `http://localhost:3000` (Turbopack). |
| `npm run build` | Production build. Fails on type errors and ESLint errors. |
| `npm run start` | Run the production build locally. Use after `npm run build`. |
| `npm run lint` | ESLint with `eslint-config-next`. CI runs this with `--max-warnings 0`. |
| `npm run typecheck` | `tsc --noEmit` (add this script if missing). |
| `npm run test` | Vitest in watch mode (interactive). See [`testing.md`](./testing.md). |
| `npm run test:ci` | Vitest single run with coverage report. |
| `npm run test:e2e` | Playwright E2E suite. |

Rules:
1. CI runs `lint`, `typecheck`, `test:ci`, `build` as separate jobs. Any red job blocks merge.
2. **MUST NOT** add `--ignore-scripts`, `--no-verify`, or skip pre-commit hooks in CI.
3. Pre-commit (via Husky or lefthook) runs `lint-staged` on changed files: ESLint + Prettier + typecheck of touched files.

---

## Directory layout (top-level)

```
frontend/
├── app/                  # App Router routes (see architecture.md)
├── components/           # UI components (see design-system.md)
├── lib/                  # Cross-cutting helpers: api-client, websocket, env, i18n
├── stores/               # Zustand stores (see state-and-data.md)
├── hooks/                # Reusable hooks
├── schemas/              # Zod schemas (AI content, forms, env)
├── types/                # Domain types and ambient declarations
├── public/               # Static assets, locales, manifest, favicons
├── middleware.ts         # next-intl + auth route guards
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs    # Tailwind v4 pipeline
└── package.json
```

For the rationale of each folder, see [`architecture.md`](./architecture.md).

---

## Linting and formatting

- **ESLint 9** with `eslint-config-next`. Flat config in `eslint.config.mjs`.
- **Prettier** runs via `lint-staged`. No semicolons, single quotes, trailing commas (per `.kiro/steering/tech.md`).
- **Import ordering** enforced (`eslint-plugin-import`):
  1. Node/framework (`react`, `next`, `next/*`)
  2. Third-party (`@tanstack/react-query`, `zod`, `zustand`)
  3. Internal aliases (`@/components`, `@/lib`)
  4. Relative (`./`, `../`)
  5. Type-only imports last
- **Accessibility** via `eslint-plugin-jsx-a11y` (already part of `eslint-config-next`). Violations fail the build.

---

## Browser and device support

| Tier | Targets | Notes |
|------|---------|-------|
| **Tier 1** (full support) | Chrome 110+, Safari iOS 16+, Edge 110+, Samsung Internet 22+ | Tested in CI via Playwright projects. |
| **Tier 2** (graceful) | Older Chromium-based browsers, last-2 Firefox | Should work; visual polish not guaranteed. |
| **Tier 3** (best-effort) | Older Android WebView | PWA must remain installable; offline shell must load. |

Network targets:
- 3G Slow (~400 Kbps, 400 ms RTT) is the **performance budget** (see [`performance.md`](./performance.md)).
- Booking flow must complete on Cambodian 4G with intermittent drops.

---

## Anti-patterns

- ❌ **Adding a second package manager.** Yarn or pnpm next to npm causes lockfile drift and Vercel/CI breakage.
- ❌ **Using `process.env.X` directly in components.** Always import from `lib/env`.
- ❌ **Casting around TypeScript errors with `as any` or `// @ts-ignore`.** Augment types in `types/` instead.
- ❌ **Adding non-Server-Component-safe code to a Server Component.** If you import a client-only library (e.g., Zustand) at the top of a server file, the build will fail; this is intentional.
- ❌ **Leaving env vars undocumented.** Every key in `.env.example` must appear in this doc.

---

## Acceptance criteria

- [ ] `frontend/package.json` `engines.node` is set and matches CI Node version.
- [ ] `frontend/.env.example` exists and matches the table above 1:1.
- [ ] `lib/env.ts` exists and is the only place reading `process.env` in client code.
- [ ] `tsconfig.json` enforces `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- [ ] CI runs `lint`, `typecheck`, `test:ci`, `build` as required checks.
- [ ] No `yarn.lock` or `pnpm-lock.yaml` exists in the repo.

---

## Open questions

- Should we adopt Corepack to pin npm version? (currently relying on developer-installed npm 10+)
- Do we add Husky vs lefthook for pre-commit? (lean toward lefthook for speed)
- Confirm Node 22 LTS upgrade window once Next.js 16 stabilizes against it.

---

## References

- [`architecture.md`](./architecture.md) — folder layout rationale
- [`testing.md`](./testing.md) — test runners
- [`deployment.md`](./deployment.md) — Docker image and CI/CD
- [`.kiro/steering/tech.md`](../../../.kiro/steering/tech.md)
- [`.kiro/steering/conventions.md`](../../../.kiro/steering/conventions.md)
