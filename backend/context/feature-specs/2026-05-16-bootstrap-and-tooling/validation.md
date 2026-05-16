# Phase 0: Bootstrap & Tooling — Validation

> How we know this implementation is complete and ready to merge.

---

## Pre-Merge Checklist

Run these commands in the `backend/` directory and confirm all pass.

### 1. Build
```bash
npm run build
```
- [ ] Exits with code `0`
- [ ] No TypeScript compilation errors
- [ ] `dist/` directory is generated with compiled output

### 2. Lint & Format
```bash
npm run lint
npm run format
```
- [ ] `lint` exits with code `0` (zero unfixable errors)
- [ ] `format` exits with code `0` (all files already formatted)
- [ ] No Prettier/ESLint warnings that are actionable

### 3. Docker Compose (Development)
```bash
docker-compose up -d
```
- [ ] `redis` container starts and passes health check
- [ ] `docker-compose ps` shows Redis as `healthy` or `running`
- [ ] `docker-compose down` stops Redis cleanly

### 4. Docker Compose (Production)
```bash
docker-compose -f docker-compose.prod.yml up -d
```
- [ ] `postgres` container starts and passes health check
- [ ] `redis` container starts and passes health check
- [ ] `docker-compose -f docker-compose.prod.yml ps` shows all services healthy
- [ ] `docker-compose -f docker-compose.prod.yml down` stops all services cleanly

### 5. Environment Variables
- [ ] `.env.example` exists in `backend/`
- [ ] Every required variable from `TECH-STACK.md` §Environment Variables is listed
- [ ] No real secrets or credentials are present
- [ ] All variables have a comment explaining their purpose
- [ ] Supabase dev connection pattern is documented (`DATABASE_URL` pooler + `DIRECT_URL` direct)
- [ ] Production Docker connection pattern is documented

### 6. Health Endpoint
```bash
curl -s http://localhost:3001/health | jq .
```
- [ ] Returns HTTP `200 OK`
- [ ] Response body contains `status: "ok"`
- [ ] Response body contains `service: "derlg-backend"`
- [ ] Server is confirmed listening on port `3001`

### 7. Dockerfile
- [ ] `Dockerfile` exists with multi-stage targets: `deps`, `build`, `production`, `development`
- [ ] `production` target uses `dumb-init` for signal handling
- [ ] `development` target runs `npm run start:dev`
- [ ] `docker build --target production -t derlg-backend .` succeeds

### 8. Code Review Gates
- [ ] No `any` types introduced (existing boilerplate `any` is acceptable)
- [ ] No new dependencies added without justification
- [ ] No changes to `prisma/schema.prisma`
- [ ] `README.md` in `backend/` is updated with setup instructions (optional but recommended)

---

## Post-Merge Actions

After this branch is merged, update the following files:

1. **`backend/context/plans/PROGRESS-TRACKER.md`**
   - Mark Phase 0 deliverables as complete (see Milestone M0).
   - Update Milestone Tracker: M0 → `Complete`.

2. **Next Branch**
   - Create follow-up branch for Task 0.6 (GitHub Actions CI) or proceed to Track 1 (Shared Kernel).

---

## Failure Scenarios

If any validation step fails, the branch must NOT merge:

| Failure | Action |
|---------|--------|
| `npm run build` fails | Fix TypeScript config or code errors before merging |
| `npm run lint` fails | Run `npm run lint -- --fix` or manually fix violations |
| Docker service unhealthy | Check `docker-compose logs`, fix service config |
| Health endpoint 404 | Verify controller is wired in `AppModule` |
| `.env.example` missing vars | Add missing variables with comments |
| Dockerfile build fails | Check stage dependencies and COPY paths |
