# Phase 7 — Form 1040 source ledger

- Preserves the legacy-style UI and all existing workflows.
- Adds source-to-line traceability in Income and Review, covering W-2 Box 1 -> 1040 line 1a, W-2 Box 2 -> line 25a and 1099-INT Box 1 -> line 2b candidate.
- Computes displayed source subtotals from validated integer cents and marks incomplete lines as review required.
- Shows unmapped income categories and withholding anomalies without guessing tax treatment.
- Exports a diagnostic CSV containing no source amounts, employer names or payer names.
- Does not enable tax filing, PDF, refund, e-file or production data storage.

Install as a patch on top of Phase 6 (#101). Run `npm run test:architecture && npm run build` before committing.
