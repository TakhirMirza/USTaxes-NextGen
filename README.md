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
| Income | W-2 (boxes 1–6), 1099-INT, 1099-DIV, stock sales (Schedule D), self-employment (Schedule C), unemployment, other income |
| Adjustments (Schedule 1) | Half of SE tax, SE health insurance, HSA, IRA, student loan interest (with phase-out), educator expenses |
| New 2025 deductions (Schedule 1-A) | Tips, overtime, car loan interest, $6,000 senior deduction, with phase-outs |
| Deductions | Standard (incl. 65+/blind and dependent rules) or itemized (Schedule A, $40,000 SALT cap with phase-down) |
| QBI | Form 8995 deduction below the income threshold |
| Tax | IRS Tax Table (< $100,000), Tax Computation Worksheet, Qualified Dividends & Capital Gain worksheet |
| Other taxes (Schedule 2) | Self-employment tax (Schedule SE), Additional Medicare Tax (8959), Net Investment Income Tax (8960) |
| Credits | Child Tax Credit $2,200, credit for other dependents, refundable ACTC (Schedule 8812) |
| Payments | Withholding, Additional Medicare withholding, excess Social Security, estimated payments |

**Not yet supported:** Earned Income Credit, education and child-care credits, AMT, Form 8995-A,
depreciation detail, state returns, PDF form filling, e-file. The app flags these when they may apply.

## Project layout

```
src/
  engine/          Pure calculation engine, no UI code
    rules2025.ts   All 2025 rates, brackets, limits and phase-outs, with sources
    model.ts       Return data model and defaults
    compute.ts     TaxReturnInput → every Form 1040 line and schedule
    compute.test.ts  Hand-worked regression cases
  app/             React interface
    App.tsx        Steps, live summary, autosave
    steps.tsx      About you, Income, Deductions, Credits & payments
    review.tsx     Form 1040 lines, schedules, warnings, save/open/print
    fields.tsx     Form controls
    app.css        Styles
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
