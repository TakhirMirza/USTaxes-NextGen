# Phase 42 — Official IRS Source Audit & Tax-Year QA

## Scope
- Adds a source-evidence schema for each annual rule category (2025–2028).
- Adds fail-closed validation of official HTTPS IRS domains, revision metadata, independent reviewer, review date, implementation ID and regression ID.
- Adds 4-year audit CSV and QA checks CSV exports.
- Adds a year-switching source review workbench inside the existing Phase 41 federal rule center.
- Keeps calculation, PDF, filing and e-file disabled. No real taxpayer information is used.

## Important
`SOURCE_EVIDENCE` intentionally starts empty. Do not manufacture tax-law citations, claim that passing architecture checks verifies IRS rules, or treat an IRS URL as approval. The source inventory must be populated from independently verified tax-year-specific documentation. The module does not retrieve external documents automatically.

## Installation
From the repository root:
```
git pull --ff-only origin main
unzip -o ~/Downloads/USTaxes-NextGen-Phase42-Official-Source-QA.zip
bash INSTALL_PHASE42.command
```
The installer builds and pushes only Phase 42 files. It does not clean or discard unrelated working tree changes. It refuses to commit if other files are already staged.
