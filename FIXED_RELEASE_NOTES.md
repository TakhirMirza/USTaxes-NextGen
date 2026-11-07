# Schedules 2025 — corrected package

- Fixed missing `draftWorkspace.ts` import and named exports.
- Updated corresponding Jest test imports.
- Preserved existing sessionStorage key to avoid losing drafts already stored in browser.
- Preserved tax engine and Schedule 1/2/3 UI from prior archive.
- Installer backs up existing project, installs, builds, and only pushes when called with `--push`.
- **Not production-safe for taxpayer PII:** browser sessionStorage and JSON export remain; secure backend and IRS validation are incomplete.
- Build not independently verified in this environment.
