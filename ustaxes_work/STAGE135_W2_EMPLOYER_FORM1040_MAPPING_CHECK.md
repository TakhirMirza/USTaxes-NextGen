# Stage 135 — Employer W-2 to restricted Form 1040 cross-check

Added an explicit independent cent-based comparison of employer-inventory totals against the restricted Form 1040 lines 1a, 25a, and 25d, plus document-count consistency. The restricted display is withheld if this new check fails. Added four regression tests including stale draft and blocked draft cases. No tax filing authorization or employer identity verification.

NOT FILING READY. GitHub Actions validation and deployment must be confirmed after push.
