# Phase 29 - Schedule SE calculation preview (2025)

This module is deliberately restricted to fictional examples and does not authorize tax filing.

- Consumes the existing Schedule C draft via the same sessionStorage key used in Phase 27/28.
- Requires explicit scenario attestations (no wages, no other business, ordinary method).
- Computes an illustrative 92.35% net earnings, 12.4% Social Security and 2.9% Medicare components, and half-tax adjustment, with integer cents.
- Blocks invalid or incomplete Schedule C, losses, sub-$400 net earnings, and scenarios above the conservative $100,000 profit ceiling.
- Does not post to Schedule 1, Schedule 2, Form 1040, or the existing calculation engine.
- Includes CSV export and visible blocker descriptions.

Before any real tax use, compare with official IRS 2025 Schedule SE instructions and Form 1040 rules; implement the wage-base cap, multi-business aggregation, special methods, Additional Medicare Tax, and line-by-line rounding, plus comprehensive tests. GitHub Actions success means the project builds, not that tax calculations are certified.
