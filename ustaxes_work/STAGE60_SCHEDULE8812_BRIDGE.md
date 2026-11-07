# Stage 60 — Schedule 8812 / Form 1040 candidate bridge

Added `src/nextgen/taxYears/form1040Schedule8812Bridge2025.ts` and seven Jest test scenarios.

The bridge separates nonrefundable (Form 1040 line 19 candidate) and refundable ACTC (line 28 candidate) amounts. It explicitly identifies ODC/ACTC allocation as an unresolved issue, applies a conservative upper bound on refundable child credit, and leaves both official Form 1040 lines `null` in all cases.

**Important:** this is NOT a completed Schedule 8812 computation. Stage 59's candidate may count unused ODC toward refundable ACTC; this bridge limits but does not fully resolve that issue. The official IRS worksheets, credit ordering, three-or-more-child special rules, eligibility and final return calculations must be implemented and independently verified before posting or filing.

Validation: standalone TypeScript compilation with `--resolveJsonModule --esModuleInterop`; three Node runtime assertions. Jest test cases are authored but not run; full React build not run.
