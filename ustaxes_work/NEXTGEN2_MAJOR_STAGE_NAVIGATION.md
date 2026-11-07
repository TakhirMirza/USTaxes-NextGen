# NextGen 2.0 — Major stage: unified navigation and legacy isolation

- The new 2025 guided preview now uses dedicated HashRouter URLs for Overview, Profile, Income, Deductions and Review.
- Refresh, back/forward and sharing a step URL keep the user on that step (fictional in-memory inputs are **not** persisted across refresh).
- `#/start` remains the canonical landing page; `#/v2/profile`, `#/v2/income`, `#/v2/deductions`, `#/v2/review` are direct links.
- Old `#/nextgen-2` links redirect to the new landing page instead of showing the legacy editor.
- `#/legacy` opens the existing Getting Started legacy editor in its original layout; old `#/info` links redirect there.
- 2025 diagnostic workspace remains at `#/nextgen/2025/review`.
- Unit tests cover deep links, browser-history route restoration, and invalid step handling.

**Scope**: Development-only fictional scenarios. This stage does not enable storage, PDF filing, e-file or production tax calculation.
