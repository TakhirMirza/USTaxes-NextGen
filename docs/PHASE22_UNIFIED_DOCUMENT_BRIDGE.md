# Phase 22 — unified document bridge (2025 fictional scenarios)

Adds a single read-only reconciliation surface to Review, retaining the existing UI and routing. W-2 totals, 1099-INT source and Schedule B comparison are kept distinct. Raw Schedule A entries are explicitly not an allowable deduction. No new values are posted to the tax engine. No tax computation, PDF filing, or e-file enabled.

## Acceptance scenarios
1. Blank draft: no crash, filing disabled.
2. Two valid W-2s: cents summed correctly.
3. Invalid W-2 amount: blocking finding.
4. Withholding > wages: review finding.
5. Schedule B interest equals 1099-INT: no mismatch finding.
6. Schedule B interest differs: blocking finding; no duplicate posting.
7. Schedule B entered without selected 1099-INT: blocked.
8. Schedule A entered: blocked until statutory limits reviewed.
9. Schedule A with standard deduction selected: conflict warning.
10. Dividend amount: blocked pending verified 1099-DIV.
11. Non-2025 year: blocked.
12. Export findings CSV: contains codes and messages, no payer/employer names or amounts.

Build: `npm run build`. Do not use real taxpayer information; session storage is not secure persistent storage.
