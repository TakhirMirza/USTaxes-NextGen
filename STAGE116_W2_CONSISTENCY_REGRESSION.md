# Stage 116 — W-2 preview input consistency and regression tests

- Centralized the wages/withholding input consistency gate in `reviewW2PreviewInputs2025` and reused it in both the calculation and UI.
- Added boundary tests for zero, exact equality, fractional cents, malformed inputs, and withholding greater than wages.
- Added a regression check that withholding changes alone cannot change a provisional Form 1040 line 16 result or reset tax-method confirmations.
- The withholding <= wages constraint is a **simplified preview-only plausibility restriction**, not a general IRS rule: real W-2 Box 2 can require independent reconciliation and must not be rejected globally on this basis.
- No refund calculation, Form 1040 posting, or filing authorization added. `filingReady` and `postingAuthorized` remain false.
- CI validation and GitHub Pages publishing must be verified after pushing.
