# Phase 61 — One-way Income → Unified Return import

Adds an explicit **Import W-2 / 1099-INT from Income** action to the existing Unified Fictional Return editor. It reads the validated current-tab Income draft, checks the selected tax year and supported income categories, and prepares a new unsaved unified draft. Existing Schedule C and manually added documents are preserved; previous imported legacy documents are replaced. The action requires user confirmation.

**No silent synchronization.** This does not post to the original Income editor, official Form 1040, tax engine, or filing. Never enter real taxpayer data.

Seven additional regression fixtures. Installer checks TypeScript and Vite build before commit/push.
