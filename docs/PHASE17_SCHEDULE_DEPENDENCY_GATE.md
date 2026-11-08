# Phase 17 — Schedules 1–3 dependency graph

Adds a conservative Form 1040 dependency view to the existing Review screen without changing the legacy-style UI or navigation.

- Explicit dependencies for 1040 lines 9, 11a, 15, 16, 18, 21, 24, 31, 33 and 34/37.
- Only limited arithmetic is compared; unimplemented Schedule 1–3 amounts are never fabricated as zero.
- CSV export, attention filter, and 12 fixture checks.
- No IRS submission, filing PDF, taxpayer identifiers, or actual financial data handling.
- Existing modules and their source files remain untouched, except the single integration component.

**Installation:** extract ZIP at repository root after `git pull --ff-only`. Run `npm run build` and existing tests before commit. This ZIP assumes Phase 16 is already installed.
