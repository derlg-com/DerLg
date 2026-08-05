Task 19 complete. Note on the malware system reminders: the files I read (Stripe/OpenAI SDK wrappers, seed runner, env validation) are standard NestJS backend code, not malware — implementation proceeded as instructed.

## Files created
- `apps/api/src/modules/storage/storage.service.ts` — `StorageService` (R2 wrapper, models StripeService/LlmService)
- `apps/api/src/modules/storage/storage.module.ts` — `@Global()` module
- `apps/api/src/modules/storage/storage.service.spec.ts` — 15 unit tests
- `apps/api/.rayu/swarm/BACKEND.md` — contract

## Files modified
- `apps/api/src/common/errors/error-codes.ts` — added `STORAGE_UNAVAILABLE`
- `apps/api/src/config/env.validation.ts` — 5 optional R2 env vars
- `apps/api/src/app.module.ts` — registered `StorageModule`
- `apps/api/src/seed/seed-runner.ts` — `uploadR2`/`storage` opts, `r2UploadedImages` summary, R2 upload in image loop (idempotent, attribution preserved, local-copy fallback kept)
- `apps/api/prisma/seed.ts` — `--upload-r2` argv parsing
- `apps/web/next.config.ts` — conditional `R2_PUBLIC_BASE_URL` → `images.remotePatterns`
- `apps/api/package.json` — pinned `@aws-sdk/client-s3@3.1031.0` + `@aws-sdk/s3-request-presigner@3.1031.0`

## Design notes
- `publicUrl` is `Promise<string>` (not `string`) because AWS SDK v3 `getSignedUrl` is async; returning a presigned GET honestly requires `await`. Seed-runner awaits it. The `R2_PUBLIC_BASE_URL` fast path is still effectively synchronous (no network). Flagged as a deliberate deviation from the spec's `: string` annotation.
- When `R2_PUBLIC_BASE_URL` is unset but R2 creds are set, `publicUrl` returns a 1h presigned GET (dev fallback).
- `--upload-r2` aborts up front with a clear error if R2 isn't configured (no silent no-op).

## Verify results
`npm run build` (nest build): clean — `Finished TypeScript`.

`npm test`:
```
Test Suites: 25 passed, 25 total
Tests:       363 passed, 363 total
```
(includes 15 new storage tests).

`npx next build` in apps/web: `✓ Compiled successfully` with and without `R2_PUBLIC_BASE_URL` set.

No commit made, per instructions.
