# Phase 9 — 2025 federal income bridge (read-only)

Adds an integrated income-source worksheet to the restored UI in Income and Review. Deterministic cents parsing and safe-integer arithmetic connect W-2 Box 1 / Box 2, 1099-INT Box 1, and reconciled Schedule 1 candidates to a transparent draft worksheet.

**Not a completed Form 1040 calculation:** other 1040 income lines are not represented. Consequently the preview totals are deliberately named `9-preview` and `11-preview` and MUST NOT be interpreted as Form 1040 lines 9 and 11 or AGI. Missing values are not zero. All filing and PDF submission remain disabled.

Controls: rejects invalid/non-cent monetary input, preserves unknowns, requires schedule reconciliation, blocks unsupported years, prevents unsafe integer overflow, and exports status-only CSV without names or amounts. The package does not introduce a new UI shell.

## Installation

Apply on top of Phase 8. Run `npm run test:architecture` and `npm run build` before Git commit/push. Source module: `src/nextgen/taxYears/form1040IncomeBridge2025.ts`.
