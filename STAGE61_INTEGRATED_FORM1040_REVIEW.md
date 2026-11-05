# Stage 61 — Restricted Form 1040 integration review (2025)

Adds `src/nextgen/taxYears/form1040IntegratedReview2025.ts` and four Jest scenarios. The new pipeline composes restricted Form 1040, Schedule 1-A, and Schedule 8812 review objects without posting any official return values.

## Safeguards
- Requires the restricted 2025 filing state from all upstream sources.
- Validates nonnegative cent amounts and the Schedule 1-A taxable-income arithmetic.
- Recomputes a *provisional* line 16 using the existing conservative IRS routing, requiring affirmative ordinary-income-method and no-special-worksheet confirmations.
- Compares the Schedule 8812 tax baseline with that provisional line 16. On mismatch, withholds both tentative credit amounts rather than reporting inconsistent credits.
- Retains upstream unresolved items and draft limitations; missing evidence is never silently interpreted as zero.
- Official lines 13b, 19, 28, 34 and 37 remain null. `filingReady` and `postingAuthorized` are always false.

## Verification
- Standalone TypeScript compile: passed.
- Four executable Node integration smoke checks against compiled JavaScript: passed.
- Four Jest test cases authored, not executed under Jest (project dependencies unavailable).
- Full React build not executed.

## Remaining work
Official 2025 Form 1040 line mapping, all additional income/tax/payment sources, special tax worksheets, Schedule 8812 complete credit allocation, complete eligibility evidence, PDF rendering, and end-to-end verification. Do not use for filing.
