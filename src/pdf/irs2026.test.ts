/**
 * 2026 federal packet on the IRS draft forms: every value lands on a field, the 2026-only lines are filled,
 * and forms without a 2026 draft are listed instead of included.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyBusiness, emptyDependent, emptyK1, emptyProvider, emptyRental, emptyReturn, emptyStudent, emptyTransaction, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { buildPacket2026 } from './irs2026.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2026/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
const P2 = 'topmostSubform[0].Page2[0].'

const family = (patch: Partial<TaxReturnInput> = {}): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, taxYear: 2026, filingStatus: 'mfj',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 38 },
    contact: { ...r.contact, street: '1 Main St', city: 'Town', state: 'OH', zip: '43004' },
    digitalAssets: false, workAuthorized: { taxpayer: true, spouse: true }, publicBenefit: { qualified: true, want: true },
    dependents: [1, 2, 3, 4, 5].map((i) => ({ ...emptyDependent(), name: `Kid${i} Doe`, relationship: 'Son', age: 2 + i, ssn: `11122333${i}`, monthsLivedWithYou: 12 })),
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Acme', wages: 30000, federalWithholding: 900, socialSecurityWages: 30000, medicareWages: 30000 }],
    ...patch
  }
}

test('2026 draft packet: Form 1040 2026 lines, Schedule 3-A, and every value fills', async () => {
  const ret = family()
  const res = computeReturn(ret)
  assert.ok(res.f1040['27a'] + res.f1040['28'] > 0)
  assert.ok(res.schedule3A)
  assert.equal(res.f1040['32b'], 0)
  const p = buildPacket2026(ret, res)
  const f = p.forms.find((x) => x.id === '1040')!
  assert.equal(f.file, 'f1040.pdf')
  assert.equal(f.values['topmostSubform[0].Page1[0].c1_11[0]'], true)
  assert.equal(f.values[`${P2}Line31-32_ReadOrder[0].f2_31[0]`], res.f1040['32a'].toLocaleString('en-US'))
  assert.equal(f.values[`${P2}f2_32[0]`], '0')
  assert.equal(f.values[`${P2}f2_17[0]`], res.f1040['24'].toLocaleString('en-US'))
  assert.ok(p.forms.some((x) => x.id === 's3a'))
  assert.ok(p.forms.some((x) => x.id === 's8812'))
  assert.ok(p.forms.some((x) => x.id.startsWith('st-1040-deps')))
  assert.ok(p.notIncluded[0].includes('DRAFT'))
  const problems: FillProblem[] = []
  for (const form of p.forms) await fillForm(lib, await load(form.file), form, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, p.forms, load, '2026 Form 1040 draft')
  if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-2026-family.pdf`, bytes)
})

test('2026 Schedule 3-A: refunded credits are not paid when not qualified (line 32b)', () => {
  const ret = family({ publicBenefit: { qualified: false, want: true } })
  const res = computeReturn(ret)
  const s = res.schedule3A!
  assert.ok(s.line6 > 0)
  assert.equal(s.line32b, s.line6)
  assert.equal(res.f1040['32b'], s.line6)
  assert.equal(res.f1040['32'], res.f1040['32a'] - s.line6)
  const ok = computeReturn(family())
  assert.equal(ok.f1040['34'] - res.f1040['34'], s.line6)
})

test('2026 itemizer: Schedule A 2026 lines; Schedule C and SE on the drafts', async () => {
  const ret = family({
    dependents: [], filingStatus: 'single', spouse: emptyReturn().spouse,
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Acme', wages: 220000, federalWithholding: 40000, socialSecurityWages: 184500, medicareWages: 220000 }],
    itemized: { ...emptyReturn().itemized, mortgageInterest: 22000, realEstateTax: 9000, stateLocalIncomeOrSalesTax: 12000, charityCash: 6000 },
    businesses: [{ ...emptyBusiness('taxpayer'), name: 'Side gig', grossReceipts: 10000 }],
    capitalTransactions: [{ ...emptyTransaction(), description: 'Stock', term: 'long', dateAcquired: '01/01/2020', dateSold: '06/01/2026', proceeds: 15000, costBasis: 5000 }],
    students: [{ ...emptyStudent(), name: 'Pat Doe', ssn: '123456789', qualifiedExpenses: 3000 }]
  })
  const res = computeReturn(ret)
  assert.equal(res.deduction.used, 'itemized')
  const p = buildPacket2026(ret, res)
  const sa = p.forms.find((x) => x.id === 'sa')!
  assert.equal(sa.values['form1[0].Page2[0].Line11_ReadOrder[0].f2_01[0]'], '6,000')
  assert.equal(sa.values['form1[0].Page2[0].f2_19[0]'], res.scheduleA.total.toLocaleString('en-US'))
  const sc = p.forms.find((x) => x.file === 'f1040sc.pdf')!
  assert.equal(sc.values['f1_13[0]'], '10,000')
  assert.ok(!('f1_10[0]' in sc.values))
  assert.ok(p.forms.some((x) => x.file === 'f1040sse.pdf'))
  const s2 = p.forms.find((x) => x.id === 's2')!
  assert.equal(s2.values['f1_15[0]'], res.schedule2.selfEmploymentTax.toLocaleString('en-US'))
  // Additional Medicare tax: $20,000 of wages over $200,000 (line 17b); all SE earnings are over it too (line 11).
  const seEarn = res.scheduleSE[0].netEarnings
  assert.equal(s2.values['f2_12[0]'], '180')
  assert.equal(s2.values['f1_22[0]'], Math.round(seEarn * 0.009).toLocaleString('en-US'))
  assert.equal(180 + Math.round(seEarn * 0.009), res.schedule2.additionalMedicareTax)
  assert.equal(s2.values['f2_20[0]'], res.schedule2.total.toLocaleString('en-US'))
  assert.ok(!p.notIncluded.some((x) => x.includes('Schedule C') || x.includes('Schedule 2')))
  assert.ok(p.forms.some((x) => x.id === 'sd'))
  const problems: FillProblem[] = []
  for (const form of p.forms) await fillForm(lib, await load(form.file), form, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, p.forms, load, '2026 Form 1040 draft')
  if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-2026-itemizer.pdf`, bytes)
})

test('2026 rental, K-1, childcare, QBI, tips and senior deduction on the drafts', async () => {
  const ret = family({
    dependents: [{ ...emptyDependent(), name: 'Kid Doe', relationship: 'Son', age: 4, ssn: '111223331', monthsLivedWithYou: 12 }],
    taxpayer: { ...family().taxpayer, age: 66, age65OrOlder: true },
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Diner', wages: 48000, federalWithholding: 3000, socialSecurityWages: 48000, medicareWages: 48000 },
      { ...emptyW2('spouse'), employer: 'Shop', wages: 40000, federalWithholding: 2500, socialSecurityWages: 40000, medicareWages: 40000 }],
    schedule1A: { qualifiedTips: 6000, qualifiedOvertime: 3000, carLoanInterest: 2000, vehicleVin: '1HGCM82633A004352' },
    dependentCare: { expenses: 4000, employerBenefits: 0, providers: [{ ...emptyProvider(), name: 'Little Steps', address: '9 Elm St, Town, OH 43004', tin: '12-3456789', amountPaid: 4000 }] },
    businesses: [{ ...emptyBusiness('spouse'), name: 'Crafts', activity: 'Crafts', grossReceipts: 30000 }],
    rentals: [{ ...emptyRental('taxpayer'), address: '5 Oak Ave, Town, OH 43004', rents: 18000, expenses: { ...emptyRental().expenses, mortgageInterest: 4000, taxes: 2500, repairs: 1000 } }],
    k1s: [{ ...emptyK1('taxpayer'), entityName: 'Fund LP', ein: '12-3456789', ordinary: 5000, qbi: { income: 5000, w2Wages: 0, ubia: 0, sstb: false } }]
  })
  const res = computeReturn(ret)
  const p = buildPacket2026(ret, res)
  const ids = p.forms.map((x) => x.file)
  for (const f of ['f1040s1a.pdf', 'f1040s2.pdf', 'f1040sc.pdf', 'f1040se.pdf', 'f2441.pdf', 'f8995.pdf']) assert.ok(ids.includes(f), f)
  const se = p.forms.find((x) => x.file === 'f1040se.pdf')!
  assert.equal(se.values['f1_28[0]'], '18,000')
  assert.ok(!se.values['f1_64[0]'])
  assert.equal(se.values['f1_55[0]'], '4,000')
  assert.equal(se.values['f3_4[0]'], res.schedule1.rentalIncome.toLocaleString('en-US'))
  assert.ok(se.pages?.includes(2))
  const c2441 = p.forms.find((x) => x.id === '2441')!
  assert.equal(c2441.values['Provider1[0].f1_3[0]'], 'Little Steps')
  assert.equal(c2441.values['Provider1[0].c1_4[1]'], true)
  const q = p.forms.find((x) => x.id === '8995')!
  assert.equal(q.values['f1_33[0]'], res.f1040['13a'].toLocaleString('en-US'))
  const a = p.forms.find((x) => x.id === 's1a')!
  assert.equal(a.values['f1_109[0]'], res.schedule1A.tips.toLocaleString('en-US'))
  assert.equal(a.values['f3_23[0]'], res.schedule1A.total.toLocaleString('en-US'))
  assert.ok(res.schedule1A.senior > 0)
  const problems: FillProblem[] = []
  for (const form of p.forms) await fillForm(lib, await load(form.file), form, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, p.forms, load, '2026 Form 1040 draft')
  if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-2026-mixed.pdf`, bytes)
})

test('2026 forms used as-is (EIC, 8889, 8880, 8582, 8829, 6251): every value lands on a field', async () => {
  const low = family({
    dependents: [{ ...emptyDependent(), name: 'Kid Doe', relationship: 'Son', age: 6, ssn: '111223331', monthsLivedWithYou: 12 }],
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Acme', wages: 26000, federalWithholding: 500, socialSecurityWages: 26000, medicareWages: 26000 }],
    hsa: { taxpayer: { ...emptyReturn().hsa.taxpayer, coverage: 'family', personalContributions: 2000, distributions: 500, qualifiedExpenses: 500 }, spouse: emptyReturn().hsa.spouse },
    savings: { taxpayer: { iraContributions: 1000, electiveDeferrals: 0, distributions: 0 }, spouse: emptyReturn().savings.spouse },
    businesses: [{ ...emptyBusiness('taxpayer'), name: 'Tutoring', activity: 'Tutoring', grossReceipts: 8000, homeOffice: { ...emptyBusiness().homeOffice, method: 'regular', homeSqFt: 1000, officeSqFt: 100, rent: 12000, utilities: 2400 } }]
  })
  const high = family({
    dependents: [], filingStatus: 'single', spouse: emptyReturn().spouse,
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Acme', wages: 260000, federalWithholding: 60000, socialSecurityWages: 184500, medicareWages: 260000 }],
    rentals: [{ ...emptyRental('taxpayer'), address: '5 Oak Ave', rents: 10000, priorUnallowed: 3000, expenses: { ...emptyRental().expenses, mortgageInterest: 9000, taxes: 4000, repairs: 2000 } }]
  })
  for (const [name, ret] of [['low', low], ['high', high]] as const) {
    const res = computeReturn(ret)
    const p = buildPacket2026(ret, res)
    const files = p.forms.map((x) => x.file)
    if (name === 'low') for (const f of ['f1040sei.pdf', 'f8889.pdf', 'f8829.pdf', ...(res.form8880.credit > 0 ? ['f8880.pdf'] : [])]) assert.ok(files.includes(f), f)
    if (name === 'high') assert.ok(files.includes('f8582.pdf'))
    const problems: FillProblem[] = []
    for (const form of p.forms) await fillForm(lib, await load(form.file), form, problems)
    assert.deepEqual(problems, [], name)
    if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-2026-${name}.pdf`, (await buildPdf(lib, p.forms, load, name)).bytes)
  }
})
