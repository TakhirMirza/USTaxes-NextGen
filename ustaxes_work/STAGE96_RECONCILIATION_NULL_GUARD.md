# Stage 96 — Form 1040 review checklist null guard

Fixes the Stage 95 Jest regression where the checklist accessed `result.reconciliation.lines` when reconciliation was null. The elections checklist remains blocked until reconciliation exists and both election values are present. Filing authorization remains blocked. No tax formulas were changed.
