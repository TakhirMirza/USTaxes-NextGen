# USTaxes NextGen — Integrated foundation

## Delivered
- Tax Year Manager rendered in the existing React layout alongside YearStatusBar.
- The React view consumes a generated JSON manifest exported from the authoritative Node catalog, avoiding duplicated statuses.
- Year/form release gates remain **closed** for 2025, 2026, 2027 and 2028; the existing tax year dropdown is deliberately unchanged.
- IRS publication links and a separate CLI download/candidate workflow are available. No taxpayer data is sent to the IRS.
- Integration assertions check manifest consistency and React wiring.

## Commands
`node platform/cli/export-ui-manifest.js`
`node platform/tests/run.js`
`node platform/tests/integration.js`
`npm ci && npm run build` (requires internet and compatible Node/npm; not verified in this environment)

## Remaining before 2025/2026 can be selected
- Complete official-year-specific rules and Form 1040 tax table, credits, deductions, schedules, state tax support and tax-year-pinned PDF mappings.
- Typed adapter from legacy Redux tax data to canonical model and end-to-end UI/PDF workflow.
- Official IRS test vectors, independent tax review, build and browser validation.
- E-filing is not implemented.

## Architecture boundary
The read-only manager is integrated with React, but the NextGen engine is **not** yet wired to the filing workflow. Legacy 2020/2021 code remains intact. This is a tested architectural integration, not a completed tax-preparation product.
