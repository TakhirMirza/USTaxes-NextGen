# Phase 54 — Multi-Year Fictional Return Dashboard

Adds a read-only 2025–2028 local return inventory to the Phase 51 Unified Fictional Return Workspace. Includes per-year status, source counts, blockers, preview line counts, revision, backup export, deletion with confirmation, CSV summary and 10 regression fixtures.

**Scope:** fictional test data only; no official filing, tax-year rules, PDFs, or tax calculations added. LocalStorage is unencrypted; never enter real personal or tax data. Selecting a year in the inventory does NOT switch the active tax-year editor; use the application's existing year selector.

## Installation

From repository root:

```bash
unzip -o ~/Downloads/USTaxes-NextGen-Phase54-Multi-Year-Dashboard.zip
bash INSTALL_PHASE54.command
```

The installer checks TypeScript and production build before committing and pushing only Phase 54 source files. If checks fail, no push is attempted.
