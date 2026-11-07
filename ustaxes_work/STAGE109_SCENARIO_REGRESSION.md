# Stage 109 — live 2025 scenario regression

- Centralized wage/status/method-confirmation state transitions in `livePreviewScenario2025.ts`.
- Any actual wage or filing-status change invalidates both method confirmations atomically.
- Invalid wage text yields neither an illustrative calculation nor a line-16 candidate.
- Added scenario regression tests for changes, invalid inputs, reconfirmation, and status validation.
- All 2025 calculations remain illustrative/non-filing-ready. No tax return submission is enabled.
