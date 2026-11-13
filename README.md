# USTaxes NextGen

Prepare a 2025 U.S. federal income tax return in your browser. Enter your forms step by step and see
your refund or amount owed update as you type. Everything stays on your device: the return is saved in
the browser's local storage and can be downloaded as a JSON file.

**Live app:** https://takhirmirza.github.io/USTaxes-NextGen/

> This is a preparation aid, not tax advice, and it does not e-file. Check every number against the
> official IRS forms and instructions before you file.

## What it covers (tax year 2025)

| Area | Supported |
| --- | --- |
| Filing status | Single, MFJ, MFS, head of household, qualifying surviving spouse |
| Income | W-2 (boxes 1–6), 1099-INT, 1099-DIV, 1099-R (IRA, pensions), SSA-1099 with the taxable-benefits worksheet, stock and digital-asset sales (Schedule D and Form 8949: every box A–L, dates, wash-sale and other adjustments), self-employment (Schedule C) with home office (simplified method, or Form 8829 with home depreciation and carryovers), depreciation of equipment and buildings (Form 4562: MACRS half-year, mid-quarter and mid-month, 2025 bonus depreciation 100%/40%, section 179 with the business income limit, vehicles and other listed property with the passenger-auto limits), sales of business and rental property (Form 4797: section 1245 recapture, unrecaptured 1250 gain at up to 25% via the Schedule D Tax Worksheet, section 1231 netting and five-year lookback), rental real estate and royalties (Schedule E) with the $25,000 passive-loss allowance, unemployment, other income |
| Adjustments (Schedule 1) | Half of SE tax, SE health insurance, HSA (Form 8889: prorated limits, catch-up, family split, taxable distributions and 20% tax), IRA, student loan interest (with phase-out), educator expenses |
| New 2025 deductions (Schedule 1-A) | Tips, overtime, car loan interest, $6,000 senior deduction, with phase-outs |
| Deductions | Standard (incl. 65+/blind and dependent rules) or itemized (Schedule A, $40,000 SALT cap with phase-down) |
| QBI | Form 8995 below the threshold; Form 8995-A above it (W-2 wage and UBIA limit, phase-in, specified service businesses), REIT dividends, loss netting and carryforwards |
| Tax | IRS Tax Table (< $100,000), Tax Computation Worksheet, Qualified Dividends & Capital Gain worksheet |
| Alternative minimum tax | Form 6251 with ISO, private activity bond and other adjustments, exemption phase-out, 26%/28% rates and Part III for capital gains |
| Other taxes (Schedule 2) | Self-employment tax (Schedule SE), Additional Medicare Tax (8959), Net Investment Income Tax (8960), 10% tax on early retirement distributions with Form 5329 exceptions, 6% tax on excess HSA contributions (Form 5329 Part VII) |
| Credits | Saver's Credit (Form 8880), Earned Income Credit (Schedule EIC), Child Tax Credit $2,200 / credit for other dependents / refundable ACTC (Schedule 8812), child and dependent care (Form 2441), American Opportunity and Lifetime Learning (Form 8863) |
| Payments | Withholding, Additional Medicare withholding, excess Social Security, quarterly estimated payments |
| Penalty | Estimated tax penalty (Form 2210 Part I and the 2025 Penalty Worksheet, 7%), with the 2024 safe harbor |

**IRS forms (PDF):** the Review step fills the official 2025 IRS PDFs in the browser and downloads one
print-ready file: Form 1040, Schedules 1, 1-A, 2, 3, A, B, C, D, E, SE, EIC, 8812, Forms 2441, 4562, 4797, 5329, 6251, 8829, 8863, 8880, 8889, 8949, 8995-A, 8959, 8960, 8995, and the
1040-V payment voucher when tax is owed. The blank forms live in `public/forms/2025` (official IRS PDFs).

## For preparers and families

- **Many returns.** The *All returns* page lists every return in this browser with its refund or balance, status
  (In progress, Needs review, Ready to file, Filed), notes, and items still to check. Create, duplicate or delete returns.
- **Paid preparer.** Save your name, PTIN, firm, EIN and address once in *Settings*; turn it on per return to print the
  *Paid Preparer Use Only* box. Third party designee and Identity Protection PINs print on Form 1040 too.
- **Client letter.** A printable letter with the result, signing and mailing steps, payment instructions, and a suggested
  2026 estimated-tax amount when withholding fell short.
- **Backups.** One file holds every return and the preparer profile, optionally encrypted with a password
  (PBKDF2-SHA256, 600,000 iterations → AES-256-GCM). Restoring adds returns and never overwrites.
- **Privacy.** Nothing leaves the device. A first-run notice explains local storage and shared-computer risks.

**Try it:** the “Try an example” link fills in a made-up household so you can see every step.

**Not yet supported:** like-kind exchanges (Form 8824), casualty losses (Form 4684), installment sales (Form 6252), AMT on unrecaptured 1250 gain, Form 8582 detail, 8995-A Schedules A–D as separate pages,
K-1 income, state returns, e-file. The app flags these when they may apply.

## Project layout

```
src/
  engine/          Pure calculation engine, no UI code
    rules2025.ts   All 2025 rates, brackets, limits and phase-outs, with sources
    model.ts       Return data model and defaults
    compute.ts     TaxReturnInput → every Form 1040 line and schedule
    compute.test.ts  Hand-worked regression cases
  app/             React interface
    App.tsx        Routing, autosave, the step shell
    store.ts       Many returns + preparer profile in local storage (tested)
    backup.ts      Backup files and password encryption (tested)
    pages.tsx      All returns, Settings, privacy notice, client letter
    steps.tsx      About you, Income, Deductions, Credits & payments
    review.tsx     Form 1040 lines, schedules, warnings, save/open/print
    fields.tsx     Form controls
    app.css        Styles
  pdf/
    irs2025.ts     Which IRS form fields get which values
    fill.ts        Fills and merges the PDFs with pdf-lib
    irs2025.test.ts  Fills the real IRS PDFs and checks every field mapping
public/forms/2025  Blank official IRS fillable PDFs
```

To add a tax year, copy `rules2025.ts`, update the figures, and point the engine at it.

## Development

Requires Node.js 22.6 or newer.

```bash
npm install
npm run dev        # local server
npm test           # engine tests
npm run typecheck
npm run build      # production build in dist/
```

Pushing to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/pages.yml`).

## License

AGPL-3.0. Based on [UsTaxes](https://github.com/ustaxes/UsTaxes) by Aidan Grimshaw and contributors.
