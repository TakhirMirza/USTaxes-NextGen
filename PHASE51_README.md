# Phase 51 — Unified Fictional Return Workspace

Adds a separate versioned, editable, fictional-only return store inside the existing Phase 50 Field Resolution Workspace. Supports multiple W-2, 1099-INT and Schedule C documents; exact integer-cent arithmetic; source lineage; missing-input blockers; a limited Form 1040 line 1a / 2b / 25a and Schedule C arithmetic preview; year-isolated browser persistence, import/export and revision conflict protection; 12 fixtures.

**Safety and scope:** This is a separate development store. It does NOT write back to the existing document-entry store, existing W-2/1099 forms, official Form 1040, federal rules engine, or e-file. It does NOT calculate taxes or refunds. Local browser storage is unencrypted; only fictional test data are permitted. Future years are not treated as officially supported tax years.

## Install

From the repo root, after unzipping: `bash INSTALL_PHASE51.command`. Installer runs TypeScript and production build before staging and pushing only Phase 51 files. Do not run with unrelated staged files.
