# USTaxes NextGen 2.0 — 2025 Schedule dependencies

Adds `schedules2025DependencyMatrix.ts` and focused regression tests. The matrix consumes the existing cent-accurate source audit and six-line trace and identifies the *specific IRS rule/worksheet categories* that still require implementation before Schedule 1, 2 and 3 amounts can affect Form 1040. Matching totals are explicitly marked `requires-irs-review`, not posted.

No existing tax-engine output, filing authorization, or GitHub Pages workflow is changed. This is an incremental, fail-closed engineering stage, **not** completed tax-rule integration.
