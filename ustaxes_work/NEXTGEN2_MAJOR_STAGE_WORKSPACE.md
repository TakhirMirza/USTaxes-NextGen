# NextGen 2.0 — Major stage: fictional tax workspace

- Session-scoped autosave for the new guided 2025 workflow; reload in the same tab restores entries.
- Explicit JSON export and validated JSON import, with schema version, enumerated tax statuses, capped W-2 entries, unique IDs, bounded labels and nonnegative cent-precision money values.
- Reset action clears the guided scenario. Import does not touch the legacy Redux tax editor.
- Only fictional scenarios are permitted. Session storage and downloaded JSON are **not** appropriate for actual taxpayer data, SSNs or secure financial records.
- Existing tax engine, restricted calculations, review blockers and legacy routes remain unchanged.
- Unit tests added for import validation boundaries.

## Next major work

Secure authenticated persistence, tax-year rule expansion and independent end-to-end IRS validation are still required before any real tax filing workflow.
