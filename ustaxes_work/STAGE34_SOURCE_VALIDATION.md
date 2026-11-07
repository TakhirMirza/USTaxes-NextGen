# Stage 34 — Cross-document input validation

The Form 1040 review pipeline now rejects missing/duplicate IDs across W-2 and 1099-INT, missing employer/payer labels, nonfinite/negative amounts, and sub-cent amounts before producing a draft. This closes a gap where the income preview allowed sub-cent values while the withholding bridge rounded cents.

Five regression cases were added. This remains an educational, non-filing-ready implementation. Official IRS 2025 tax-table values and full eligibility rules are not yet integrated.
