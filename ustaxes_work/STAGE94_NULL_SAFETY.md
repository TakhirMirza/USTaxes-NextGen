# Stage 94 — Narrowing instead of non-null assertions

Replaced unsafe `!` assertions in Form 1040 pipeline, reconciliation, withholding bridge and Schedule 1-A combined review with explicit local narrowing. No tax tables or filing authorization were changed. `filingReady: false` remains in effect.

The workflow retains `CI: false` for the React build while outstanding ESLint warnings remain; Jest retains `CI: true`. Do not restore strict React CI until warning-free builds are demonstrated.
