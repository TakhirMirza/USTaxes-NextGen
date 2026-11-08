# Phase 8 — Schedule-to-1040 bridge audit (2025)

Integrated read-only audit of candidate mappings for Schedules 1, 2 and 3. Tracks Form 1040 lines 8, 10, 17, 20, 23 and 31. The UI displays candidate amounts, blocking conditions and unresolved source data, with privacy-safe CSV export.

## Safety boundaries
- A candidate is **not** a verified tax return posting.
- `null` means unknown, never zero.
- The engine never enables filing or creates IRS forms.
- Non-2025 years are blocked.
- Invalid non-integer-cent values are blocked.
- Upstream reconciliation blockers are preserved.
- No taxpayer labels or financial amounts in diagnostic CSV.

## Deployment
Apply on top of Phase 7. Run `npm run test:architecture` and `npm run build` before committing. Keep the existing UI.
