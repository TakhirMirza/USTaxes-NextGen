# Phase 21 — Schedule A/B draft integration

Adds Schedule A/B fictional source entries to the existing scenario JSON export/import, using the established version 1 workspace fields with an optional `scheduleDraft2025` extension. Older JSON without this extension still imports and resets Schedule A/B drafts to blank. Strict structural validation rejects malformed entries, duplicate IDs, excess rows and overlong strings before import.

Drafts persist only in browser **sessionStorage** (tab-scoped, not encrypted); resetting the scenario clears them. **Do not enter real taxpayer or financial information.** JSON files are unencrypted and should only contain fictional data. The Review page displays source totals and flags 1099-INT mismatches, but **does not post amounts to Form 1040**, apply Schedule A tax limitations, compute taxes, enable PDF, or enable e-file. These remain blocked until authoritative tax-year rule verification and secure persistence are implemented.
