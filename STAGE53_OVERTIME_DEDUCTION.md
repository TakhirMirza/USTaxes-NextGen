# Stage 53 — Schedule 1-A qualified overtime (2025)

Introduces `src/nextgen/taxYears/schedule1AOvertime2025.ts` with a bounded, evidence-gated calculation of the **candidate** qualified overtime deduction. Uses the FLSA premium only (not total overtime wages), the $12,500 / $25,000 statutory caps, MAGI thresholds $150,000 / $300,000, and the $100 per $1,000 or fraction thereof reduction. Refuses to calculate a candidate when FLSA documentation, valid SSN or married filing status is unverified. Never writes Form 1040 line 13b and always `filingReady: false`.

Source: user-provided IRS 2025 Instructions for Form 1040 and 1040-SR, Schedule 1-A Part III, printed pages 106 onward (`i1040gi.pdf`).

Remaining work: verify against the actual Schedule 1-A worksheet and edge cases; connect to Schedule 1-A combined limitations and line 13b; implement tips and vehicle interest, credits, final 1040 and PDF; run full project build. This is not filing software.
