---
name: start-next-phase
description: "Kick off the next backend implementation phase from backend/context/plans/ROADMAP.md. Reads the roadmap and PROGRESS-TRACKER, identifies the next unfinished phase, creates a feature branch, asks the user three grouped questions to lock the spec scope, then scaffolds backend/context/feature-specs/YYYY-MM-DD-feature-name/ with plan.md, requirements.md, and validation.md following the established conventions. Finally updates PROGRESS-TRACKER.md. Use when the user says 'start the next phase', 'begin the next feature', 'kick off feature spec', or invokes /start-next-phase."
---

# Start Next Phase

Bootstraps a new backend feature-spec branch from `backend/context/plans/ROADMAP.md`. This skill is **backend-only** — it does not touch `frontend/context/`.

## Files this skill reads (source of truth — never invent content, always quote from these)

| Purpose | Path |
|---------|------|
| Phase list, dependencies, deliverables, verification | `backend/context/plans/ROADMAP.md` |
| Current phase status (what is done / in progress / not started) | `backend/context/plans/PROGRESS-TRACKER.md` |
| Mission, target state, principles | `backend/context/guides/MISSION.md` |
| Stack versions, tooling, env vars | `backend/context/guides/TECH-STACK.md` |
| Coding rules, layering, error style | `backend/context/guides/CONSTITUTION.md`, `backend/context/guides/CODE-STANDARD.md` |
| API contracts, schema, errors, events | `backend/context/specs/API-CONTRACT.md`, `SCHEMA.md`, `ERROR-REGISTRY.md`, `EVENT-CATALOG.md` |
| Test posture | `backend/context/plans/TEST-PLAN.md` |
| Prior feature specs (template reference) | `backend/context/feature-specs/*/` (latest dated dir is the canonical example) |

## Files this skill writes

| Path | Purpose |
|------|---------|
| `backend/context/feature-specs/YYYY-MM-DD-<feature-slug>/plan.md` | Numbered task groups |
| `backend/context/feature-specs/YYYY-MM-DD-<feature-slug>/requirements.md` | Scope, decisions, context |
| `backend/context/feature-specs/YYYY-MM-DD-<feature-slug>/validation.md` | How to verify done and merge-ready |
| `backend/context/plans/PROGRESS-TRACKER.md` | Append a "Recent Updates" row + flip phase status to 🟡 In Progress |

## Workflow (do these in order)

### Step 1 — Verify required files exist

Before reading anything, confirm these four exist. If any is missing, stop and tell the user which one — do not invent content.

```
backend/context/plans/ROADMAP.md
backend/context/plans/PROGRESS-TRACKER.md
backend/context/guides/MISSION.md
backend/context/guides/TECH-STACK.md
```

### Step 2 — Identify the next phase

1. Read `PROGRESS-TRACKER.md` first — its "Current Phase" table and per-phase status sections are the live state.
2. The **next phase** is the lowest-numbered phase whose status is `⬜ Not Started` AND whose dependencies (from `ROADMAP.md` → "Dependency Graph") are all `🟢 Complete`.
3. If a phase is `🟡 In Progress` and not owned by the agent (e.g. marked "(Senior)"), skip it and pick the next eligible one — but call this out to the user.
4. Read the corresponding phase section in `ROADMAP.md` to extract: goal, folder impact, task list, deliverables, verification, dependencies.
5. State your finding to the user in one sentence: *"Next phase: Phase N — <Name>. Dependencies <list> are complete. Proposing branch `feature/YYYY-MM-DD-<slug>`."*

### Step 3 — Create the branch

Use today's date (the harness provides it via the `currentDate` context block — do not hardcode).

```bash
git checkout -b feature/YYYY-MM-DD-<feature-slug>
```

The slug should be kebab-case and 2–4 words. Match the style of existing dirs in `feature-specs/` (e.g. `bootstrap-and-tooling`, `shared-kernel`, `auth-users`, `core-inventory`).

If the branch already exists, switch to it instead. If the working tree is dirty, stop and tell the user — do not stash or discard.

### Step 4 — Ask the user three grouped questions (REQUIRED)

You **must** call `AskUserQuestion` exactly once with all three questions in a single call, before writing anything to disk. The three questions are fixed in shape but must be tailored to the specific phase you found in Step 2:

