/**
 * 2026 federal packet on the IRS draft forms: every value lands on a field, the 2026-only lines are filled,
 * and forms without a 2026 draft are listed instead of included.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyBusiness, emptyDependent, emptyReturn, emptyStudent, emptyTransaction, emptyW2 } from '../engine/model.ts'
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

test('2026 itemizer: Schedule A 2026 lines; Schedule C/SE left out and listed', async () => {
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
  assert.ok(!p.forms.some((x) => x.file === 'f1040sc.pdf' || x.file === 'f1040sse.pdf'))
  assert.ok(p.notIncluded.some((x) => x.includes('Schedule C')))
  assert.ok(p.forms.some((x) => x.id === 'sd'))
  const problems: FillProblem[] = []
  for (const form of p.forms) await fillForm(lib, await load(form.file), form, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, p.forms, load, '2026 Form 1040 draft')
  if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-2026-itemizer.pdf`, bytes)
})
