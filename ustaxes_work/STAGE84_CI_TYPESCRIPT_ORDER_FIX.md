# Stage 84 — GitHub Actions TypeScript bootstrap fix

Observed failure in GitHub Actions run 42125006313: `Presentation regression (no dependencies)` failed with `spawnSync tsc ENOENT` before npm dependencies were installed. All downstream npm/Jest/build steps were skipped.

## Changes

- Run dependency-free lockfile and IRS table audits before installation.
- Run `npm ci` before TypeScript-dependent Stage 71 regression.
- Resolve Stage 71 TypeScript compiler exclusively from `node_modules/.bin/tsc` (no global compiler assumption).
- Run architecture and workflow regression after dependency installation.
- Retain Stage 82 outcome summary and Stage 83 completion gate, with failure on skipped checks.

## Verification scope

The workflow YAML and source-level ordering can be checked without installing packages. Full `npm ci`, Jest and React build must still run in GitHub Actions; this stage does not claim they pass.

Tax calculations and filing restrictions are unchanged.
