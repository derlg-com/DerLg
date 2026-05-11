# Operational Readiness

> **Phase 8** — Production concerns. Design these before launch, not after.

---

## Observability

| Concern | Approach |
|---------|----------|
| Health checks | `GET /health` — liveness (always 200), readiness (DB + Redis probes) |
| Metrics | Prometheus-compatible endpoint (`/metrics`) if needed; otherwise structured logs |
| Error tracking | Sentry integration — uncaught exceptions and Prisma errors reported with correlation ID |
| Tracing | Correlation ID propagated across all requests and AI client calls |

### Health Check Endpoint

```typescript
@Controller('health')
export class HealthController {
  @Get()
  async check(): Promise<{
    status: 'healthy' | 'degraded';
    timestamp: string;
    services: { database: 'up' | 'down'; redis: 'up' | 'down' };
  }>;
}
```

- Database probe: `prisma.$queryRaw` `SELECT 1`
- Redis probe: `set('health_check', 'ok')` then `del('health_check')`

---

## Data Integrity

| Concern | Policy |
|---------|--------|
| Backups | Supabase automated backups in production; local Docker volumes are ephemeral |
| Soft deletes | Global policy via Prisma middleware or base service; do not hard-delete user or transaction data |
| Audit log | Separate `audit_logs` table or append-only stream; record who, what, when for state-changing operations |

---

## Compliance

| Concern | Policy |
|---------|--------|
| GDPR / deletion | Right-to-erasure flow: anonymize PII, retain transactional records for legal compliance |
| PII handling | Encrypt sensitive fields at rest if required by jurisdiction; minimize logged PII |
| Data retention | Define retention windows per data class (e.g., logs 30 days, booking history 7 years) |

---

## Testing Strategy

| Level | Scope | Isolation |
|-------|-------|-----------|
| Unit | Services, utilities, DTO validation | In-memory, no DB |
| Property-based | Universal invariants (e.g., discount calculation accuracy) | `fast-check` with 100+ iterations |
| Integration | Controllers + services + Prisma | Test database or transaction rollback per test |
| E2E | Critical flows: auth, booking, payment | Full NestJS app bootstrapped; seed + cleanup per suite |

**Conventions:**
- Unit tests colocated as `*.spec.ts` in `src/`.
- E2E tests in `test/` as `*.e2e-spec.ts`.
- Database tests use a dedicated schema or transaction rollback to avoid state leakage.

**Coverage goals:**
- Unit test coverage: minimum 80%
- All correctness properties from design specs must have corresponding property tests
- Critical user flows must have E2E coverage

**CI pipeline:**
- Run unit tests + coverage on every PR
- Run property tests on every PR
- Run E2E tests before merge to `main`
- Require Postgres and Redis services in CI environment

---

## Deployment & Runtime

### Environment Variables

Required for production (also listed in `backend/.env.example`):

```bash
# Database
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...

# Auth
JWT_ACCESS_SECRET=xxx
JWT_REFRESH_SECRET=xxx

# Payments
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# AI Service
AI_SERVICE_KEY=xxx

# Cache / Sessions
REDIS_URL=redis://...

# Notifications
RESEND_API_KEY=re_xxx

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Application
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://derlg.com,https://www.derlg.com
```

### Graceful Shutdown

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
  await app.listen(3001);
}
```

### Performance Optimization

1. **Connection pooling:** Prisma `connection_limit = 100` in production
2. **Query optimization:** Use `select` to fetch only needed fields
3. **Redis caching:** Cache reference data (trips, exchange rates, weather) with TTL
4. **Response compression:** Enable gzip via `compression` middleware

### Logging Configuration

- **Production:** JSON logs (Pino/Winston) shipped to log aggregator
- **Development:** Human-readable console output
- **Redaction:** Passwords, tokens, card numbers, CVV always masked

---

## Decision Log

Record irreversible decisions here. Date each entry.

| Date | Decision | Context | Consequences if Reversed |
|------|----------|---------|--------------------------|
| 2026-05-10 | Custom JWTs issued by backend | Need refresh token rotation + logout-all-devices | Rebuild AuthModule, re-issue all tokens, migrate session state |
| | | | |

---

## Checklist

- [ ] `/health` endpoint with DB + Redis probes
- [ ] Sentry integrated and tested
- [ ] Soft-delete policy implemented globally
- [ ] Audit log mechanism created
- [ ] GDPR deletion flow documented
- [ ] Unit test conventions enforced (colocated `*.spec.ts`)
- [ ] Property-based tests configured (`fast-check`)
- [ ] E2E test suite covers auth and booking critical paths
- [ ] Database test isolation strategy implemented
- [ ] Graceful shutdown hooks enabled
- [ ] Response compression enabled
- [ ] Log redaction policy enforced
