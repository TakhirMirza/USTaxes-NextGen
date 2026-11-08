# Phase 56 — Workflow-first UI consolidation

Changes the existing Phase 51–55 unified workspace, rather than appending a new panel. Document editor and preview are placed before management and diagnostics. Existing year management, return management, workflow, calculation bridge and regression checks are preserved in collapsible sections.

**Scope:** This does not modify the outer Overview page hosting Phase 40–49, because its source is not available in this patch. Do not treat this as a complete Overview redesign. No tax-law changes; fictional data only.

Install from repository root: `bash INSTALL_PHASE56.command`. Run on a clean tracked working tree. The installer validates build before committing and pushing.