1. **Scope** — should the branch cover the full phase as listed in `ROADMAP.md`, a named subset, or just the first task group?
2. **Test posture** — match the latest feature-spec convention. Options should reflect what the user has done before (e.g. tests in this branch, tests deferred to follow-up, tests for critical paths only). Read the most recent `feature-specs/*/requirements.md` "Tests" line to phrase the options accurately.
3. **Architecture / pattern** — which pattern does this module follow? Read the most recent `plan.md` to find the canonical pattern (currently the use-case pattern from `src/modules/auth/` and `src/modules/<catalog-feature>/`). Offer "match existing pattern" vs. "deviate (explain)" as the two options.

Do not proceed past this step until the user answers.

### Step 5 — Write the three spec files

Create directory `backend/context/feature-specs/YYYY-MM-DD-<feature-slug>/` then write the three files. Match the **structure, headings, and tone** of the most recent feature-spec dir (read it first as a template). Specifically:

#### plan.md

- Header block with: Phase, Branch, Started date, Status (🟡 In Progress), Architecture, Tests posture.
- A "Sequential implementation rule" or equivalent guard if the phase has multiple modules — copy the latest plan's wording.
- "Code Standard / Pattern" section quoting the canonical pattern (use-case template, controller template, module template) — only if applicable to this phase.
- "Folder Structure (target state)" — exhaustive tree of every file to be created or modified.
- **Numbered task groups** (Group 1, Group 2, ...). Each group ends with a per-module gate: lint, build, type-check, manual smoke, cache check (if applicable), tracker update, stop-and-confirm.
- "Files to Create / Modify" summary.
- "Cache TTL Summary" if the phase involves caching.
- "Risk & Decisions" table.
- "Definition of Done" checklist.

#### requirements.md

- Header block with: Feature, Branch, Phase, Date, Tests posture.
- **Scope** with "In scope" and "Out of scope" lists. Be specific — name the modules, endpoints, and capabilities.
- **Decisions** table (decision + rationale) — include any deviations the user just chose in Step 4.
- **Context** section pulling motivation from `MISSION.md` and constraints from `CONSTITUTION.md`.
- **Dependencies** section listing prior phases that must be complete (from `ROADMAP.md` → Dependency Graph).

#### validation.md

- Header block with: Branch, Phase, Test posture.
- **Verification Criteria** broken into:
  - Build & static checks (gating): `npm run lint`, `npm run format`, `npm run build`, `npx tsc --noEmit`.
  - Endpoint behaviour (manual smoke — gating): one checkbox per endpoint listed in `ROADMAP.md` for this phase, with the curl command and expected response shape.
  - Caching behaviour (gating, if caching is in scope): cache MISS / HIT logs, `redis-cli KEYS` patterns, TTL spot-checks.
  - Test coverage (gating only if tests are in scope this branch — otherwise list it as deferred and reference the follow-up branch).
- **Merge readiness checklist** — what must be true before this branch can merge to `main`.

### Step 6 — Update `PROGRESS-TRACKER.md`

Make two edits:

1. In the per-phase section for this phase, flip the status header from `⬜` to `🟡 In Progress` (if it was Not Started). Do not check off any deliverable rows yet — those flip as work lands.
2. Append a new row to the "Recent Updates" table at the bottom:

   ```
   | YYYY-MM-DD | N | Feature spec created for Phase N (<Name>); branch `feature/YYYY-MM-DD-<slug>` opened. Scope: <one line>. Tests: <posture>. | Agent |
   ```

Do **not** modify any other phase, milestone, or deliverable row.

### Step 7 — Report back

End with a short message:

```
Phase N — <Name> spec created.
- Branch: feature/YYYY-MM-DD-<slug>
- Spec dir: backend/context/feature-specs/YYYY-MM-DD-<slug>/
- PROGRESS-TRACKER updated.

Next: read plan.md and start Group 1.
```

## Hard rules

- **Never** invent phase content. Every deliverable, verification command, and dependency must be sourced from `ROADMAP.md` or the referenced spec docs. If you are unsure, quote the source file.
- **Never** skip the AskUserQuestion call in Step 4. If the user has not answered, do not write any spec files.
- **Never** modify any file outside `backend/context/` and `.git` branch state. Frontend, root configs, and source code are out of scope for this skill.
- **Never** mark deliverables 🟢 Complete in `PROGRESS-TRACKER.md` — this skill only opens a phase.
- **Never** commit or push. Branch creation is local only; the user runs commits themselves.
- **Always** mirror the structure of the most recent feature-spec dir for tone and section ordering.
- **Always** convert relative dates to absolute dates (YYYY-MM-DD) using the date provided in the harness `currentDate` context block.
