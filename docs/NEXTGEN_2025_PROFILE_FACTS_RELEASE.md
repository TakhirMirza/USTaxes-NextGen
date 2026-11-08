# NextGen 2.0 — 2025 profile facts integration

Adds explicit taxpayer/spouse age-65, blindness, and claimable-as-dependent facts to the 2025 draft and Review calculation. Unknown values are **never** converted into an eligibility assertion. Old scenario imports remain valid but facts default to unknown. Changing a fact revokes simplified-deduction and ordinary-tax-method confirmations. The simplified deduction checkbox is disabled until all relevant facts are explicitly negative. Spouse facts are required for joint/separate status. The engine remains blocked for unsupported advanced deductions, dependents, and filing infrastructure. This is a development preview, not tax advice or filing authorization.

Validation: `node scripts/check-profile-facts-2025.mjs`, `npm run test:architecture`, `npm run build`.
