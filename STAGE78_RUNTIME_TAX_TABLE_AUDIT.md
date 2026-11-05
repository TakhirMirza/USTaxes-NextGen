# Stage 78 — 2025 runtime IRS Tax Table integrity audit

Added a dependency-free audit of the complete shipped TypeScript tax table against the extracted IRS PDF CSV (`data/irs-2025-pdf-extracted.csv`). It verifies the CSV SHA-256 provenance comment, all 2,062 intervals, all 8,248 status-specific values, interval continuity from $0 to $100,000, and the IRS sample $25,300–$25,350. It fails closed on any discrepancy. Run `npm run audit:2025:runtime-table` or `node --test tools/stage78-tax-table-runtime-audit.test.js`.

The GitHub Actions validation workflow now runs the audit before installing npm dependencies. This is a **runtime integrity comparison**, not an independent IRS publication audit, nor validation of the full tax-return calculation. The project remains non-filing-ready.

Verified locally: 1/1 new node:test checks, 12/12 architecture checks. Full React build and Jest suite were not executed; dependency installation remains unresolved in this environment.
