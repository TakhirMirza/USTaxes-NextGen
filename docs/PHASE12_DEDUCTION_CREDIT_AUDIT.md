# Phase 12 — Federal deduction and credit eligibility audit (2025)

This package adds a separate, fail-closed eligibility review to the existing NextGen Review screen. It retains the restored legacy-style UI, the existing calculation modules and GitHub Pages deployment.

## Included
- 2025 filing-status base standard deductions (single $15,750; MFJ and qualifying surviving spouse $31,500; MFS $15,750; HOH $23,625).
- Independent checks for income-source validation, base deduction eligibility, deduction selection and amount, dependents, credit exclusions, and special tax computation methods.
- Integer-cent arithmetic, restricted taxable-income result, per-check Form 1040 line references and downloadable CSV.
- Fail-closed behavior: no Form 1040 liability, credits, refund or filing output is authorized.

## Not included
Age/blindness additional standard deduction, Schedule A, QBI, OBBBA supplemental deductions, tax table calculation, dependent tax credits, EITC, other nonrefundable/refundable credits, Schedule 2/3 liability, PDF filing or e-file.

## Manual smoke tests
1. Navigate to Review with no data; audit shows blockers.
2. Select 2025 single with validated $75,000 AGI and $15,750 standard deduction, with all independent confirmations; audit displays restricted taxable income $59,250.
3. Change deduction to itemized; audit blocks.
4. Change year or filing status to unsupported; audit blocks.
5. Export CSV and verify check IDs, states and line references.

This is a development-only audit for fictional test scenarios. It is not a completed tax preparation system.
