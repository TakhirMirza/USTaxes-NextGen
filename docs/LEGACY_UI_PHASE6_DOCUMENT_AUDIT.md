# NextGen 2.0 — Phase 6: Document Audit

Adds a document completeness and exception panel to Income and Review while retaining the Phase 5 UI and Form 1040 ledger.

## Behavior

- Pure inspection of selected W-2 and 1099-INT draft source fields, with integer-cent syntax validation.
- Missing employer/payer, invalid amount, and missing selected documents block the simplified source mapping review.
- Unusual W-2 withholding above wages and repeated employer labels trigger review notices, not automatic tax-law determinations.
- Other selected income types are explicitly unsupported.
- Filters, direct navigation, and privacy-restricted CSV audit (no source labels or amounts).
- No new localStorage persistence, third-party transmission, filing, PDF or e-file.

## Deployment

Overlay the four files under src/components and this document onto the existing Git repository. Run npm run test:architecture and npm run build before commit. Requires the Phase 5 source baseline.
