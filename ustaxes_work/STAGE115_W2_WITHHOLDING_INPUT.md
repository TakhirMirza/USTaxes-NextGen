# Stage 115 — W-2 Box 2 context and validation

The wages-only preview now accepts optional W-2 Box 2 federal withholding. Input is strictly parsed to cents, must be nonnegative, and cannot exceed entered wages in this simplified illustration. Invalid values block all preview calculations. Withholding is **context only**: it does not change IRS line 16, produce a refund, or authorize filing. Changes to wages/status still reset tax-method confirmations; changing withholding alone does not change line 16.

Added scenario regression tests. Full CI build and deployment must be verified on GitHub Actions.
