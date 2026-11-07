# NextGen 2.0 — Federal Return Coverage Review (2025)

## Scope
Adds an independent, deterministic coverage review to the NextGen 2.0 review screen. The new module separates **valid restricted source-to-1040 mapping** from **filing readiness**. It provides a traceable checklist for sources, income, standard deduction, line 16 tax, credits, payments, identity and official output.

## Guardrails
- No Form 1040 line 16 liability, refund or amount due is invented.
- The new review always sets `filingReady`, `canExportFilingForm`, and `canEfile` to `false`.
- Unknown or invalid source data blocks the dependent mapping checks.
- The existing W-2/1099-INT mapping and original tests remain intact.
- Preview continues to require fictional data only. No SSNs or real taxpayer data.

## Next major implementation
Implement IRS-verified 2025 tax tables and special tax methods, tax credits and schedules, payment reconciliation, independent regression fixtures, and official PDF form rendering. Each category must be supported and tested before filing readiness can be considered.
