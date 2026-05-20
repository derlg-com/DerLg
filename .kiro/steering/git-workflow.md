---
inclusion: always
---

# Git Workflow

## Branch Naming

```
<type>/<short-description>

feat/vibe-booking-chat
fix/payment-qr-timeout
chore/update-prisma-schema
refactor/auth-guard-cleanup
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`

## Commit Messages

Follow Conventional Commits:

```
<type>(<scope>): <description>

feat(booking): add 15-min hold with Redis TTL
fix(chat): handle WebSocket reconnection on network drop
chore(deps): bump prisma to 6.2.0
refactor(auth): extract JWT validation to guard
```

- **Scope**: module name (`booking`, `chat`, `auth`, `trips`, `payments`, `ai-agent`)
- **Description**: imperative mood, lowercase, no period, max 72 chars
- **Body** (optional): explain WHY, not what

## PR Conventions

- Title follows commit format: `feat(booking): add availability check`
- One feature/fix per PR — keep PRs under 400 lines when possible
- Description includes: what changed, why, how to test
- Link related issues
- Must pass CI (lint + tests) before merge
- Squash merge to main

## Branch Strategy

```
main (production-ready)
 └── feat/feature-name (short-lived, merge back to main)
```

- No long-lived branches — merge within 1-3 days
- No direct commits to `main`
- Delete branch after merge
