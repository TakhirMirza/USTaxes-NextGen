# USTaxes NextGen

Prepare a 2025 U.S. federal income tax return in your browser. Enter your forms step by step and see
your refund or amount owed update as you type. Everything stays on your device: the return is saved in
the browser's local storage and can be downloaded as a JSON file.

**Live app:** https://takhirmirza.github.io/USTaxes-NextGen/

## Privacy by design

Tax returns hold Social Security numbers, income and bank details. USTaxes NextGen never sends them anywhere:

- **No server, no account, no database.** The app is static files; returns live only in this browser's storage.
- **No third parties.** No analytics, ads, cookies, external scripts or font services. The published build sets a
  Content Security Policy that forbids the page from contacting any other site, and `no-referrer`.
- **Optional password protection.** Returns stored in the browser can be encrypted (AES-256-GCM, key from
  PBKDF2-SHA256 with 600,000 iterations, kept only in memory). The app locks after inactivity and on demand.
- **Encrypted backups** with the same scheme.
- **Works offline.** A service worker keeps the app and the blank IRS forms on the device.
- **Delete everything** from the browser in one step (Settings).

See the in-app page *Privacy* for live checks, and [SECURITY.md](SECURITY.md) for the threat model.

> This is a preparation aid, not tax advice, and it does not e-file. Check every number against the
> official IRS forms and instructions before you file.

## What it covers (tax year 2025)

