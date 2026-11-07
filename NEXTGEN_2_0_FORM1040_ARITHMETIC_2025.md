# USTaxes NextGen 2.0 — Form 1040 arithmetic reconciliation (2025)

This major block adds a separately testable federal Form 1040 balance engine (`src/nextgen/taxYears/form1040Arithmetic2025.ts`). It validates all externally supplied tax, credit, and payment components in integer cents and computes arithmetic relationships across Form 1040 lines 18, 21, 22, 24, 32, 33, 34, and 37. It validates source mapping and rejects missing, negative, fractional-cent, overflowing, or unreviewed amounts.

## Critical boundary

This is **not** a tax-liability engine: it does not derive line 16 from the IRS Tax Table or special worksheets, and it does not establish eligibility for credits. It does not assume absent credits or taxes are zero. Only an independent verified-input pathway may invoke the reconciler with `independentlyReviewed=true`. The current public preview intentionally invokes the gate with no verified external components, so balances remain blocked. Even a reconciled result always has `filingReady: false`; no PDF or e-file.

## Tests

Five regression cases cover missing review, balanced overpayment, amount owed, invalid and overflow input, and invalid source mapping. Run `npm run test:nextgen:2025` and `npm run build` in CI.

## Next major development

Integrate verified 2025 IRS Tax Table data and Tax Computation Worksheet with official-source provenance; independently validate Schedule 1/2/3, credits and special tax methods; then extend this gate to verified inputs, audit and identity requirements.
