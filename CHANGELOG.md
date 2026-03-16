# Changelog

All notable changes to Hytale Asset Studio are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.2.0] — 2026-03-16

Full coverage of Hytale vanilla asset types with dedicated form editors. Every asset opened
in the side panel now shows a structured Form tab instead of raw JSON.

### Added

- **14 new form editors** covering all major Hytale Server asset categories:
  - *Lot 1 — Items / Blocks / Stats*
    - `DropTableFormEditor` — recursive Multiple / Choice / Single container editor.
    - `BlockFormEditor` — Identity, BlockType, Textures, Sound & Particles, Gathering, Aliases, ResourceTypes.
    - `EntityStatFormEditor` — Base values, Regeneration entries, MinValueEffects / MaxValueEffects.
  - *Lot 2 — Audio*
    - `SoundEventFormEditor` — Global settings, Layers list (Files, Volume, StartDelay, RandomSettings).
    - `ItemSoundSetFormEditor` — Slot → Sound Event ID mapping table.
  - *Lot 3 — Gameplay / Commerce / IA*
    - `BarterShopFormEditor` — Shop settings, Fixed/Pool trade slots, stock ranges.
    - `NPCGroupFormEditor` — IncludeRoles / ExcludeRoles / IncludeGroups / ExcludeGroups tag lists.
    - `TagPatternFormEditor` — Recursive Op tree (Equals / Or / And) with inline Tag field.
    - `ResponseCurveFormEditor` — Discriminated editor per curve type (Exponential, Logistic, SineWave).
  - *Lot 4 — Advanced types*
    - `MovementConfigFormEditor` — ~50 numeric fields across Base / Jump / Speed Multipliers / Air Control / Climb / Fly sections.
    - `GameplayConfigFormEditor` — Parent inheritance + Death / World / Player / ItemEntity / Respawn / Ping sections.
    - `ObjectiveFormEditor` — TaskSets[] with discriminated task editors (KillNPC, Gather, Craft, ReachLocation…) + Completions[].
    - `ReputationFormEditor` — Stats key-value table, Faction identity, FactionAllies / FactionEnemies, Attitudes.
    - `AmbienceFXFormEditor` — Conditions (DayTime / SunLightLevel / Walls min-max + EnvironmentTagPattern), AmbientBed, Music tracks.
  - *Lot 5 — Display-only*
    - `PrefabFormEditor` — Read-only metadata: version, blockIdVersion, anchorX/Y/Z, block count.
- **15 new `AssetKind` union members** in `assetTypeRegistry.ts` with ordered detection heuristics.
- **15 new path classification rules** in `backend/core/graph_service.py` (`_group_for_server_path`).
- **15 new node colours** in `frontend/src/components/graph/colors.ts`.
- **ESLint** — `varsIgnorePattern: "^_"` added to `@typescript-eslint/no-unused-vars` rule so
  destructuring-to-omit patterns (`const { [key]: _, ...rest }`) are lint-clean.

### Changed

- `AssetSidePanel.tsx` — 15 new `import` statements and `switch` cases wired to the new editors.

---

[Unreleased]: https://github.com/traker/HytaleAssetStudio/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/traker/HytaleAssetStudio/compare/v0.1.0...v0.2.0

First distributable release.

### Added

- **Standalone executable** — `HytaleAssetStudio.exe` (Windows, PyInstaller onedir).
  - No Python or Node.js required on the target machine (WebView2 Runtime only).
  - Native window via pywebview / EdgeWebView2.
  - Folder/file browse dialogs via `webview.FileDialog` (pywebview 4+ API).
  - Build script: `scripts/build-release.ps1` (npm build + PyInstaller + versioned zip).
- **Production serving** — FastAPI serves `frontend/dist/` via `StaticFiles`; `scripts/run.ps1` for non-GUI production mode.
- **Version tracking** — `VERSION` file at repo root; exposed via `GET /api/v1/health`.
- **Lock file** — `backend/requirements.lock` (uv pip compile, 43 packages pinned).

### Changed

- `GET /api/v1/health` now returns `{ "ok": true, "version": "0.1.0" }`.

### Fixed

- `uvicorn.Config` receives the FastAPI app object directly (string form fails in frozen bundles).
- `frontend/dist/` resolved via `sys._MEIPASS` when running as a frozen executable.

### Security

- Backend runs in `local-only` mode by default; non-loopback clients rejected with `403`.
- Crash log (`HytaleAssetStudio.log`) written next to the exe on startup failure (no silent crash).

---

[0.1.0]: https://github.com/traker/HytaleAssetStudio/releases/tag/v0.1.0

