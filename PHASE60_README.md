# Phase 60 — Review consolidation

Changes the existing `NextGenV2Foundation.tsx` only.

- Keeps Form 1040 workspace as primary Review content.
- Removes the duplicate legacy review summary.
- Collapses source-to-1040 reconciliation and schedule-aware calculation panels into a native details element.
- Preserves validation and developer diagnostics tabs, calculation functions, storage and tax-year safeguards.
- Test only with fictional data. Not approved for real filing.

Installer checks TypeScript and Vite build before committing.
