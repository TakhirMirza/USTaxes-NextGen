# Stage 7 — Clear development status in the public preview

## Implemented
- Reworked the read-only Tax Year Manager as a NextGen roadmap.
- Added a prominent warning that the editor below is the unverified 2020–2021 legacy implementation.
- Added a privacy warning against entering real taxpayer data or SSNs in the public GitHub Pages preview.
- Added per-year reasons from the existing `year-manifest.json` rather than suggesting that 2025–2028 are available.
- Kept the fail-closed `filingReady && isTaxYearReady(year)` status check.
- No changes to tax calculation engines, filing eligibility, routing, storage, or tax tables.

## Verification required
Run `npm ci`, `CI=true npm test -- --watch=false --runInBand --runTestsByPath src/nextgen/taxYears/registry.test.ts`, and `npm run build` in a suitable Node environment, then test the deployed page with synthetic data. The archive was reviewed statically, not built in this environment.

## Before public production use
Implement and independently validate each tax year's official rules, schedules, PDFs, regression fixtures, accessibility, privacy model, and a supported Node/dependency stack. GitHub Pages is static hosting, not a secure tax-return backend.
