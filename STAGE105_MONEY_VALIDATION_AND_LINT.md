# Stage 105 — money validation regression and ESLint test cleanup

- Add negative, NaN and infinite money regression scenarios to integrated Form 1040 review tests. The existing restricted review must reject these values with RangeError.
- Replace unused destructured line 30 variable in reconciliation tests with an explicit Partial fixture and deletion. This preserves the missing-input scenario without an unused-variable lint diagnostic.
- Keep the Stage 103 ESLint non-regression gate and all existing non-filing restrictions unchanged.
- Local Stage 103 budget tests and Stage 98 report tests passed. Full React/Jest checks are deferred to GitHub Actions.
- Filing remains unauthorized (`filingReady: false`, `postingAuthorized: false`).
