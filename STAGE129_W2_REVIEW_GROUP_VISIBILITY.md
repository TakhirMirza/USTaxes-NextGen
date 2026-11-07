# Stage 129 — Explicit potential W-2 duplicate group references

The restricted 2025 multiple W-2 preview now lists one-based document positions for each potential repeated group. Reviewers can match the warning to source entries before acknowledging them. No automatic deduplication or changes to monetary calculations, reconciliation, or filing readiness. The helper reuses the existing cent-validated detection and does not treat invalid fractional-cent entries as duplicates. Three Jest regression cases cover separate groups, invalid amounts, and distinct documents.

Validation must be confirmed by GitHub Actions after push; this archive does not claim filing readiness.
