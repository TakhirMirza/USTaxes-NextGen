# USTaxes NextGen 2.0 — Federal Return Review UI (2025)

## Scope

- Adds a single integrated Review workpaper for Form 1040 lines 16–37.
- Reuses existing Schedule 1 income reconciliation, Schedules 1/2/3 candidates, and federal return balance arithmetic.
- Accepts explicitly reviewed amounts, including explicit zeros, for income tax, credits, withholding and payments.
- Reconciles Form 1040 line 25a with entered W-2 box 2 withholding.
- Blocks incomplete calculations and displays specific reasons.
- Displays all reconciled Form 1040 lines only after independent review gates pass.
- Exports a non-filing JSON reconciliation report.

## Safety / exclusions

This is NOT a filing-ready return. The UI does not infer credit eligibility, special tax calculations, source classifications, official PDF or e-file. It must not be used with actual taxpayer identifiers or confidential information. Existing GitHub Pages hosting is unchanged.

## Verification

Source-level integration was checked. Full CRA/CRACO build and browser tests require dependencies and should be confirmed in GitHub Actions. No assertion of passing CI is made by this archive.
