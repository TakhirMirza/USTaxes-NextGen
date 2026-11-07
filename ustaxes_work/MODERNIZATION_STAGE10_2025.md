# Stage 10 — 2025 educational Form 1040 line worksheet

- Adds `form1040Worksheet2025.ts` to map fictional W-2 wages and 1099-INT interest into **line-inspired** summary fields.
- Keeps wages, interest and withholding categories separate.
- Displays a read-only line worksheet inside the existing 2025 preview panel.
- Explicitly assumes no adjustments, and does not compute official IRS Form 1040 line 16, credits, tax tables, schedules, refund or tax due.
- Does **not** change the active legacy filing year, unlock 2025, generate a filing PDF, or enable e-filing.
- Adds unit tests; full React build and existing legacy test suite are not yet verified in this environment.

Use fictional data only. This stage is not a tax preparation product.
