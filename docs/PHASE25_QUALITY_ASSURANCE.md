# Phase 25 — Federal Return Quality Assurance (2025)

Read-only cross-module source and exception consistency checks, synthetic $1 mutation checks for W-2 and 1099-INT when eligible, and CSV export without taxpayer names or monetary amounts.

## Boundaries
- Does not change the tax engine, source data, saved scenarios, or filing state.
- Mutation checks run on shallow, immutable test copies of the current input.
- Existing source errors can make a mutation test inconclusive; the UI reports failure rather than claiming a pass.
- Unsupported IRS rules, full payment coverage and e-filing remain explicitly unverified.
- GitHub Actions build success is not evidence of tax-law accuracy.

## Validation
Run `npm run build` before committing. Review the QA panel under Review and export the CSV using fictional test data.
