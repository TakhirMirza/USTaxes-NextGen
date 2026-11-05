# Stage 23 — Exact 2025 Tax Table band validation

Corrected a defect in Stage 22 tests: the synthetic generator had the wrong interval widths and therefore could not produce a valid 2,062-row table. The validator now checks every band against an explicit schedule: [0,5), [5,15), [15,25), $25 bands through $3,000, and $50 bands through $100,000. This prevents a complete-looking but wrongly partitioned dataset from passing validation.

All amounts in the test generator remain synthetic and MUST NOT be used for returns. The bundled IRS import remains empty; independent verification of all official tax values and full React build are still pending.
