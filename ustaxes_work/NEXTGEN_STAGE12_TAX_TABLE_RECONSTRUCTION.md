# Stage 12: 2025 IRS Tax Table research module

Source: https://www.irs.gov/publications/p1040

Adds `src/nextgen/taxYears/irsTaxTable2025.ts` and tests.

This is a **provisional mathematical reconstruction**, NOT the official IRS table imported row-by-row. It locates the published income interval and computes the ordinary-bracket tax at its midpoint, rounding to a whole dollar. Selected entries are checked against IRS Publication 1040, but comprehensive comparison is still required. The preview displays this as a research comparison only, never as the official Form 1040 line 16 amount.

**Do not use this module for tax filing.** The 2025 Tax Table applies only when the taxpayer qualifies to use it. Qualified dividends, capital gains, Form 8615, Schedule J and other special rules may require a different worksheet. The project still lacks complete deductions, credits, adjustments, official PDF mapping, and security review.

## Next engineering gate

1. Import all published 2025 table rows from an authenticated IRS artifact, retain a checksum and provenance.
2. Compare all rows and all five statuses with the reconstructed values; resolve discrepancies.
3. Add the full line 16 method decision tree and exact IRS rounding rules.
4. Keep 2025 `filingReady: false` until independent tax and security review.
