# Stage 62 — restricted Form 1040 balance reconciliation (2025)

New `src/nextgen/taxYears/form1040BalanceReview2025.ts` composes the restricted Stage 61 integrated review with explicit, independently reviewed values for other nonrefundable credits, other taxes, and other payments. It computes **diagnostic candidates only** for Form 1040 lines 16, 19, 20, 22, 23, 24, 25d, 28, 33, 34, and 37. All official lines remain null; `filingReady` and `postingAuthorized` are always false.

Safeguards: missing evidence is null rather than zero; amounts must be finite, nonnegative, and cent-precise; excessive nonrefundable credits fail closed rather than silently being capped; overpayment and amount owed are mutually exclusive. Tax and payment completeness must be affirmatively confirmed. The existing Stage 61 and Schedule 8812 limitations remain in force. This is not a completed Form 1040 or a filing calculation.

Verification in this stage: standalone TypeScript compilation succeeded; six executable Node assertions passed. Five Jest test cases were authored but Jest was not run. The full React build was not run.

Run the standalone checks after compiling the module to JavaScript:
`node tools/test-stage62-balance.js /path/to/compiled/form1040BalanceReview2025.js`

Future work: implement and verify complete tax and credit ordering (including Schedule 2 and Schedule 3), IRS worksheet cases, withholding and estimated-payment evidence, real integration and UI, comprehensive tests, and official PDF mapping before removing any filing blocks.
