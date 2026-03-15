# PUBLICATION1 — Remediation plan for public repo readiness

Issued from the audit performed on 2026-03-15.

Goal: bring Hytale Asset Studio to a state that can be published on a public repository without misleading users about maturity, while preserving the product constraint that the application is intended to run locally only.

This plan does not introduce new product features. It focuses on release hygiene, local-only hardening, documentation, validation, and targeted code quality fixes.

---

## Current audit verdict

The repository is not yet in a clean public-release state.

Main reasons retained:

- frontend quality gate is red: `npm run lint` currently fails on real React 19 / ESLint 9 issues
- backend local-only behavior exists mainly by convention and default launch scripts, not by strong server-side guardrails
- public-facing documentation is inconsistent with the actual project state
- no license file is present yet
- backend test execution could not be reproduced in the current environment because `pytest` is not installed locally

Positive signals retained:

- frontend production build passes
- frontend interaction contract test passes
- backend and frontend dev defaults already target `127.0.0.1`
- the repo has a clear architecture and existing audit/tracking discipline

---

## Lot 1 — Release blockers

Priority: P0

Objective: remove the blockers that make a public publication look unfinished or unreliable.

### 1.1 — Return the frontend to a green quality gate

Current issue:

- `npm run lint` fails on multiple files with `react-hooks/set-state-in-effect`, `react-hooks/purity`, `react-refresh/only-export-components`, `no-empty`, and a few dependency warnings

What must be done:

- fix the synchronous `setState` patterns flagged by React 19 rules
- remove impure render-time ID generation based on `Date.now()` where the rule fires
- split files or exports where `react-refresh/only-export-components` is legitimately violated
- remove empty blocks or replace them with explicit intent
- rerun `npm run lint`
- rerun `npm run build`
- rerun `npm run test:interaction-contract`

Acceptance criteria:

- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run test:interaction-contract` -> OK

---

### 1.2 — Clean public-facing repo hygiene

Current issue:

- no license file is present
- stray screenshots are present in the worktree and must not end up in a public release by accident
- public publication requires a deliberate statement of project maturity and scope

What must be done:

- add a `LICENSE` file once the license choice is decided
- verify `.gitignore` and tracked files to ensure no generated or personal artifacts are part of the published branch
- review whether any local screenshots or ad hoc files should be deleted or moved outside the repo

Acceptance criteria:

- a valid `LICENSE` file exists at repo root
- no screenshots or personal artifacts remain tracked for publication
- `git status` is understood before publication

Decision needed:

- choose the license
- default recommendation if no stronger distribution constraint exists: MIT or Apache-2.0

---

### 1.3 — Rewrite the public README surface

Current issue:

- root README still reads partly like a scaffolded or early-stage repo
- frontend README is still largely the stock Vite template
- backend README mentions machine-specific default paths that are no longer the effective code defaults

What must be done:

- rewrite `README.md` to describe the project as it exists today
- replace `frontend/README.md` with repo-specific frontend guidance
- align `backend/README.md` with actual runtime behavior and environment variables
- document the local-only intent explicitly in all three entry points
- document current status honestly: what is stable, what is still in progress, what validations are expected before using the tool

Acceptance criteria:

- a new user can understand what the tool does, how to launch it, and the current maturity level without reading source code
- docs do not mention stale machine-specific defaults as if they were repository defaults

---

## Lot 2 — Local-only hardening

Priority: P0

Objective: move from “local by default” to “explicitly local-only unless deliberately overridden by a developer”.

### 2.1 — Define and document the trust boundary

Current issue:

- the backend accepts user-supplied filesystem paths for workspace opening, project opening, project creation, and export
- this is acceptable for a local desktop tool, but only if the trust model is stated clearly

What must be done:

- write down the intended trust model in docs: local desktop tool, trusted local operator, no remote exposure supported
- add a short security note describing why arbitrary local paths are intentionally supported in this product model
- make it explicit that remote deployment is out of scope and unsupported

Acceptance criteria:

- trust model documented in `README.md` and backend docs
- no ambiguity about supported deployment mode

---

### 2.2 — Add backend guardrails for local-only serving

Current issue:

- the current protection relies mostly on launching uvicorn on `127.0.0.1` and on restrictive default CORS
- nothing in the application itself strongly signals or prevents a non-local deployment pattern

What must be done:

- define a runtime policy for local-only mode
- preferred direction: local-only mode enabled by default, with explicit opt-out env var for advanced development only
- add startup validation and/or request guardrails that make non-loopback exposure visible and intentional
- keep current dev workflow working on `127.0.0.1` and `localhost`

Examples of acceptable implementation directions:

- explicit `HAS_LOCAL_ONLY=1` default with request rejection for non-loopback origins when relevant
- startup warning or hard failure when configured origins or serving mode are broader than local loopback without explicit override
- clearer validation around `HAS_ALLOWED_ORIGINS`

Acceptance criteria:

- local-only policy is enforced or at minimum made explicit at runtime
- dev defaults remain simple on one machine
- unsupported remote deployment is harder to do by accident

---

## Lot 3 — Backend reproducibility and validation

Priority: P1

Objective: ensure the backend can be validated reproducibly by an external contributor.

### 3.1 — Reproduce backend tests in a clean environment

Current issue:

- `pytest` is listed in dependencies but was not installed in the current environment used for the audit

What must be done:

- create or verify a clean backend setup flow
- install backend dependencies in a dedicated venv
- run `pytest`
- record the exact expected command sequence in docs

Acceptance criteria:

- backend tests run successfully from the documented setup path
- setup instructions are reproducible for another machine

---

### 3.2 — Reassess backend publication risks after test pass

What must be done:

- rerun a short backend-focused audit after tests are reproducible
- verify path handling, project export, and workspace lifecycle behavior against the documented local-only trust model
- confirm that no accidental secrets, hard-coded machine paths, or hidden operational dependencies remain in shipping docs or code defaults

Acceptance criteria:

- backend public-release risk list is reduced to documented residual risks only

---

## Lot 4 — Frontend release hygiene

Priority: P1

Objective: move from “builds successfully” to “cleanly maintainable and presentable in public”.

### 4.1 — Stabilize React 19 patterns

What must be done:

- replace effect-driven state reset patterns with derived state, keyed subtree reset, reducers, or event-driven updates where appropriate
- centralize temporary ID generation in safe event-time helpers instead of render-time expressions
- reduce file-level rule suppressions and stale eslint disables

Acceptance criteria:

- React lint errors removed without papering over them with blanket disables

---

### 4.2 — Review bundle size warning

Current issue:

- frontend build emits a large chunk warning after minification

What must be done:

- measure whether the large chunk is acceptable for a local-only desktop-style tool
- if not acceptable, introduce targeted code splitting or chunking for heavy graph/editor areas
- document the decision either way

Acceptance criteria:

- chunk warning either removed or consciously accepted with rationale recorded in the tracker

---

## Lot 5 — Publication checklist and close-out

Priority: P0

Objective: finish the branch with a deliberate public-release checklist instead of an implicit “looks fine”.

### 5.1 — Final publication checklist

Checklist:

- root README updated
- backend README updated
- frontend README updated
- license added
- frontend lint green
- frontend build green
- frontend interaction contract test green
- backend tests green in documented venv
- local-only policy documented and implemented enough to avoid accidental misuse
- worktree reviewed for screenshots, caches, dist artifacts, and machine-local leftovers

### 5.2 — Session recap and archive readiness

What must be done:

- update `docs/docs_data/SESSION_RECAP.md` as the chantier progresses
- once all lots are done, archive the plan/tracker according to repo convention

---

## Suggested execution order

1. Lot 1.1 — frontend lint green
2. Lot 2.1 / 2.2 — local-only trust model and guardrails
3. Lot 1.3 — docs rewrite
4. Lot 3.1 — backend reproducible test setup
5. Lot 1.2 — final repo hygiene and license
6. Lot 4.2 and Lot 5 — release checklist and closure

---

## Residual risks to watch during execution

- the current workspace is dirty; remediation must avoid reverting unrelated user changes
- React 19 lint fixes may require structural refactors rather than local edits
- license choice is a product decision, not a purely technical one
- backend local-only hardening must not break legitimate single-machine development flows