# Stage 118 — Multiple W-2 restricted Form 1040 bridge

- Added `bridgeMultipleW2ToRestricted1040_2025` for 1–100 independently identified W-2 documents.
- Each Box 1 / Box 2 value must pass the existing preview validation; missing Box 2 blocks rather than silently becoming zero.
- Rejects duplicate trimmed document IDs. Matching employer names alone are not duplicates; amended/corrected documents require human reconciliation.
- Uses whole-cent accumulation, bounds checking, and the existing restricted draft to display 1040 lines 1a, 25a, and 25d.
- Added Jest regression tests for two W-2s, same-employer documents, duplicates, invalid values, missing withholding, capacity and line 16 independence.
- This is a separate read-only bridge API; the existing single-document live-preview UI remains unchanged. No new multi-W-2 UI or automatic import has been implemented.
- **Non-filing-ready**: no e-file, posting, refund determination or authorization.