| Area | Supported |
| --- | --- |
| Filing status | Single, MFJ, MFS, head of household, qualifying surviving spouse |
| Income | W-2 (boxes 1–6), 1099-INT, 1099-DIV, 1099-R (IRA, pensions), SSA-1099 with the taxable-benefits worksheet, stock and digital-asset sales (Schedule D and Form 8949: every box A–L, dates, wash-sale and other adjustments), self-employment (Schedule C) with home office (simplified method, or Form 8829 with home depreciation and carryovers), depreciation of equipment and buildings (Form 4562: MACRS half-year, mid-quarter and mid-month, 2025 bonus depreciation 100%/40%, section 179 with the business income limit, vehicles and other listed property with the passenger-auto limits), partnership and S corporation K-1s (Schedule E Part II; portfolio income, capital gains, section 1231, self-employment earnings and QBI flow to their forms), sales of business and rental property (Form 4797: section 1245 recapture, unrecaptured 1250 gain at up to 25% via the Schedule D Tax Worksheet, section 1231 netting and five-year lookback), rental real estate and royalties (Schedule E) with the passive activity loss limits (Form 8582: $25,000 special allowance, passive income netting across rentals and K-1s, per-activity carryovers), unemployment, other income |
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
| State | Pick the state you lived in all of 2025 from all 50 states and DC: Virginia, Maryland, DC, California, New York, Pennsylvania, Illinois, North Carolina, Michigan, Georgia, Ohio, New Jersey, Massachusetts, Arizona, Colorado, Minnesota, Wisconsin, Indiana, South Carolina, Louisiana, Alabama, Oregon, Kentucky, Oklahoma, Connecticut, Utah, Iowa, Kansas, Arkansas, Nebraska, Mississippi and West Virginia are prepared in full; the nine states without an income tax say so (with a Washington capital gains check); the other 10 states get a tax estimate (2025 brackets, standard deductions and exemptions from the Tax Foundation table updated for 2025 changes; Social Security exclusion; state-specific phase-outs for IL, MD, OH, RI, UT, VT, WI; optional local rate, adjustments and credits) until their forms are added |
| DC (Form D-40) | Full-year residents: DC standard deduction ($15,000 / $22,500 / $30,000, not the 2025 federal amounts) with the additional amount for 65 or older or blind, Calculation F itemized deductions (state taxes out, full real estate tax back, 5% limit over $200,000), tax tables and Calculation I, Schedule I additions and subtractions (other states’ bond interest, U.S. obligations, DC College Savings, bonus depreciation add-back), unemployment and Social Security subtractions, child care credit (32% of federal), DC EITC (100% of federal, or the DC worksheet without a child), Schedule H property tax credit for renters and owners; fills Form D-40 with Schedule S (dependents, standard deduction), Schedule I and Schedule H |
| California (Form 540) | Full-year residents: Schedule CA adjustments (unemployment, Social Security, state refund, U.S. obligation interest, other states’ bonds, HSA and educator add-backs), California itemized deductions without the SALT cap and with the high-income limit, the $5,706 / $11,412 standard deduction, tax table and rate schedules (checked against every row of the 2025 table), exemption credits with the AGI limitation, renter’s credit, child and dependent care credit (FTB 3506), CalEITC from the official table and the Young Child Tax Credit (FTB 3514), Behavioral Health Services Tax; fills Form 540, Schedule CA (540), FTB 3514 and FTB 3506 |
| New York (Form IT-201) | Full-year residents, with New York City and Yonkers: New York additions and subtractions (state refund, Social Security, U.S. bond interest, government pensions, the $20,000 pension exclusion, 529 contributions), standard deduction and dependent exemptions, NYS and NYC tax tables and rate schedules, the tax computation worksheets for New York AGI over $107,650, NYS and NYC household credits, Empire State child credit (IT-213), NYS and NYC earned income credits (IT-215), NYS and NYC child and dependent care credits (IT-216), NYC income tax elimination credit (IT-270), New York itemized deductions with their high-income limits (IT-196), NYC school tax credits, Yonkers resident surcharge, sales and use tax chart; fills IT-201, IT-196, IT-213, IT-215, IT-216 and IT-270. The real property tax (IT-214) and college tuition (IT-272) credits are entered from their own forms |
| Pennsylvania (Form PA-40) | Full-year residents: the eight classes of PA income (401(k) deferrals taxed as compensation; Social Security, unemployment and retirement benefits not taxed; a loss in one class never reduces another), Schedule O (529, HSA and student loan interest), flat 3.07%, Tax Forgiveness from the Schedule SP eligibility income tables, and the Working Pennsylvanians Tax Credit shown as the Department will figure it; fills PA-40, Schedule SP and Schedule O |
| Illinois (Form IL-1040) | Full-year residents: Social Security and retirement income subtracted, Schedule M (U.S. obligation interest, Bright Start contributions), $2,850 exemptions with the 65+/blind amounts and income limits, flat 4.95%, Illinois EITC (20% of federal, with the expanded worksheet for ages 18–24 and 65+), Child Tax Credit (40% of the EITC for a child under 12), UT Table use tax; fills IL-1040, Schedule M and Schedule IL-E/EITC |
| North Carolina (Form D-400) | Full-year residents: Schedule S (U.S. obligation interest, Social Security, Bailey and military retirement, other-state bond interest), child deduction by income, NC standard or itemized deduction ($20,000 mortgage and property-tax cap), flat 4.25%, use tax; fills D-400 and Schedule S |
| Michigan (Form MI-1040) | Full-year residents: Schedule 1, $5,800 exemptions plus special and disabled-veteran amounts, retirement subtraction by year of birth (Form 4884, Sections A and D), flat 4.25%, Michigan EITC (30% of federal), homestead property tax credit for owners and renters (MI-1040CR with Tables A, B and 2 and the senior-renter alternate credit); fills MI-1040, Schedule 1, Form 4884 and MI-1040CR |
| Georgia (Form 500) | Full-year residents: flat 5.19%, $12,000/$24,000 standard deduction or federal itemized deductions, $4,000 per dependent (including unborn dependents), Schedule 1 with the retirement income exclusion ($35,000 at 62–64 or disabled, $65,000 at 65+) and the military retirement exclusion, Social Security subtracted, Low Income Credit, $300 Eligible Itemizer Tax Credit, IND-CR 202 child care credit (50% of federal), W-2 income statements; fills Form 500, Schedule 1 and IND-CR |
| Ohio (Form IT 1040) | Full-year residents: 2025 brackets (0% / 2.75% / 3.125%), exemptions by modified AGI, Schedule of Adjustments (Social Security, U.S. interest, 529, uniformed services retirement, medical), Schedule of Business Income ($250,000 deduction, 3% above), Schedule of Credits (retirement income, senior citizen, child care, exemption, joint filing and Ohio earned income credits); fills IT 1040 and the schedules of adjustments, business income, credits, dependents and Ohio withholding |
| New Jersey (Form NJ-1040) | Full-year residents: income by category (losses do not cross categories; Social Security and unemployment exempt), exemptions including the $6,000 veteran exemption, pension exclusion and Worksheet D, medical expenses over 2%, Property Tax Deduction or $50 credit (Worksheet H, 18% of rent for tenants), 2025 tax table, NJEITC (40%), child and dependent care credit (Worksheet J), NJ Child Tax Credit; fills the NJ-1040 digit boxes |
| Massachusetts (Form 1) | Full-year residents: 5.0% income with exempt government pensions and Social Security, FICA and rental deductions, Schedule Y (commuter, 529, charitable, HSA, student loan), exemptions, Schedule B interest and dividends, short-term gains at 8.5% and long-term gains at 5%, excess exemptions, tax table, No Tax Status, Limited Income Credit, 4% surtax, EITC (40%) and the $440 Child and Family Tax Credit, Schedule HC health coverage (150% poverty level test, 4-month gap rule); Massachusetts loss carryovers; fills Form 1 and Schedules HC, DI, B, D, X and Y |
| Arizona (Form 140) | Full-year residents: flat 2.5%; $15,750 / $31,500 / $23,625 standard deduction plus 34% of charitable gifts; exemptions for age 65, blindness, other people and qualifying parents; subtractions for U.S. interest, government pensions (up to $2,500), military pay and retirement, Social Security, 25% of long-term gains on post-2011 assets, 529 and ABLE contributions; Dependent Tax Credit with its AGI reduction, Family Income Tax Credit and Increased Excise Tax Credit; voluntary gifts; fills Form 140 pages 1–6 |
| Colorado (DR 0104) | Full-year residents: federal taxable income with the state income tax, QBI and high-income deduction addbacks; DR 0104AD (Social Security, the $20,000/$24,000 pension subtraction, military retirement, CollegeInvest/ABLE, charitable gifts for non-itemizers, FAMLI); 4.4% tax table; DR 0104CR refundable credits (child tax credit and family affordability credit, 50% child care credit, 50% EITC); TABOR sales tax refund; fills DR 0104, DR 0104AD, DR 0104CR, DR 0104CN and DR 0347 |
| Minnesota (Form M1) | Full-year residents: standard deduction table with the high-income limitation (or Minnesota itemized deductions), $5,200 dependent exemptions with the phaseout, Schedule M1M (other states’ bond interest, Social Security subtraction worksheet, charitable gifts for non-itemizers, U.S. interest, K–12 expenses, 529, military pay and pensions), tax table and rate schedules (5.35%–9.85%), Schedule M1CWFC (Child Tax Credit $1,750 per child and Working Family Credit) on M1REF; fills M1, M1M, M1REF, M1CWFC, M1DQC and M1W |
| Wisconsin (Form 1) | Full-year residents: the Standard Deduction Table (parsed from the booklet), $700/$250 exemptions, tax table and worksheet (3.5%–7.65%), Schedule SB items (Social Security, 30% long-term gain exclusion, U.S. interest, retirement, Edvest, medical insurance, private school tuition), the $500 capital loss limit, itemized deduction credit (Schedule 1), school property tax credit, married couple credit (Schedule 2), earned income credit (4/11/34%), donations (Schedule 3); fills Form 1 pages 1–5 |
| Indiana (Form IT-40) | Full-year residents: 3% state tax plus county tax at the January 1 county rate (all 92 counties, checked against Schedule CT-40); Schedule 1 add-backs, Schedule 2 deductions (rent, property tax, Social Security, U.S. interest, military, private school), Schedule 3 exemptions with IN-DEP, Schedule 5 credits (withholding, unified credit for the elderly, Indiana EIC with IN-EIC), Schedule 6 offset credits; fills IT-40, Schedules 1–3, 5–7, IN-DEP, CT-40 and IN-EIC |
| South Carolina (SC1040) | Full-year residents: federal taxable income with the state tax addback and QBI addback, 44% capital gain deduction, retirement and age 65 deductions, military retirement, $4,930 dependent exemptions (twice under 6), tax tables and rate schedule (0/3/6%), child care and two wage earner credits; the official SC1040 has no fillable fields, so the values are printed onto its boxes |
| Louisiana (IT-540) | Full-year residents: flat 3% tax, $12,500 / $25,000 standard deduction, federal medical deduction above the federal standard deduction for itemizers (lines 9A–9D), Schedule E exempt income (U.S. interest, Louisiana and federal retirement, $12,000 retirement exemption at 65, Social Security, school expense deductions), refundable and nonrefundable child care credits (Schedule J and worksheets), earned income credit (5% of federal), Schedule C credit for other states |
| Alabama (Form 40) | Full-year residents: Alabama wages (Schedule W-2), interest and dividends without U.S. obligations (Schedule B), Schedule RS (exempt defined benefit and government pensions, $6,000 exclusion at 65), Alabama adjustments, the larger of Schedule A (medical over 4%, FICA and self-employment tax, vehicle loan interest) and the standard deduction chart, the federal income tax deduction, personal and dependent exemptions (Schedule DS, HOF), tax table and worksheet (2%/4%/5%) |
| Oregon (OR-40) | Full-year residents: federal tax liability subtraction (Table 4 phase-out), Social Security, Schedule OR-ASC (U.S. bond interest, federal pension, tip / overtime / vehicle loan interest subtractions, other state credit, retirement income credit, WFHDC with the calculator percentage, 529 and ABLE credits), the larger of Schedule OR-A and the standard deduction, 2025 tax table and rate charts, exemption and political credits, the 9.863% kicker, Oregon EIC and Oregon Kids Credit |
| Kentucky (Form 740) | Full-year residents: flat 4%, $3,270 standard deduction (per spouse on a combined return, status 2), Schedule M amounts (U.S. interest, $31,110 pension exclusion, Social Security, military pay), Kentucky itemized deductions, personal tax credits, Family Size Tax Credit, 20% of the federal dependent care credit; Schedules M, A and ITC are listed to finish by hand |
| Oklahoma (Form 511) | Full-year residents: Schedule 511-A (U.S. interest, Social Security, military, CSRS and railroad retirement, $10,000 government / other retirement exclusion), 511-B, 511-C (military pay, 529), standard deduction or 511-D itemized ($17,000 limit), $1,000 exemptions incl. special and blind, 2025 tax table and worksheets, child care / child tax credit (511-F) and earned income credit (511-G) prorated by Oklahoma AGI |
| Connecticut (CT-1040) | Full-year residents: Schedule 1 (U.S. interest, Social Security benefit adjustment, pension and 75% IRA subtraction with the phase-out table, military / railroad / 50% teachers’ retirement, CHET, ABLE), Tax Calculation Schedule (Tables A–E), property tax credit (Schedule 3), CT EITC (Schedule CT-EITC); printed onto the non-fillable official forms |
| Utah (TC-40) | Full-year residents: 4.5% tax, taxpayer tax credit with phase-out, qualified exempt taxpayer, TC-40A additions / subtractions (U.S. interest, railroad retirement) and credits (retirement, Social Security, military retirement, 20% EITC, child tax credit for children 5 and under, my529), TC-40W withholding schedule |
| Iowa (IA 1040) | Full-year residents: Schedule 1 (U.S. interest, Social Security, military retirement, IRA / pension / railroad retirement at 55+ or disabled, active duty pay, Iowa 529, health insurance at 65+), 3.8% tax, alternate tax, single tax reduction worksheet, low-income exemption, exemption and K-12 tuition credits, school district surtax, child and dependent care or early childhood credit, 15% Iowa EITC |
| Kansas (K-40) | Full-year residents: Schedule S (Social Security, U.S. interest, exempt KPERS / federal / military / railroad retirement, 529, ABLE, KPERS add-back), exemptions with head-of-household, newborn and disabled veteran allowances, standard deduction chart, 2025 tax tables (5.2% / 5.58%), child care credit (50% of federal), refundable EITC (17%), contributions |
| Arkansas (AR1000F) | Full-year residents: income line by line (military pay and retirement exempt, U.S. interest exempt, 50% capital gain exclusion, $6,000 pension / IRA exemption per person), low income tax tables or standard / itemized deduction with the 2025 regular tax table, personal tax credits ($29), child care credit (20% of federal), additional tax credit for qualified individuals, 10% early distribution tax |
| Nebraska (1040N) | Full-year residents: Nebraska standard deduction chart or itemized less state income tax, Schedule I (Social Security, U.S. interest, military / railroad / CSRS retirement, NEST 529, Enable), 2025 Tax Calculation Schedule (2.46%–5.20%), $171 personal exemption credit, child care credit (25% nonrefundable or Form 2441N refundable), 10% EITC, federal tax liability limit, use tax |
| Mississippi (80-105) | Full-year residents: taxpayer and spouse columns, Social Security and retirement income exempt, early distributions taxed, U.S. interest exempt, Mississippi adjustments (IRA, National Guard pay, MPACT / MACS, SE health, HSA, half SE tax, ABLE), standard or Mississippi itemized deductions, exemptions, 0% / 4.4% tax with deductions divided between spouses, Forms 80-107 and 80-108 (interest, dividends, rents, other income, check-offs) |
| West Virginia (IT-140) | Full-year residents: Schedule M in you / spouse columns (U.S. interest, military, railroad and WV police / fire retirement, up to $2,000 of WV PERS / teachers’ or federal retirement, Social Security at 100% or 65%, senior citizen or disability deduction up to $8,000, 529, ABLE), low-income earned income exclusion, $2,000 exemptions, 2025 tax table and rate schedules, Family Tax Credit (FTC-1), 50% child care credit on RECAP, motor vehicle property tax credit, donations; drawn onto the official booklet pages |
| Maryland (Form 502) | Full-year residents: county and Baltimore City local tax (Anne Arundel and Frederick brackets), tax table and rate schedules with the new 6.25%/6.5% rates, standard deduction or itemized with state income tax removed and the 7.5% phaseout, exemption chart, pension exclusion, two-income subtraction, child care and Social Security subtractions, Form 502SU, state and local EIC (refundable part too), poverty level credits, senior tax credit, Maryland child tax credit, 2% capital gain tax over $350,000 AGI; fills Form 502, 502B and 502SU |
| Virginia (Form 760) | Full-year residents: Schedule ADJ additions, subtractions and deductions (bonus depreciation add-back, unemployment, child care and Commonwealth Savers figured automatically), age deduction worksheet, exemptions, standard deduction or Virginia Schedule A (10% medical floor, no SALT cap on property taxes, state income tax removed, conformity worksheet, Limited Itemized Deduction Worksheet above the income thresholds), Spouse Tax Adjustment worksheet, credit for low-income individuals or Virginia EIC (whichever helps more), Form 760C addition to tax for underpaid estimated tax (quarterly installments, overpayments applied to earlier shortfalls, Exception 1, 9% a year); fills the official Form 760, Schedule ADJ and Form 760C PDFs |

