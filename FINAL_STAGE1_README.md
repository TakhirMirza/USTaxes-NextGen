# Final stage 1 — 2025 IRS ordinary income worksheet integration

This package integrates a *restricted* official IRS 2025 Tax Computation Worksheet into the existing Form 1040 review UI. It supports line 16 only when **taxable income >= $100,000**, ordinary income only, and line 15 reconciliation is independently confirmed. Below $100,000 the IRS Tax Table is mandatory and **not included**. Other tax methods, credits, self-employment tax, filing, official PDF, and real taxpayer use remain blocked.

Source: https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf and https://www.irs.gov/publications/p1040

Important: this is substantial progress on final stage 1, **not completion of all tax calculations**. Do not enter real taxpayer data. The integration copies calculated line 16 only on click and resets independent review confirmation.

Install: unzip package in repository root, then bash INSTALL_FINAL_STAGE1.command. Installer stops if build fails, and does not commit unless checks succeed.
