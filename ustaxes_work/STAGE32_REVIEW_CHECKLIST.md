# Stage 32 — 2025 review checklist

Adds `get2025ReviewChecklist()` for transparent, per-topic review status of the restricted Form 1040 pipeline. It deliberately never declares the return filing-ready. A reviewed item means only that the corresponding input category has been explicitly addressed, not that tax-law eligibility has been established.

Tests were authored for missing facts, explicit empty Schedule 1-A, and positive unverified candidates. Full React/Jest execution remains pending.
