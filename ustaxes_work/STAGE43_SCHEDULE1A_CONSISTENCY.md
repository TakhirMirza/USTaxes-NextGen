# Stage 43 — Schedule 1-A senior candidate consistency

Added `schedule1AConsistency2025.ts` and four Jest test scenarios. The 2025 review pipeline now compares a manually staged senior deduction candidate with the separately calculated candidate and reports disagreements, missing evidence worksheet, and unresolved senior eligibility. This is a consistency audit, **not** a statutory eligibility determination. Form 1040 line 13b remains null and filingReady remains false.

The official IRS 2025 tax table is still incomplete, and full application tests/build require dependency installation. Do not use this project to file tax returns.
