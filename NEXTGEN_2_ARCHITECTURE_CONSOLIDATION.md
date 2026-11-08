# USTaxes NextGen 2.0 — architecture consolidation (phase 1)

## Changes
- Removed IDE-specific `.idea/` files.
- Removed old `CI` workflow targeting `master`; current NextGen workflows remain.
- Replaced historical Stage 98/103 repository-wide ESLint baseline gate in NextGen validation with a NextGen-focused lint gate that **fails on errors** and reports warnings.
- Added a smoke gate for the NextGen `/start` and `/v2/*` entry routes.
- Retained Jest, React build, tax table source verification, architecture regression and existing release gates.

## Intentionally retained
The legacy components, Redux infrastructure, shared dependencies, and Tauri workflow have NOT been deleted: `App.tsx` currently mounts `Main.tsx`, which imports legacy modules even though `/start` routes to NextGen 2.0. Removing them without changing the root router and imports would break compilation.

## Next phase
Extract a standalone NextGen root/router, trace the import graph, and delete legacy runtime modules only after the NextGen build and tests pass. The GitHub Pages publishing path stays unchanged.

## Safety
This change does not make the application IRS filing-ready, does not add e-file, and does not change tax computation logic.
