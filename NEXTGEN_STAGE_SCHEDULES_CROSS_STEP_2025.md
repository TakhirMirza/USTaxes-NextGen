# NextGen 2.0 — 2025 Schedules cross-step reconciliation

This stage connects the existing Schedules 1/2/3 input interface to the existing Review step with an in-memory, read-only typed candidate bridge. Values are never posted into authoritative Form 1040 calculations. The existing tax engine, GitHub Pages workflow, and repository structure are unchanged.

- Schedule 1 income -> candidate line 8; adjustments -> candidate line 10.
- Schedule 2 Part I -> candidate line 17; Part II -> candidate line 23.
- Schedule 3 Part I -> candidate line 20; Part II -> candidate line 31.
- Candidate values are kept in React state, not exported to insecure browser storage.
- Any missing validation is explicitly blocked; even reviewed candidates are not filing-ready.

## Release checks
Run GitHub Actions `Deploy USTaxes NextGen 2.0 Preview` and `NextGen 2025 validation (non-filing)`. The workflow result is authoritative for compilation; local full npm build was not available in the packaging environment.

## Security
Do not input SSNs or real taxpayer financial data until protected storage, identity controls, and server-side processing are implemented and audited.
