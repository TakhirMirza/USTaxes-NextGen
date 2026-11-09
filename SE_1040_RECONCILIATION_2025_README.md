# 2025 Schedule SE to Form 1040 — review workpaper

Adds an independently testable, **non-posting** cross-form reconciliation module.
The workpaper checks Schedule C line 31 → Schedule 1 line 3 → Form 1040 line 8;
Schedule SE line 13 → Schedule 1 line 15 → Form 1040 line 10; and
Schedule SE line 12 → Schedule 2 line 4 → Form 1040 line 23.
It rejects missing inputs, unreviewed zeros, inconsistent totals, unsafe numbers and invalid half-tax deductions.

**Not an IRS calculation engine, not integrated into the UI, and not filing ready.**
The prior Schedule SE core and posting safeguards remain unchanged.

One-command install, tests, build, commit and push:
`unzip -p ~/Downloads/USTaxes-NextGen-2025-SE-1040-Reconciliation.zip INSTALL_SE_1040_RECONCILIATION_2025.command | bash`

Requires a clean Git worktree and installed npm dependencies. The installer stages ONLY the files in this package; it does not stage secrets or unrelated changes. It does not push on any test failure.