**IRS forms (PDF):** the Review step fills the official 2025 IRS PDFs in the browser and downloads one
print-ready file: Form 1040, Schedules 1, 1-A, 2, 3, A, B, C, D, E, SE, EIC, 8812, Forms 2441, 4562, 4797, 5329, 8582, 6251, 8829, 8863, 8880, 8889, 8949, 8995-A, 8959, 8960, 8995, and the
1040-V payment voucher when tax is owed. The blank forms live in `public/forms/2025` (official IRS PDFs).

## Tax years

Every tax year has its own rules file: `src/engine/rules2025.ts`, `src/engine/rules2026.ts`. They export the same names, and `src/engine/rules.ts` switches between them, so the engine is written once and `computeReturn()` uses the year saved in the return (About you → Tax year).

- **2025** — federal and state returns on the official forms.
- **2026** — federal tax with the 2026 rates and limits (Rev. Proc. 2025-32 and the 2025 tax law: $16,100 / $32,200 standard deduction, charity deduction for non-itemizers, 50% child care credit rate, $400 minimum QBI deduction, $350 educator limit, 2/37 limit on itemized deductions). The PDF and state returns turn on when the IRS and the states publish final 2026 forms (`FEDERAL_FORMS_READY` and `STATE_RETURNS_READY` in `rules.ts`).

