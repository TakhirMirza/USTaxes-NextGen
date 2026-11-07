# Stage 30 — integrated 2025 review boundary

Adds `form1040Pipeline2025.ts`, connecting the restricted W-2/1099-INT/Schedule 1 draft to documented withholding and the arithmetic-only Form 1040 reconciliation module.

Safety properties:
- No assumption that missing withholding categories are zero.
- No inference that omitted Schedule 1 entries are absent.
- No silent promotion of a draft or imported line 16 amount into the authoritative reconciliation input.
- Existing independently supplied withholding must agree with document-derived withholding.
- Missing reconciliation inputs and refund/carry-forward elections remain explicit blockers.
- `filingReady` is always false; this does not enable IRS PDF, e-file, or real filing.

Run targeted tests with `CI=true npm test -- --watch=false --runInBand --runTestsByPath src/nextgen/taxYears/form1040Pipeline2025.test.ts` after installing project dependencies.
