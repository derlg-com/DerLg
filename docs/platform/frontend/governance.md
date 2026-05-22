# Frontend Governance

> The rules of the road for the frontend codebase and its documentation. This is the doc reviewers cite when they say "no". It defines what makes a frontend PR mergeable, how docs evolve, when an ADR is required, and how decisions are challenged or retired.

| Field | Value |
|-------|-------|
| **Owner** | Frontend platform team |
| **Status** | Active |
| **Last reviewed** | 2026-05-22 |
| **Related** | [`adr/README.md`](./adr/README.md), [`.kiro/steering/conventions.md`](../../../.kiro/steering/conventions.md), [`.kiro/steering/git-workflow.md`](../../../.kiro/steering/git-workflow.md), [`.kiro/steering/review-rule.md`](../../../.kiro/steering/review-rule.md) |

---

## TL;DR

- A frontend PR is **not done** until the relevant docs in this folder are updated in the same PR.
- Architectural changes — new framework, new state lib, new boundary — require an **ADR merged first**.
- Every doc has an **Owner**, **Status**, and **Last reviewed** date. If `Last reviewed` is older than 6 months, it gets re-validated or archived.
- Steering files (`.kiro/steering/*`) win on cross-cutting rules. Platform docs (this folder) win on frontend-specific patterns. ADRs win on historical "why".

---

## Definition of done — frontend PRs

A frontend PR can be merged only when **all** of the following are true.

### Code
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:ci`, `npm run build` are all green in CI.
- [ ] No new ESLint warnings (CI runs `--max-warnings 0`).
- [ ] No `// @ts-ignore`, `// @ts-nocheck`, `as any`, or non-null assertions on AI-derived data.
- [ ] No new `console.log` left in code (use the Sentry breadcrumb pattern in [`observability.md`](./observability.md)).
- [ ] Every new Client Component starts with `'use client'` and a one-line comment explaining why.
- [ ] No raw user-facing strings — all text is an i18n key resolved through `next-intl`.
- [ ] Every form uses React Hook Form + Zod (see [`.kiro/steering/conventions.md`](../../../.kiro/steering/conventions.md)).
- [ ] Every API call goes through a React Query hook (Client) or `lib/api/*` server helper (Server) — not raw `fetch` in components.
- [ ] Every image uses `next/image` with explicit `width`/`height` or `fill` + `sizes`.

### Tests
- [ ] New logic has a corresponding unit test. New user-visible flows have an E2E test or an explicit waiver in the PR description.
- [ ] Coverage for changed files does not drop below 80%.
- [ ] Snapshot tests are not used for layout-sensitive components — prefer assertions on roles/text.

### Accessibility
- [ ] Interactive elements have appropriate roles, labels, or `aria-*` attributes.
- [ ] Keyboard navigation works (tested manually for new flows).
- [ ] Color contrast meets WCAG AA for new UI (verify with a contrast checker).
- [ ] Touch targets are ≥ 44px on mobile.

### Performance
- [ ] Bundle impact of new third-party dependencies is justified in the PR description (use `next build` output diff or a bundle analyzer).
- [ ] No synchronous JSON parses > 100 KB on the critical render path.
- [ ] New routes pass the Core Web Vitals budget in [`performance.md`](./performance.md).

### Security
- [ ] No secrets in `NEXT_PUBLIC_*`. Stripe publishable, GA, and Sentry DSN are the only allowed public keys.
- [ ] Any new HTML rendered from server data is sanitized with DOMPurify or rendered through a strict allowlist.
- [ ] Any new input from the AI agent is Zod-validated *before* being passed to a renderer.

### Documentation
- [ ] If the PR changes a documented pattern, the relevant doc in `docs/platform/frontend/` is updated in the **same PR**.
- [ ] If the PR introduces a new architectural decision, a corresponding ADR is added (or referenced if already merged).
- [ ] `Last reviewed` date is bumped on any doc that changes.
- [ ] If a public API contract changes (props of a shared component, store shape), the change is called out explicitly in the PR description.

### Process
- [ ] Branch follows `<type>/<short-description>` per [`.kiro/steering/git-workflow.md`](../../../.kiro/steering/git-workflow.md).
- [ ] Commit messages follow Conventional Commits.
- [ ] PR title follows commit format and is ≤ 70 characters.
- [ ] One feature/fix per PR. PRs > 400 LOC require justification.
- [ ] PR description has: what changed, why, how to test, screenshots/recordings for UI changes.
- [ ] At least one approving review from a frontend code owner.

---

## Documentation lifecycle

### Creating a new doc

1. Decide it's needed. If the topic fits in an existing doc, add a section there instead.
2. Copy [`_template.md`](./_template.md) into the right location.
3. Fill in the header (Owner, Status `Draft`, Last reviewed).
4. Open a PR. Title: `docs(frontend): add <topic>`.
5. After review, change Status to `Active` and add it to `index.md` document map.