Adding a new year: copy the newest `rulesYYYY.ts`, update the numbers from the IRS revenue procedure, add it to `rules.ts`, put the blank forms in `public/forms/YYYY/`, map any changed form fields, and add tests.

## Every line explained

On the Review step, select any Form 1040 line to see how it was figured: the formula, each entry or
schedule amount that went into it (they add up to the line), the brackets behind the tax on line 16,
a link to the IRS instructions, and a button to the step where those entries are made.

## What if

The last step compares the return with up to three scenarios side by side: extra 401(k), IRA or HSA
contributions, a donation, capital gains or losses, more self-employment or other income, another
filing status or deduction choice, an extra estimated payment. It shows the change in tax and refund,
the effective rate, and the true marginal rate on the next $1,000 (including phase-outs and
refundable credits). Scenarios are saved with the return; any scenario can be saved as a separate
return to work on in full.

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
K-1s from estates and trusts, Form 8582 Part IX and real estate professional status, state returns other than Virginia resident Form 760 (no 760PY, 763, Schedule OSC or CR computation, 760C exceptions 2–4 yet), e-file. The app flags these when they may apply.

## Project layout

```
src/
  engine/          Pure calculation engine, no UI code
    rules2025.ts   All 2025 rates, brackets, limits and phase-outs, with sources
    model.ts       Return data model and defaults
    compute.ts     TaxReturnInput → every Form 1040 line and schedule
    scenarios.ts   What-if changes applied to a copy of a return
    explain.ts     Line-by-line explanations of Form 1040 (tested to add up)
    compute.test.ts  Hand-worked regression cases
  app/             React interface
    App.tsx        Storage mode, lock and auto-lock, routing, autosave, the step shell
    store.ts       Many returns + preparer profile in local storage (tested)
    vault.ts       Password-encrypted storage, erase everything (tested)
    security.tsx   Lock screen, password settings, the Privacy page
    backup.ts      Backup files and password encryption (tested)
    pages.tsx      All returns, Settings, privacy notice, client letter
    steps.tsx      About you, Income, Deductions, Credits & payments
    review.tsx     Form 1040 lines, schedules, warnings, save/open/print
    compare.tsx    What if: scenarios side by side
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
