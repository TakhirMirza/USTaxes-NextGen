# Stage 41 — Senior deduction review integration (2025)

The candidate calculation for the Schedule 1-A senior deduction can now be supplied to `build2025Form1040Review` via optional `seniorDeductionFacts`. The pipeline returns the candidate and blocks line 16 when an unincorporated positive candidate or unresolved eligibility affects the taxable-income base. Filing-status contradictions are explicitly reported. No candidate is transferred to Form 1040 line 13b, and no filing readiness is asserted.

The integration is deliberately incomplete: verify eligibility, MAGI and the official worksheet before implementing the allowed Schedule 1-A deduction. Existing filing blockers remain. This is not tax-filing software.

Validation: TypeScript compilation of the pipeline and dependencies using global `tsc --noEmit --skipLibCheck --resolveJsonModule --esModuleInterop --target es2020 --module commonjs` succeeded. Jest tests were authored but not run; full React build was not run.
