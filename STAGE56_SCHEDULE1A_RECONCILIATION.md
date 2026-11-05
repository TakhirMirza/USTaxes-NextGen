# Stage 56 — Schedule 1-A candidate reconciliation (2025)

Adds `schedule1ACombined2025.ts` and regression tests. Reconciles four preliminary category worksheets (qualified tips, overtime, vehicle interest and seniors) against an independently staged evidence inventory, reports missing evidence, discrepancies and eligibility blockers. Amounts are summed in integer cents.

**Safety boundary:** `preliminaryTotal` is a candidate amount, not an allowed deduction. `form1040Line13b` remains **null** and `filingReady` remains **false**, even if `reviewComplete` is true. This step does not yet integrate the figure into Form 1040. Full Schedule 1-A worksheet and eligibility audit, React build, and final tax-form review remain outstanding.
