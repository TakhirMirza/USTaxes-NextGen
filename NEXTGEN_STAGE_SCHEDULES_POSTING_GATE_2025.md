# NextGen 2.0 — 2025 Schedules posting readiness

This release adds a fail-closed posting gate for Schedule 1/2/3 review candidates. It validates presence, finite nonnegative cent precision, and source audit/review state; it displays blockers in the Schedules UI. It intentionally does **not** authorize tax calculation, IRS filing, or secure storage. Existing Form 1040 calculation remains unchanged. Future work must implement IRS line-specific eligibility and worksheet ordering, then validate against official 2025 instructions and regression fixtures.
