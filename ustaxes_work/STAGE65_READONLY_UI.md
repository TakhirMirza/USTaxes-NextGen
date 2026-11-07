# Stage 65 — 2025 restricted reconciliation inspector

A new read-only route `/nextgen/2025/review` is reachable from the legacy editor's year status bar. It displays a manually pasted Stage 64 reconciliation JSON object, showing provisional Form 1040 amounts and diagnostic blockers. It does not collect tax facts, invoke the calculation pipeline, save, post, generate a filing PDF, or submit returns. Explicit zero is distinct from missing evidence. All official Form 1040 lines must remain null, and filingReady/postingAuthorized must both be false.

The inspector is deliberately isolated from the legacy 2021 tax editor and does not imply the 2025 workflow is complete. Future work: connect actual in-memory calculation pipeline, complete schedules, run full build and Jest suite, then validated PDF generation. Do not use for filing.
