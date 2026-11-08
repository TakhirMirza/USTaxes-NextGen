# Phase 11 — 2025 ordinary-income scenario engine

Adds a guarded, integer-cent 2025 ordinary income bracket model and three-scenario comparison to the restored Review UI. Uses existing Form 1040 source mapping and eligibility confirmations. No new persistence or personally identifying information is collected.

## Limits

This model is not the IRS Tax Table, not a completed line 16, and not a return/refund calculator. For taxable income under $100,000, the IRS Tax Table must be applied to an actual return. Qualified dividends, capital gains, alternative methods, tax credits, additional taxes and payments are not modeled. Filing remains disabled.

## Acceptance checks

- Open Review with incomplete fictional data: blocked, with reasons.
- Confirm all prerequisite source/eligibility reviews: three scenario rows appear.
- Switch to 2026–2028: blocked.
- Compare +/- $10,000 AGI scenarios; no taxpayer names or amounts are exported.
- Run npm run test:architecture and npm run build before committing.

## IRS references to verify independently

2025 Form 1040 Instructions (tax computation, Tax Table) and Revenue Procedure 2024-40 (2025 bracket thresholds), adjusted by applicable 2025 legislation for standard deductions. This module does not assert IRS approval.
