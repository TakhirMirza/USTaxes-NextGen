# NextGen 2.0 — Federal coverage and review package

This is an **incremental overlay** for the existing standalone Vite application, not a replacement repository. Copy only the files in this ZIP over the existing project. Do not delete the existing `src/nextgen/taxYears` tax engine.

## Changes
- 19-item federal forms / schedules coverage inventory, clearly distinguishing restricted previews from blocked and unimplemented modules.
- Coverage CSV export with no taxpayer identifiers, employer/payer labels, or financial values.
- Scenario import invalidates all previously asserted tax eligibility / computation confirmations. Review-only Schedule confirmations also reset.
- Scenario reset clears transient Schedule review confirmations.
- Keeps filing disabled and preserves the existing 2025 calculation modules and Vite / GitHub Pages workflow.

## Validation checklist
1. `npm run test:architecture`
2. `npm run build`
3. Check Overview / Review pages for the Federal Coverage Matrix and CSV export.
4. Import an old scenario with confirmations=true: all three confirmation checkboxes must be unchecked afterward.
5. Verify no real taxpayer information is used in testing.

This package does **not** validate IRS tax computations and does not enable tax filing.
