# Phase 49 — Form field review and source correction planning

This package adds an issue-to-field review workspace to the existing Phase 48 validation center.

- Maps W-2 and 1099-INT issues to income document review targets.
- Keeps tax-year, mapping, cross-form, and filing blockers read-only.
- Supports **fictional, in-memory** draft amounts and notes for source review only.
- Exports CSV explicitly labeled DRAFT_ONLY_NOT_POSTED.
- Seven deterministic fixture checks.

IMPORTANT: No actual form editing or persisted tax data. Drafts do not change the tax engine, source documents, issue status, PDF, or e-file. Data clears on reload. Never enter personal tax information.

Install from project root after unzipping: `bash INSTALL_PHASE49.command`. Run `git pull --ff-only origin main` before unzipping.
