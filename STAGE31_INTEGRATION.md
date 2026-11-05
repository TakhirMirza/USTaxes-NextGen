# Stage 31 — Schedule 1-A pipeline and UI integration

The Form 1040 review pipeline now distinguishes missing Schedule 1-A review, explicit review with no candidates, and staged candidates requiring further verification. The educational UI includes a separate no-candidates confirmation. Schedule 1-A candidate amounts are NEVER applied to Form 1040 line 13b or to taxable income. Three regression tests cover these boundaries.

This does not implement Schedule 1-A eligibility, phaseouts, official tax-table data, credits, IRS PDF, or filing. Filing readiness remains false.
