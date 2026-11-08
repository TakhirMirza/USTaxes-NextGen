# USTaxes NextGen 2.0 — Phase 2: independent application shell

## Delivered
- App.tsx now mounts the NextGen-only router, not the old Main.tsx navigation.
- index.js no longer initializes the legacy Redux store or persistence gate.
- New routing boundary serves `/start` and `/v2/*`; unknown URLs redirect to NextGen start.
- Legacy source code remains in the repository temporarily for dependency audit and safe later removal, but it is no longer mounted in the application.
- 2025 is the only supported calculation year. 2026–2028 remain explicitly unavailable; no unsupported tax rules are invented.
- Export filenames reflect the selected tax year.
- Both GitHub workflows run a NextGen-only entry boundary gate; Pages Node runtime aligned with validation.

## Limitations
- This is not IRS-approved tax preparation, electronic filing, or a verified tax calculation engine.
- A green CI workflow confirms build/tests, not completeness or correctness of tax law.
- The old source tree and dependencies are not yet deleted: do not delete them before a clean dependency analysis and successful build.

## Deployment
Replace repository files from this ZIP while preserving `.git`; commit and push to `main` through GitHub Desktop or your usual Git workflow. GitHub Pages remains the only hosting target.
