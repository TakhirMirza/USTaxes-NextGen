# Stage 36 — 2025 standard deduction eligibility review

Added `standardDeductionReview2025.ts`, integrated with `form1040Pipeline2025.ts`.

The original basic standard deduction in the restricted draft is **illustrative only**. A new explicit questionnaire blocks treating it as reviewed when facts are missing or dependent/age/blindness/itemization/nonresident-alien circumstances require additional worksheets or legal analysis. This does not calculate the additional deduction or authorize filing.

Six Jest test cases are included. TypeScript compilation of the modified production modules succeeded using global tsc with `--noEmit --skipLibCheck --resolveJsonModule --esModuleInterop --target es2019 --module commonjs`. Full React build and Jest execution were not run.

References: https://www.irs.gov/instructions/i1040gi and https://www.irs.gov/publications/p501 .
