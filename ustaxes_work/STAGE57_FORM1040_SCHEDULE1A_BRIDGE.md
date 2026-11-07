# Stage 57 — Schedule 1-A to Form 1040 restricted review bridge

Added `src/nextgen/taxYears/form1040Schedule1ABridge2025.ts` and five test cases.

The bridge accepts the existing restricted Form 1040 draft and Stage 56 four-category Schedule 1-A reconciliation. It provides an **audit-only** hypothetical taxable-income impact if all source worksheets reconcile. It intentionally does **not** modify line 13b, line 14, line 15, line 16, or refund amounts. The hypothetical figure is not a tax filing calculation and must not be shown as final.

Blockers remain mandatory, and a missing or incomplete Schedule 1-A review suppresses the hypothetical impact. Money inputs are validated as nonnegative whole cents; subtraction clamps at zero. The year and restricted status are checked.

Outstanding: independently validated IRS Schedule 1-A worksheet and eligibility logic; Form 1040 line 13b and line 14 integration; full return reconciliation; tax credits; comprehensive tests; PDF export; filing-ready certification.
