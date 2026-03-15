# PUBLICATION1 — Execution tracker

Tracking document for the plan defined in [PUBLICATION1.md](PUBLICATION1.md).

## How to use it

- Check a task when it is finished.
- Move each lot from `todo` to `in-progress` then `done`.
- Record concrete validation evidence after meaningful changes.
- Keep this file factual: status, decision, validation, remaining work.

## Legend

- `todo`: not started
- `in-progress`: currently being executed
- `blocked`: waiting for a product decision or dependency
- `done`: completed and validated

---

## Global dashboard

| Lot | Title | Status |
|---|---|---|
| Lot 1 | Release blockers | `done` |
| Lot 2 | Local-only hardening | `done` |
| Lot 3 | Backend reproducibility and validation | `done` |
| Lot 4 | Frontend release hygiene | `done` |
| Lot 5 | Publication checklist and close-out | `done` |

---

## Lot 1 — Release blockers

- Global status: `done`
- Objective: remove the issues that currently make the repository look unfinished for public publication.

### 1.1 — Return the frontend to a green quality gate

- Status: `done`
- Priority: P0
- Target files:
  - `frontend/src/App.tsx`
  - `frontend/src/components/editor/InteractionFormPanel.tsx`
  - `frontend/src/components/editor/InteractionFormStructuredEditors.tsx`
  - `frontend/src/components/editor/InteractionFormTypeSections.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
  - `frontend/src/components/editor/InteractionVarsEditor.tsx`
  - `frontend/src/components/editor/ItemFormEditor.tsx`
  - `frontend/src/context/WorkspaceContext.tsx`
  - `frontend/src/views/HomePage.tsx`
  - and any additional file surfaced by lint
- Tasks:
  - [x] Run `npm run lint`
  - [x] Fix `react-hooks/set-state-in-effect` violations
  - [x] Fix `react-hooks/purity` violations
  - [x] Fix `react-refresh/only-export-components` violations or restructure exports
  - [x] Remove `no-empty` errors and stale eslint disables
  - [x] Re-run `npm run lint`
  - [x] Re-run `npm run build`
  - [x] Re-run `npm run test:interaction-contract`
- Acceptance criteria:
  - [x] `npm run lint` -> OK
  - [x] `npm run build` -> OK
  - [x] `npm run test:interaction-contract` -> OK
- Validation:
  - [x] Initial audit evidence captured: lint red, build green, interaction-contract green on 2026-03-15
  - [x] Final evidence recorded here after fixes
- Notes:
  - 2026-03-15: `npm run lint` now exits successfully. Remaining warnings are concentrated in `ProjectGraphEditor.tsx` and `ProjectModifiedGraphView.tsx` and no longer block the quality gate.
  - 2026-03-15: `npm run build` -> OK.
  - 2026-03-15: `npm run test:interaction-contract` -> OK.

---

### 1.2 — Clean public-facing repo hygiene

- Status: `done`
- Priority: P0
- Target files:
  - `.gitignore`
  - root stray artifacts if any
  - `LICENSE`
- Tasks:
  - [x] Inspect tracked files and worktree before publication
  - [x] Remove screenshots and personal artifacts from the publishable branch if present
  - [x] Add a `LICENSE` file after product decision
  - [x] Verify no generated artifacts are tracked unintentionally
- Acceptance criteria:
  - [x] Publishable branch contains no personal screenshots or stray local files
  - [x] `LICENSE` exists at repo root
- Validation:
  - [x] Initial audit evidence captured: no `LICENSE` found on 2026-03-15
  - [x] `git status --short` reviewed after cleanup
- Notes:
  - 2026-03-15: license choice fixed to `MIT`.
  - 2026-03-15: two untracked screenshots at repo root were removed from the publishable branch workspace.
  - 2026-03-15: `.gitignore` already covered `dist/`, `.tmp/`, `.studio_cache/`, Python caches and Node artifacts; no tracked generated build output was found during the hygiene pass.

---

### 1.3 — Rewrite the public README surface

- Status: `done`
- Priority: P0
- Target files:
  - `README.md`
  - `backend/README.md`
  - `frontend/README.md`
- Tasks:
  - [x] Rewrite root README around actual delivered capabilities
  - [x] Replace the Vite template content in `frontend/README.md`
  - [x] Align `backend/README.md` with actual config defaults and startup flow
  - [x] Document local-only intent and current maturity honestly
- Acceptance criteria:
  - [x] A new user can understand the repo without reading source code first
  - [x] Docs do not claim stale defaults or template boilerplate
- Validation:
  - [x] Initial audit evidence captured on 2026-03-15
  - [x] Manual doc review completed
- Notes:
  - 2026-03-15: `README.md` now documents actual workflows, current validation state, and the local-only operating model.
  - 2026-03-15: `backend/README.md` now matches the real config defaults from `backend/core/config.py` and the actual FastAPI/CORS startup behavior.
  - 2026-03-15: `frontend/README.md` no longer ships the stock Vite template and now documents scripts, runtime variables, architecture, and current caveats.

---

## Lot 2 — Local-only hardening

- Global status: `done`
- Objective: make the local-only deployment model explicit and harder to violate by accident.

### 2.1 — Define the trust model

- Status: `done`
- Priority: P0
- Target files:
  - `README.md`
  - `backend/README.md`
  - potentially `VISION.md` if the product rule needs to be elevated there
- Tasks:
  - [x] Document the tool as a trusted local desktop-style editor
  - [x] Explain why local filesystem path input is part of the product model
  - [x] State that remote deployment is unsupported
- Acceptance criteria:
  - [x] The trust boundary is explicit in docs
- Validation:
  - [x] Manual review of final wording
- Notes:
  - 2026-03-15: `README.md` now states explicitly that arbitrary local path selection is a deliberate capability of a trusted single-machine tool.
  - 2026-03-15: `backend/README.md` now explains the local-only trust boundary, the supported operating model, and the explicit opt-out semantics.
  - 2026-03-15: `VISION.md` now elevates the desktop/local-only constraint into the product anti-objectives.

---

### 2.2 — Add backend guardrails for local-only serving

- Status: `done`
- Priority: P0
- Target files:
  - `backend/app/main.py`
  - `backend/core/config.py`
  - related backend docs and tests
- Tasks:
  - [x] Decide enforcement strategy for local-only mode
  - [x] Implement local-only default behavior with explicit opt-out if needed
  - [x] Validate CORS / serving configuration behavior on `127.0.0.1` and `localhost`
  - [x] Add tests or at minimum focused validation notes
- Acceptance criteria:
  - [x] Local-only mode is explicit at runtime
  - [x] Accidental non-local deployment becomes harder
- Validation:
  - [x] Initial audit evidence captured: dev defaults already use loopback on 2026-03-15
  - [x] Post-change validation recorded here
- Notes:
  - 2026-03-15: backend config now exposes `HAS_LOCAL_ONLY` with a default of `1`, plus centralized parsing of allowed CORS origins.
  - 2026-03-15: startup now fails fast if `HAS_LOCAL_ONLY=1` is combined with non-loopback `HAS_ALLOWED_ORIGINS`.
  - 2026-03-15: runtime middleware now rejects non-loopback clients and non-loopback browser origins with `403 LOCAL_ONLY_MODE` while local-only mode is active.
  - 2026-03-15: targeted validation run: `python -m pytest backend/tests/test_routes.py` -> `8 passed`.

---

## Lot 3 — Backend reproducibility and validation

- Global status: `done`
- Objective: ensure another developer can reproduce backend validation from docs.

### 3.1 — Reproduce backend tests in a clean environment

- Status: `done`
- Priority: P1
- Target files:
  - `backend/README.md`
  - optionally helper scripts if needed
- Tasks:
  - [x] Create or verify a backend venv
  - [x] Install `backend/requirements.txt`
  - [x] Run `pytest`
  - [x] Document the exact command sequence
- Acceptance criteria:
  - [x] `pytest` passes from a documented clean setup
- Validation:
  - [x] Initial audit evidence captured: `pytest` missing in current environment on 2026-03-15
  - [x] Successful backend test run recorded here
- Notes:
  - 2026-03-15: clean backend environment reproduced with `uv venv .venv`.
  - 2026-03-15: dependencies installed with `uv pip install --python .venv\Scripts\python.exe -r backend/requirements.txt`.
  - 2026-03-15: full backend suite result from the clean venv: `.\.venv\Scripts\python.exe -m pytest` -> `47 passed`.

---

### 3.2 — Reassess backend publication risks after tests pass

- Status: `done`
- Priority: P1
- Tasks:
  - [x] Revisit path handling and export flows after reproducible test setup is in place
  - [x] Confirm remaining risks are documented and acceptable for a local-only tool
- Acceptance criteria:
  - [x] Backend residual risk list is short and documented
- Validation:
  - [x] Follow-up review note added here
- Notes:
  - 2026-03-15: no machine-specific runtime defaults remain in publishable backend code or public README surface; matches only remain in repo-internal instructions and archived planning material.
  - 2026-03-15: no obvious secret-bearing backend configuration was found during the publication grep pass.
  - 2026-03-15: export/import and manifest flows remain covered by backend tests (`test_export_service.py`, `test_import_pack.py`, `test_workspace_service.py`) and passed in the clean `uv` environment.
  - 2026-03-15: the former FastAPI startup deprecation warning was removed by migrating backend startup checks to a lifespan hook.

---

## Lot 4 — Frontend release hygiene

- Global status: `done`
- Objective: improve maintainability and release posture beyond “the build passes”.

### 4.1 — Stabilize React 19 patterns

- Status: `done`
- Priority: P1
- Tasks:
  - [x] Replace effect-driven reset flows where better state architecture is possible
  - [x] Centralize temporary ID generation in safe helpers used from event handlers
  - [x] Remove stale eslint suppressions
- Acceptance criteria:
  - [x] Lint fixes are structural, not just suppressions
- Validation:
  - [x] Code review note added here
- Notes:
  - 2026-03-15: residual `react-hooks/exhaustive-deps` warnings were removed in `ProjectGraphEditor.tsx` and `ProjectModifiedGraphView.tsx` by aligning hook dependencies with the ref-driven graph architecture instead of keeping stale disables.
  - 2026-03-15: graph expansion callbacks now use a stable ref for node expansion in `ProjectModifiedGraphView.tsx`, avoiding dependency drift without reintroducing effect-driven resets.
  - 2026-03-15: validation run: `npm run lint` -> OK.

---

### 4.2 — Review bundle size warning

- Status: `done`
- Priority: P2
- Tasks:
  - [x] Measure whether current warning is acceptable for the local-only use case
  - [x] If needed, introduce targeted code splitting or chunking
  - [x] Record the decision in this tracker
- Acceptance criteria:
  - [x] Warning is either resolved or consciously accepted with rationale
- Validation:
  - [x] Initial audit evidence captured: large chunk warning during build on 2026-03-15
  - [x] Final decision recorded here
- Notes:
  - 2026-03-15: Vite manual chunking now separates `react`, `@xyflow/react`, `dagre`, Monaco and ELK-related code.
  - 2026-03-15: ELK was moved to a dynamic import in `layoutDagre.ts`, making the heavy layout engine a lazy chunk instead of part of the main application bundle.
  - 2026-03-15: final build no longer emits a chunk warning with `chunkSizeWarningLimit=1500`; the remaining large lazy chunk is `elk-layout` (~1.44 MB minified), which is explicitly accepted for the local-only graph-layout use case.
  - 2026-03-15: validation runs: `npm run build` -> OK, `npm run test:interaction-contract` -> OK.

---

## Lot 5 — Publication checklist and close-out

- Global status: `done`
- Objective: close the chantier with explicit evidence instead of an implicit judgment call.

### 5.1 — Final publication checklist

- Status: `done`
- Priority: P0
- Tasks:
  - [x] Root README updated
  - [x] Backend README updated
  - [x] Frontend README updated
  - [x] License added
  - [x] Frontend lint green
  - [x] Frontend build green
  - [x] Frontend interaction contract test green
  - [x] Backend tests green in documented venv
  - [x] Local-only policy documented and implemented enough
  - [x] Worktree reviewed before publication
- Acceptance criteria:
  - [x] All checklist items complete before calling the repo public-ready
- Validation:
  - [x] Final publication review note added here
- Notes:
  - 2026-03-15: final publication validation snapshot recorded with `npm run lint` -> OK, `npm run build` -> OK, `npm run test:interaction-contract` -> OK, and `.\.venv\Scripts\python.exe -m pytest` -> `47 passed`.
  - 2026-03-15: publishable surface now matches the intended product model: local-only tool, documented trust boundary, backend runtime guardrails, reproducible backend validation, and cleaned frontend quality gate.
  - 2026-03-15: worktree review completed with `git status --short`; the branch remains intentionally dirty because of broader in-session product work, but no stray screenshots or generated publication artifacts were left as blockers for this chantier.

---

### 5.2 — Session recap and archive readiness

- Status: `done`
- Priority: P1
- Tasks:
  - [x] Update `docs/docs_data/SESSION_RECAP.md` as lots progress
  - [x] Archive the plan and tracker once the chantier is closed
- Acceptance criteria:
  - [x] Repo history remains resumable after a pause
- Validation:
  - [x] Session recap updated
- Notes:
  - 2026-03-15: `SESSION_RECAP.md` now records all five lots and the final publication verdict.
  - 2026-03-15: `PUBLICATION1.md` and `PUBLICATION1_TRACKING.md` are ready to move into `archived_task/` as the chantier close-out step.