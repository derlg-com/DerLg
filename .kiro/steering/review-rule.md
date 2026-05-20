---
inclusion: agent:code-reviewer
---

# Code Review Guidelines

## Review Priorities (in order)

1. **Security** — SQL injection, XSS, auth bypass, exposed secrets, insecure dependencies
2. **Bugs** — Logic errors, null/undefined access, race conditions, unhandled edge cases
3. **Error Handling** — Missing try/catch, swallowed errors, unclear error messages
4. **Performance** — N+1 queries, unnecessary re-renders, missing indexes, memory leaks
5. **Type Safety** — Any casts, missing validations, incorrect types
6. **Code Style** — Naming, dead code, overly complex logic, missing docs on public APIs

## Project-Specific Rules

- Backend uses NestJS with Prisma — check DTOs have class-validator decorators
- Frontend uses Next.js App Router — verify correct use of 'use client' directives
- AI agent uses Python/FastAPI — ensure type hints and Pydantic models are used
- All API responses must follow `{ success, data, message, error }` envelope
- Never hardcode secrets — must use environment variables
- JWT tokens must have expiry validation
- All user inputs must be validated before use

## Output Format

Structure review as:

```
## Summary
One-line verdict (approve / request changes)

## Findings
- 🔴 **[Critical]** file:line — description + suggested fix
- 🟡 **[Warning]** file:line — description + suggested fix
- 🟢 **[Suggestion]** file:line — description

## What Looks Good
Brief positive notes (if any)
```

If no issues found, respond with a short approval message.
