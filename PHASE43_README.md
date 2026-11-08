# Phase 43 — Federal Calculation Pipeline Architecture

Development-only arithmetic graph, isolated from authoritative return state.

- Exact integer-cent parsing, no floating-point monetary operations.
- Explicit missing/invalid/blocked states; no silent zero substitution.
- Source nodes for fictional wages, interest, business profit, adjustments, deductions, credits, other taxes, withholding and estimated payments.
- Derived previews for source-income subtotal, adjusted subtotal, taxable subtotal and payments subtotal. None are official Form 1040 lines.
- 11 deterministic fixtures for precision, missing propagation, dependencies and non-posting.
- CSV diagnostic export excludes entered financial amounts.
- All years 2025–2028 remain blocked until official rules, complete calculations and independent review exist.

## Install

From repository root, after pulling latest main:

    unzip -o ~/Downloads/USTaxes-NextGen-Phase43-Calculation-Pipeline.zip
    bash INSTALL_PHASE43.command

If TypeScript or Vite build fails, the installer stops before committing/pushing. It stages only Phase 43 files. Old untracked installers are ignored.
