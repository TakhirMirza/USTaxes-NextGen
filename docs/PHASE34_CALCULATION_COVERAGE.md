# Phase 34 — 2025 Form 1040 arithmetic coverage matrix

Adds a Review panel that dynamically exercises all 12 arithmetic assertions already implemented in Phase 32. Each rule receives three local probes: the balanced fictional fixture, a $1 mutation of its target, and a missing target. Coverage is not inferred from the existence of source files; it is computed by executing the existing validator. Filtering and CSV export are available.

## Scope and limitations

- 12 arithmetic assertions, 30 Form 1040 line fields, and the existing five fictional scenarios.
- Coverage describes *validator response* only. It is not a measure of IRS tax-rule correctness or filing readiness.
- No personal data or local storage access. No network requests. No e-file capability.
- Status is always filing-disabled. The panel only appears for 2025.

## Validation

Run `npm run build` and `node tests/phase34-calculation-coverage.test.mjs` after extracting this overlay into the current project. Review the coverage panel under Review and download CSV if needed.
