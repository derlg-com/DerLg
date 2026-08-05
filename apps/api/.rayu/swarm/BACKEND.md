# Backend — Task 19 (Cloudflare R2 image storage)

## Stack
typescript, nestjs, db:postgres (detected & respected; no new framework introduced)

## New module: `src/modules/storage/`
- `storage.module.ts` — `@Global()` module exporting `StorageService`. Registered in `app.module.ts` imports (next to `LlmModule`).
- `storage.service.ts` — thin wrapper over `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (pinned `3.1031.0`, exact). Models `StripeService`/`LlmService`: lazy `requireClient()`, `isConfigured` getter, 503 `STORAGE_UNAVAILABLE` when not configured.
- `storage.service.spec.ts` — 15 unit tests, AWS SDK mocked wholesale, network-free.

### StorageService API
All methods throw `AppException(STORAGE_UNAVAILABLE, msg, 503)` when R2 is not configured.

| Method | Signature | Notes |
|---|---|---|
| `isConfigured` | `getter: boolean` | true only when all of `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET` are set. |
| `presignPut` | `(input: { key, contentType, contentLength? }) => Promise<{ url, method: 'PUT', headers }>` | 5-min presigned PUT; signs `Content-Type` + `Content-Length`. |
| `publicUrl` | `(key) => Promise<string>` | Returns `${R2_PUBLIC_BASE_URL}/${key}` when base set (no network); else 1h presigned GET. **Async** (AWS SDK v3 signs async). |
| `presignGet` | `(key) => Promise<string>` | 1h presigned GET (explicit async variant). |
| `exists` | `(key) => Promise<boolean>` | HEAD; false on NotFound/404, rethrows other errors. |
| `uploadFromBytes` | `(input: { key, body: Buffer, contentType }) => Promise<void>` | Direct PUT (seed uses this). |
| `deleteMany` | `(keys) => Promise<void>` | Bulk delete (future cleanup). |
| `keyFor` | `(input: { citySlug, placeSlug, index, ext }) => string` | `seed/<city>/<place>/<index+1><ext>` — drop-in for local `/seed` path. |

S3 client: `region: 'auto'`, `endpoint: https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, `forcePathStyle: false`. Created lazily (`this.client ??= ...`).

## Error code
`STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE'` added to `src/common/errors/error-codes.ts` (under "Storage", after PAYMENT block). HTTP 503.

## Env vars (`src/config/env.validation.ts`)
All `@IsOptional() @IsString()` (mirrors the Stripe block; `validateEnv` already maps `'' → undefined`):
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.

## Seed integration (`src/seed/seed-runner.ts`, `prisma/seed.ts`)
- `SeedOptions.uploadR2?: boolean` and `storage?: StorageService` (test injection) added.
- `SeedSummary.r2UploadedImages: number` added (count of images actually uploaded this run; skipped-existing ones don't count).
- `prisma/seed.ts` parses `process.argv` for `--upload-r2`.
- When `uploadR2` is true: builds `StorageService` from `process.env` outside the Nest container (unless `storage` injected). Aborts up front with a clear error if R2 is not configured (no silent no-op).
- Image loop: computes `key` via `storage.keyFor(...)`, calls `storage.exists(key)` (idempotent skip), else `readFileSync` + `storage.uploadFromBytes(...)`, then `url = await storage.publicUrl(key)`. Local `/seed` copy still runs when `copyImages` is on (filename derived from index, not from `url`, so presigned-GET query params can't corrupt it).
- Attribution (`author`/`license`/`sourceUrl`) preserved unchanged — CC BY-SA licence obligation.

## Web (`apps/web/next.config.ts`)
`images.remotePatterns` now built at config time from `process.env.R2_PUBLIC_BASE_URL` (parsed via `URL`). Conditional — nothing added when unset, so dev/CI without R2 still build. Malformed URL is ignored (won't break the build).

## Dependencies
`@aws-sdk/client-s3@3.1031.0`, `@aws-sdk/s3-request-presigner@3.1031.0` (exact pin, in `apps/api/package.json` `dependencies`).

## Verify
- `npm run build` (nest build) — clean.
- `npm test` — 25 suites, 363 tests pass (incl. 15 new storage tests).
- `npx next build` in apps/web — passes with and without `R2_PUBLIC_BASE_URL`.