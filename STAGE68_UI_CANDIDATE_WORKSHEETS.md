# Stage 68 — interactive evidence-gated candidate worksheets

The 2025 diagnostic page now includes two optional, live worksheet reviews: qualified FLSA overtime premium (Schedule 1-A) and preliminary Child Tax Credit / Credit for Other Dependents (Schedule 8812). Both reuse existing Stage 53 and Stage 58 tax calculation modules rather than duplicating the phaseout logic in the UI.

The user must separately enter and confirm reviewed MAGI. The user must explicitly confirm source evidence and eligibility before the overtime module calculates a candidate. The child-credit worksheet uses a simplified count of qualifying children under 17, and is **not** an eligibility determination. The credit review still has mandatory blockers even after checkboxes are confirmed.

These worksheets never modify Form 1040 lines 13b, 19 or 28; never produce a combined refund; never store data; and never accept SSNs or names. The wage preview remains an illustration and its line 16 remains restricted. Full Schedule 8812 ordering, ACTC, Schedule 1-A combined deduction, independent review and full build/tests are outstanding. Filing readiness remains false.
