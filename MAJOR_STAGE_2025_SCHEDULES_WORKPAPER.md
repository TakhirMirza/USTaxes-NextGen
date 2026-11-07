# USTaxes NextGen 2.0 — 2025 Schedules Workpaper

Adds a practical, versioned Schedule 1/2/3 workpaper to the existing NextGen interface:
- Group source records by IRS schedule line with integer-cent arithmetic.
- Export/import a bounded, schema-validated JSON document without a backend.
- Reject duplicate record IDs, unsupported lines, invalid money, wrong year, malformed schema.
- Reset cross-form confirmation flags after import.
- Keep filing/posting blocked until IRS eligibility and form computations are implemented and independently verified.

Security: exported workpapers may contain private financial information. GitHub Pages is static hosting and is not a secure taxpayer database. Do not upload personal taxpayer records to the public repository.
