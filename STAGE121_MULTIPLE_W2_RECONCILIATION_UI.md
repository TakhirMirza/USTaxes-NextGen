# Stage 121 — Multiple W-2 input reconciliation UI

- Shows duplicate document IDs on each affected W-2 card, including the first occurrence; duplicate IDs continue to block Form 1040 mapping.
- Displays independently reviewed Box 1 and Box 2 amounts per W-2.
- Shows combined W-2 input totals only when every amount is valid and withholding was explicitly provided. Missing amounts are never treated as zero.
- Preserves existing restricted bridge validation (employer labels, duplicate IDs, cents and safe limits), Form 1040 lines 1a/25a/25d, and non-filing-ready behavior.
- No import, persistence, submission, tax due or refund calculations. Use fictional inputs only.
- Validate React build and NextGen workflow in GitHub Actions after publishing.
