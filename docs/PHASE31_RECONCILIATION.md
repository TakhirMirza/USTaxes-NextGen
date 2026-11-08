# Phase 31 — Cross-schedule Form 1040 reconciliation

2025 fictional-data-only manual audit: Schedule C line 31 → Schedule 1 line 3; Schedule SE line 12 → Schedule 2 line 4; Schedule SE line 13 → Schedule 1 line 15; Schedule 1 line 10 → Form 1040 line 8; Schedule 1 line 26 → Form 1040 line 10; Schedule 2 line 21 → Form 1040 line 23.

Arithmetic requires explicitly entered aggregate amounts for other income, adjustments and taxes. Blank is NOT zero. Values are stored only in React component state and never posted to the tax engine. Export CSV is available. Independent IRS instructions, exact source mapping, eligibility, and rounding validation remain required. The app is not suitable for real taxpayer information or filing.

Run `npm run build` and only commit/push if it succeeds. The accompanying regression test is a dependency-free Node script with a static copy of the pure module transpiled through TypeScript when available; run `node tests/phase31-reconciliation.test.mjs` after `npm install`.
