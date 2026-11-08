# NextGen 2.0 — 2025 Federal Source Integrity

Adds a separate, deterministic source-document review layer for the standalone Vite application. The layer checks W-2 and 1099-INT entry completeness, integer-cent money parsing, potential W-2 withholding anomalies, unimplemented income types, deduction review and tax method confirmations. Findings link back to their workflow step and can be exported as a diagnostic CSV that excludes amounts and employer/payer names.

This is **not** a full tax computation engine, IRS filing validation, security approval or e-file capability. It must only be used with fictional data. Existing authoritative Form 1040 calculation and GitHub Actions are unchanged.

Apply only `src/components/NextGenV2Foundation.tsx`, `src/nextgen/taxYears/federalSourceIntegrity2025.ts`, and this document to the existing repository. Do not overwrite other files or delete anything.
