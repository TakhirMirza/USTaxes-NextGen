# Phase 63 — Canonical Income Editor (fictional data only)

This patch modifies the existing Unified Return workspace rather than adding a diagnostic panel. W-2 and 1099-INT are edited in the existing Income tab; their Unified Return projections become read-only. Schedule C stays editable. Independent historical W-2/1099 documents are not removed or overwritten. If independent sources exist, the interface warns that automatic synchronization is paused. Manual import is blocked until reconciliation to prevent silent duplicate income. JSON backup remains available.

**Scope limitation:** This is an editor-consolidation step, not yet a unified physical store. Legacy Income and Unified Return local-storage keys still coexist. No official tax computation, Form 1040 filing, PDF, or e-file is enabled. Fictional data only.

Installation: unzip into project root, run `bash INSTALL_PHASE63.command`. Script requires the Phase 62 workspace and stops if expected source anchors differ. It checks TypeScript and Vite build before committing and pushing.
