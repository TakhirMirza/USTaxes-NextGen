# USTaxes NextGen 2.0 — Tax Engine 2025 integration

This milestone adds a deterministic, integer-cent source-to-Form-1040 mapping core for fictional W-2 Box 1/Box 2 and 1099-INT Box 1 sources. It connects the new five-step UI to the restricted 2025 line worksheet and adds seven unit tests. It deliberately does **not** calculate Form 1040 line 16 tax, total tax, refund, amount due, PDF, or e-file.

Supported restricted lines: 1a, 2b, 9, 11a, 12e, 15, 25a, 25d. Mapping is blocked unless all explicit simplified scenario assertions are confirmed. A mapped status does not imply tax-return readiness.

## Next production milestones
- Formal tax-year rule registry with official IRS references and versioned effective dates.
- Form 1040 and schedule coverage matrix with separate verified test fixtures for each supported filing situation.
- IRS Tax Table and special-method line 16 decisions, reconciliation of all lines and rounding policy.
- Verified official-form PDF generation, secure backend, authentication and encrypted storage.
- IRS MeF integration and ATS testing only after provider prerequisites are met.

Sources: https://www.irs.gov/instructions/i1040gi ; https://www.irs.gov/forms-pubs/about-form-1040

Never enter real taxpayer information into this GitHub Pages preview.
