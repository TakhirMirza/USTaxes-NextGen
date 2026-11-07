# Stage 123 — Potential repeated W-2 review

- Adds a non-destructive review warning when different W-2 entries share the same normalized employer and identical Box 1/Box 2 amounts in cents.
- Flags affected entries and provides a group-level warning; legitimate identical W-2s remain possible.
- Does not automatically deduplicate or change Form 1040 totals. Existing independent reconciliation and blocking rules remain unchanged.
- Adds five regression tests covering matching entries, different values, invalid input, different employers and three-entry groups.
- Preview only; not filing-ready. GitHub Actions validation is required after publishing.
