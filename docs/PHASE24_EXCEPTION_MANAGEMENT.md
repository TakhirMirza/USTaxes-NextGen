# Phase 24 — Federal Return Exception Management (2025)

Adds a consolidated read-only exception register in the existing Review step.

- Aggregates Phase 23 source integrity issues without altering source records.
- Adds mandatory coverage gates for full Form 1040, tax rules, payments/refunds and IRS filing.
- Supports severity filtering and navigation to Income or Deductions.
- Exports CSV with codes and descriptions only, never names or amounts.
- Filing remains disabled even when the source-level issue count is zero.

This is a diagnostic development preview, not a tax preparation certification or filing service. Apply after Phase 23. Validate with `npm run build` before committing.
