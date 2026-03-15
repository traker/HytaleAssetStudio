# Frontend

The frontend is a React + TypeScript application built with Vite. It provides the Studio UI: workspace entry flow, project views, graph exploration, side panels, structured asset forms, and interaction tree editing.

## Local-only expectation

This UI is designed to talk to a backend running on the same machine.

- default dev host is `127.0.0.1`
- default dev port is `5173`
- API calls are proxied to the local backend through Vite
- remote deployment is outside the intended product model

## Install and run

From `frontend/`:

```powershell
npm install
npm run dev
```

The recommended full-stack launch remains the repository script:

```powershell
../scripts/dev.ps1
```

## Available scripts

- `npm run dev`: start the Vite dev server
- `npm run build`: TypeScript build + production bundle
- `npm run lint`: ESLint over the frontend source tree
- `npm run preview`: preview the production bundle locally
- `npm run test:interaction-contract`: frontend contract test for interaction graph import/export expectations
- `npm run codegen`: regenerate `src/api/generated.ts` from a locally running backend OpenAPI endpoint

For `npm run codegen`, the backend must be reachable on `http://localhost:8000/openapi.json`.

## Runtime environment

The dev launcher and Vite setup use these variables:

- `HAS_API_PORT`: backend port used by the frontend proxy
- `HAS_WEB_HOST`: frontend host, typically `127.0.0.1`
- `HAS_WEB_PORT`: frontend port, typically `5173`

## Current frontend status

The frontend is under active development but is already used as a real working surface for the Studio.

Current strengths:

- graph views for items, interactions, and modified assets
- side panel inspection for server JSON and common resources
- structured editing coverage for multiple asset families
- interaction tree editing with save-back to project overrides

Current caveats:

- the ELK layout engine remains a large lazy-loaded chunk by nature; the current build accepts it explicitly for the local-only use case after splitting the main bundle and graph vendors

## Architecture notes

### `src/api/`

| File | Role |
|---|---|
| `client.ts` | low-level HTTP primitives for internal API usage |
| `workspaceSession.ts` | workspace session state, API headers, typed frontend errors |
| `hasApi.ts` | typed API surface used by the UI |
| `types.ts` | hand-maintained request/response contracts used by source code |
| `generated.ts` | optional generated reference from OpenAPI |
| `index.ts` | barrel exports for the public frontend API layer |

### Contract strategy

`src/api/types.ts` remains the frontend source of truth for contracts used in application code.

`src/api/generated.ts` can be regenerated for comparison, but the project does not depend on live code generation during normal development. This keeps the frontend stable even when the backend is not running during CI or local editing.

### UI structure

The frontend is organized around a few main areas:

- app shell and workspace/project navigation
- graph components and layout helpers
- editor side panels and structured form editors
- project views (`config`, `items`, `interactions`, `modified`)
- frontend-only perf and contract utilities

