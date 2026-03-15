# Third-Party Notices

This repository contains and depends on third-party software components.
Those components remain under their own licenses. The PolyForm Noncommercial
license used for Hytale Asset Studio does not replace or override the licenses
of third-party dependencies.

This file is a practical notice for the direct dependencies declared by this
repository at the time of writing. It is not a substitute for a full legal
review of every transitive dependency that may be installed by package
managers or bundled during redistribution.

## Frontend direct dependencies

### Runtime

| Package | License |
|---|---|
| `@monaco-editor/react` | MIT |
| `@xyflow/react` | MIT |
| `dagre` | MIT |
| `elkjs` | EPL-2.0 |
| `monaco-editor` | MIT |
| `react` | MIT |
| `react-dom` | MIT |

### Tooling and development

| Package | License |
|---|---|
| `@eslint/js` | MIT |
| `@types/dagre` | MIT |
| `@types/node` | MIT |
| `@types/react` | MIT |
| `@types/react-dom` | MIT |
| `@vitejs/plugin-react` | MIT |
| `eslint` | MIT |
| `eslint-plugin-react-hooks` | MIT |
| `eslint-plugin-react-refresh` | MIT |
| `globals` | MIT |
| `openapi-typescript` | MIT |
| `typescript` | Apache-2.0 |
| `typescript-eslint` | MIT |
| `vite` | MIT |

## Backend direct dependencies

| Package | License |
|---|---|
| `fastapi` | MIT |
| `uvicorn` | BSD-3-Clause |
| `pydantic` | MIT |
| `httpx` | BSD-3-Clause |
| `pytest` | MIT |
| `pytest-cov` | MIT |

## Notes

- `uvicorn[standard]` pulls additional optional dependencies that are not listed
  individually in this file.
- If you redistribute packaged builds, installers, or vendor third-party code,
  review the full transitive dependency tree and include any required notices.
- `elkjs` is the main direct dependency here under a non-MIT permissive license
  (`EPL-2.0`), so keep that in mind if you later change how it is bundled or
  redistributed.

## Sources used for this notice

- frontend package metadata from `frontend/package.json` and installed package metadata
- backend package metadata from `backend/requirements.txt`, installed metadata, and upstream PyPI project pages when needed