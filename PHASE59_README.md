# Phase 59 — Income workspace consolidation

Updates the existing `NextGenV2Foundation.tsx` and stylesheet, based on the user's supplied project source with Phase 57/58 patches applied.

- The W-2/1099-INT document entry workbench and Schedule C editor are displayed first on Income.
- Source ledger, Schedule C bridge, Schedule SE, and self-employment pipeline are behind an expandable **Advanced income calculations and source audits** section.
- Legacy income quality cards, interview help, and duplicate document register are behind an expandable **Document audit and legacy document register** section.
- The existing income category selection, Schedule B editor, and navigation remain accessible.
- Income Bridge and Schedule Bridge Audit appear under Review → Developer Diagnostics instead of on the default Income page.
- No tax logic, stored data, or filing restrictions changed.

**Important:** The advanced components remain mounted inside `<details>` and retain their existing behavior; collapsing the section is not a data migration. This patch does not remove or merge the underlying legacy state models.

Installation: `unzip -o ~/Downloads/USTaxes-NextGen-Phase59-Income-Consolidation.zip && bash INSTALL_PHASE59.command` from the repository root. The installer runs TypeScript and build checks before committing/pushing.
