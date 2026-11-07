# Stage 67 — IRS line 16 diagnostic in the live wages-only UI

The live wages-only illustration now calls `decide2025Line16` and the imported 2025 IRS Tax Table through its existing conservative routing. Two explicit preparer confirmations are required: ordinary method applies, and all special tax worksheets are ruled out. Unchecked/unknown blocks the result.

The original bracket estimate is still shown separately, labeled illustrative, to avoid misrepresenting it as Form 1040 line 16. The new amount is explicitly a candidate and never saved, exported, or submitted.

This is **not** the full Form 1040 integration: Schedule 1-A, Schedule 8812, Schedule 2/3, withholding, and other income are not yet wired to the live form. The `filingReady` status remains false.
