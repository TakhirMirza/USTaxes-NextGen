# Stage 66 — live wages-only diagnostic preview

The 2025 review route now includes a live React form for annual W-2 wages and filing status. It calls the existing `preview2025OrdinaryWages` calculation directly on input changes, without manual JSON. The prior Stage 65 restricted reconciliation JSON inspector is preserved as an advanced tool.

**Scope and safety:** This is an *illustrative marginal-bracket calculation*, not the official IRS Tax Table result, Form 1040 line 16, or a complete tax liability. It assumes wages only and the base standard deduction; it does not accept or silently fabricate Schedule 1-A, 2, 3, 8812, withholding, or other information. No data is persisted, exported, submitted, or posted to official lines. Filing readiness remains false.

Next: connect real source documents and validated calculation chain to the UI, then execute full application build and integration tests before considering any tax-return PDF.
