# USTaxes NextGen — final development handoff (2025)

**This is not a completed tax preparation product. Do not enter personal tax data or file returns with it.**

## Delivered in this handoff
- The existing 2025 review pipeline is now surfaced in the educational React UI. Users can explicitly review whether fictional examples have additional Schedule 1 amounts and withholding sources; the pipeline lists unresolved blockers.
- The tax-year roadmap text now describes the actual experimental scope.
- `node tools/release-readiness-2025.js` produces a conservative release checklist. `--json` gives machine-readable output; `--strict` always blocks release while this prototype is unverified.

## Outstanding blockers
1. Import all official 2025 IRS tax-table amounts with independent verification against an official source.
2. Complete and validate income classifications, all applicable schedules, Schedule 1-A eligibility, credits, deductions, and special tax worksheets.
3. Produce and verify IRS-compliant PDF forms, and define a lawful filing/e-file process.
4. Add privacy/security review, end-to-end and regression tests, and independently verify results against official IRS examples.
5. Run full npm dependency install, Jest tests, TypeScript checks, and production React build; these were not performed for this handoff.

## Safety
`filingReady` remains false and the UI never presents the restricted calculation as an approved return. A structural check or an example calculation is not a substitute for IRS tax-law verification.
