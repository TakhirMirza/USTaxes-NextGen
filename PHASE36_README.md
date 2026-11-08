# Phase 36 — Unified Review Workspace

The Review page now has three explicit views: Tax Return, Validation and Developer Diagnostics. The existing review components and their calculations remain intact, but their presentation is filtered by the active view. The Income and Deductions steps are unchanged. Tabs are keyboard-focusable and expose tab/tabpanel semantics.

The package is a **delta** against Phase 35 after the TypeScript fix. It replaces only the two UI files and adds this note and the installer. It does not enable PDF filing, e-file, or use of actual taxpayer data. GitHub Pages remains the deployment target.

Install from repository root, then run `bash INSTALL_PHASE36.command`. The installer checks TypeScript, Vite build, and architecture before committing/pushing. The source archive used to prepare this patch predates the latest GitHub commit; compare changes if the current files have been modified independently.
