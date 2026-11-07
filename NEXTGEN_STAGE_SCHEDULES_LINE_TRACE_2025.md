# NextGen 2.0 — Schedules 1/2/3 to Form 1040 line trace (2025)

This stage adds a deterministic, cent-accurate, read-only trace of all six proposed Form 1040 handoff lines: 8, 10, 17, 20, 23 and 31. Each trace includes its originating Schedule section, audited source total, candidate total, and explicit status (matched, mismatch, missing, invalid).

It deliberately does **not** authorize posting, calculate eligibility, or replace IRS worksheets. The existing production calculation and GitHub Pages deployment are unchanged. Next implementation work is verified IRS line-specific eligibility and worksheet dependencies before enabling any posting.
