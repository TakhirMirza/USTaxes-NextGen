# Stage 70 — Schedule 1-A candidate reconciliation UI

The 2025 diagnostic worksheet now invokes the existing `reviewCombined2025Schedule1A` engine with all four worksheet results and an evidence-staging inventory constructed from those same independently calculated candidate amounts.

The panel shows the four category candidates, their preliminary total, and explicit blockers. A missing or indeterminate category never silently becomes zero. Even when all candidates reconcile, `form1040Line13b` remains null, `filingReady` remains false, and no tax/refund is recalculated using these candidate amounts.

The UI does not itself establish eligibility, verify source documents, or make the application filing-ready. The staging inventory is a consistency aid, not independent evidence. Full React compilation and Jest tests require the project's npm dependencies, which are not installed in this working environment.