### Updating a doc

1. Update content + `Last reviewed` date in the same PR as the code change.
2. If the change supersedes a previous decision, link the relevant ADR (and create a new ADR if the decision is irreversible).
3. Do not silently delete sections. If something is no longer true, replace it with an explicit "as of YYYY-MM-DD this is no longer in use" line, or move it to a `legacy.md` if the volume is significant.

### Deprecating a doc

1. Set Status to `Deprecated`.
2. Add a banner at the top: `> **Deprecated** as of YYYY-MM-DD. See [new-doc.md] instead.`
3. Keep the file around for one minor version cycle, then delete it.

### Periodic review

- Every quarter, the frontend lead opens a "doc audit" PR that checks every doc's `Last reviewed` date against current code. Stale docs get bumped or marked Deprecated.
- Any doc with `Last reviewed` older than 6 months and no associated code changes is automatically suspect — owner is pinged.

---

## When to write an ADR

You **MUST** write an ADR when the change is:

- **Cross-cutting** — affects more than one feature module or shared infrastructure.
- **Hard to reverse** — choosing a state library, a routing strategy, an auth model.
- **Adding a new tool, runtime, or framework** to the dependency tree.
- **Removing or replacing** an existing pattern.
- **Setting a precedent** other teams will copy.

You **SHOULD NOT** write an ADR for:

- Adding a new component to a feature folder.
- Refactoring within a single file.
- Changing styling, copy, or visual design.
- Routine library version bumps (unless there's a behavior change).

### ADR process

1. Open a PR adding `adr/NNNN-short-title.md` from [`adr/0000-template.md`](./adr/0000-template.md).
2. Status starts as `Proposed`.
3. Discuss in the PR; iterate until at least two frontend code owners approve.
4. Merge with Status `Accepted`, recorded date, and any code/doc changes that implement the decision.
5. ADRs are **immutable** after acceptance. To change a decision, supersede it with a new ADR and update the old one's Status to `Superseded by ADR-NNNN`.

See [`adr/README.md`](./adr/README.md) for the index.

---

## Source-of-truth precedence

When two sources contradict, here's the order:

1. **Code** — what actually runs.
2. **Steering files** (`.kiro/steering/*.md`) — cross-cutting rules that apply to all layers.
3. **Platform docs** (`docs/platform/frontend/*.md`) — frontend-specific patterns.
4. **ADRs** (`docs/platform/frontend/adr/*.md`) — historical "why".
5. **Roadmaps** (`docs/platform/roadmaps/frontend-roadmap.md`) — *what's next*, never *what is*.
6. **Specs** (`.kiro/specs/*`) — implementation tasks for in-flight work.

If the code disagrees with the docs, the code wins **and** a follow-up doc PR is mandatory.

---

## Anti-patterns in governance

- ❌ **"I'll update the docs in a follow-up PR."** Follow-ups don't happen. Update in the same PR.
- ❌ **Adding rules without enforcement.** If a rule isn't enforced by lint, CI, code review, or a checklist, it doesn't exist.
- ❌ **ADRs as suggestion documents.** ADRs are decisions. If you're proposing without committing, use a Discussion or an RFC issue.
- ❌ **Editing accepted ADRs.** Supersede them with a new one.
- ❌ **Silent deviations from the doc.** If you intentionally diverge, update the doc; if you unintentionally diverge, fix the code.

---

## Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Frontend lead** | TBD | Owns this folder, conducts quarterly doc audits, breaks ties on ADRs. |
| **Code owners** | Anyone listed in `CODEOWNERS` for `frontend/` | Approve PRs, enforce DoD checklist. |
| **Doc author** | The PR author for any doc change | Keeps `Last reviewed` accurate; resolves contradictions found during review. |

If `CODEOWNERS` doesn't exist yet, add it as part of the next housekeeping PR. Until then, the frontend lead is the sole owner.

---

## Acceptance criteria for this doc

- [ ] Every section above maps to a check that can be verified objectively.
- [ ] Every "MUST" rule is enforceable through lint, CI, code review checklist, or PR template.
- [ ] The PR template (`.github/pull_request_template.md`) references this doc's Definition of Done.
- [ ] `CODEOWNERS` for `frontend/` and `docs/platform/frontend/` is populated.

---

## Open questions

- Should we adopt a formal RFC process for frontend changes that don't quite warrant an ADR?
- Should ADRs auto-expire after N years requiring re-confirmation, or stay valid forever once Accepted?
- Do we mirror this Definition of Done into a GitHub Action that posts the checklist on every PR?

---

## References

- [`adr/README.md`](./adr/README.md)
- [`_template.md`](./_template.md)
- [`.kiro/steering/conventions.md`](../../../.kiro/steering/conventions.md)
- [`.kiro/steering/git-workflow.md`](../../../.kiro/steering/git-workflow.md)
- [`.kiro/steering/review-rule.md`](../../../.kiro/steering/review-rule.md)
