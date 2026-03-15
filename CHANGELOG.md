# Changelog

All notable changes to Hytale Asset Studio are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.1.0] — 2026-03-15

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

[Unreleased]: https://github.com/your-org/HytaleAssetStudio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/HytaleAssetStudio/releases/tag/v0.1.0
