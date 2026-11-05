# Stage 74 — reproducible build dependency preflight

This stage introduces `tools/stage74-build-preflight.js` and its three automated tests.

## Commands
- `npm run preflight:build` — report declared/locked/installed dependencies without changing the repository.
- `npm run preflight:build:strict` — exit nonzero if any required dependency is missing.
- `npm run test:integration:2025` — run dependency-free compiled TypeScript integration checks.
- Once network access and dependencies are available: `npm ci`, then `npm run build`, then Jest.

## Observed results
- `npm ci --offline --ignore-scripts --no-audit --no-fund --prefer-offline` failed with `ENOTCACHED` for `yocto-queue`; this environment has no complete dependency cache.
- `node_modules` absent; six essential packages are declared and lockfile-listed but not installed.
- 11/11 Stage 73 executable integration checks passed.
- Existing Node test files and new preflight tests pass.
- **Full React build and Jest suite not run.** Do not interpret these tests as filing approval.

## Safety
This stage does not modify tax calculations or release readiness. `filingReady=false` and filing authorization remain blocked.
