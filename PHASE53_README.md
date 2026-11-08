# Phase 53 — Unified Return Workflow & Form Navigation

Adds a source-driven guided review to Phase 51/52 fictional unified return. Five steps: W-2, 1099-INT, Schedule C, calculation review and unavailable official filing. Document navigation selects the existing editor and scrolls to it. Workflow states recompute with editor changes; manual reviewed checkboxes are session-only and do not clear validation errors. Includes 12 pure regression checks and CSV export.

No IRS filing eligibility or tax calculation is claimed. All input data must be fictional; browser storage is unencrypted.

Unzip into the existing project and run `bash INSTALL_PHASE53.command`. Installer checks TypeScript, Vite build, and optional architecture tests before committing only Phase 53 files.
