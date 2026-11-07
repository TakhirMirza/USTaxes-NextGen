# USTaxes NextGen 2.0 — IRS 2025 Tax Computation Worksheet

Major feature: official 2025 Form 1040 line 16 Tax Computation Worksheet for **whole-dollar taxable income >= $100,000**, all five filing statuses, with published bracket multipliers and subtraction amounts. See https://www.irs.gov/publications/p1040 (2025 Tax Computation Worksheet).

- Pure tax function and five test groups cover all worksheet sections and blocked cases.
- Integrated in NextGen 2.0 Review as a read-only computation with explicit special-method review acknowledgment.
- Does **not** use this worksheet below $100,000 (IRS Tax Table required).
- Does **not** calculate special-rate income (qualified dividends, capital gains, Form 8615, Schedule J, Form 2555, etc.).
- Does not authorize filing, compute total tax/refund or collect real taxpayer data.
- Do not interpret this as a production-ready tax engine; formal IRS scenario verification and compliance/security work remain required.
