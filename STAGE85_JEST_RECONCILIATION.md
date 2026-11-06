# Stage 85 — Jest regression reconciliation (development only)

Based on Stage 84 GitHub Actions failure: 7 failed suites / 9 failed assertions (215 passed).

## Changes
- 2025 line 16: published, individually verified sample cells take precedence over the full imported table. Other structurally validated imported rows remain **unverified-import-candidate**, not approved values; missing eligibility still blocks.
- Updated stale Jest expectations to reflect the bundled full 2025 Tax Table. The import is **not** filing authorization.
- Schedule 1-A pipeline regression now checks unchanged draft income lines and blocked line 16 separately, rather than comparing diagnostic warning strings verbatim.
- Form 1040 presentation fixture now supplies all 12 official blank fields, matching the strict production contract; the strict contract was not weakened.
- Missing spouse SSN evidence now produces a fail-closed blocker instead of throwing; malformed values still throw. Added explicit regression.
- Stage 75 workflow test now recognizes the Stage 84 multi-line, logged React build step.

## Checks executed in packaging environment
- Stage 71 presentation regression: 13 assertions passed.
- Stage 73 integration regression: 11 assertions passed.
- Node tool tests: 29/29 passed.
- Architecture tests: 12 passed.
- IRS runtime table audit: 2,062 intervals / 8,248 cells, matching source CSV.
- Global TypeScript `tsc --noEmit` for modified runtime modules: passed.

## Not verified here
- Full Jest suite (requires npm dependencies, not installed in this environment).
- Full React production build (requires npm dependencies).
- GitHub Actions and GitHub Pages deployment.

This project remains **NOT FILING READY**. All candidate tax figures are diagnostic only.
