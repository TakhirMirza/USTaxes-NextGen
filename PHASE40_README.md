# Phase 40 — Multi-Year Tax Architecture

- Adds an isolated 2025–2028 year capability registry, explicit status per feature, and unknown-year rejection.
- Adds a year comparison UI on Overview with a CSV capability audit.
- Explicitly blocks production calculations, official PDF filing and e-file for every year.
- Does not copy 2025 rules into 2026–2028 and does not migrate or overwrite saved drafts.
- The existing 2025 workbench is preserved. No real taxpayer data should be entered.

## Install
From the repository root, after `git pull --ff-only origin main`, extract this ZIP, then run `bash INSTALL_PHASE40.command`. The installer builds, runs architecture tests, commits and pushes only if checks succeed.
