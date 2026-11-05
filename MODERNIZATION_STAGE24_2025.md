# Stage 24 — Restricted Schedule 1 draft integration

- Added `schedule1Worksheet2025.ts` with typed 2025 Schedule 1 income and adjustment entry lines.
- Aggregates explicit amounts to Form 1040 draft lines 8 (other income), 9 (total income), 10 (adjustments), 11a (AGI), 15 (taxable income).
- Rejects negative, nonfinite, sub-cent, and unsupported amounts.
- No eligibility or classification inference. The caller must independently verify underlying tax treatment. No Schedule 1-A support yet.
- Maintains `filingReady: false` and conservative line 16 blocking.
- Test scenarios added in `schedule1Worksheet2025.test.ts`; full React/Jest run not confirmed in this environment.
- Source for form structure: https://www.irs.gov/pub/irs-pdf/f1040s1.pdf and https://www.irs.gov/pub/irs-pdf/f1040.pdf .
