# Phase 45 — Form 1040 source-to-line mapping

Adds a non-posting 2025+ diagnostic mapping layer to the Phase 44 calculation orchestrator.

- Maps 16 Form 1040 lines with source provenance, blockers, and explicit not-implemented statuses.
- Shows only four source candidate lines when their source values are known.
- Never treats missing values as zero, never posts to Form 1040, and never enables filing.
- Provides nine deterministic regression fixtures and CSV export.
- Integrates into the Phase 44 orchestrator, below the pipeline workbench.

**Important:** Form 1040 tax-year revisions, eligibility, tax tables, Schedule 1–3, and authoritative amounts require independent IRS verification. Fictional data only.

## Install

From the existing Git repository:

```bash
cd ~/Downloads/USTaxes-NextGen
git pull --ff-only origin main
unzip -o ~/Downloads/USTaxes-NextGen-Phase45-Form1040-Mapping.zip
bash INSTALL_PHASE45.command
```

The installer validates TypeScript and build before staging only Phase 45 files.
