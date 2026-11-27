/**
 * Virginia 2026 (early-release drafts): the 2026 parameters from the draft Form 760 instructions and
 * Schedule A, and the packet on the 2026 draft PDFs (public/forms/2026), where every value must land on a field.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyReturn, emptyVaEntry, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeVirginia, povertyGuideline, vaTax } from '../engine/va2025.ts'
import { stateDraft, stateReady } from '../engine/rules.ts'
import { buildVirginiaPacket } from './va2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2026/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
const w2 = (owner: 'taxpayer' | 'spouse', wages: number) => ({
  ...emptyW2(owner), employer: 'Acme', wages, federalWithholding: wages * 0.1, socialSecurityWages: wages, medicareWages: wages
})

const base = (year: 2025 | 2026, patch: Partial<TaxReturnInput> = {}, va: Partial<TaxReturnInput['virginia']> = {}): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, taxYear: year, filingStatus: 'single', residentState: 'VA',
    taxpayer: { ...r.taxpayer, firstName: 'Jo', lastName: 'Lee', ssn: '123456789', age: 40 },
    contact: { ...r.contact, street: '1 Main St', city: 'Richmond', state: 'VA', zip: '23219' },
    w2s: [w2('taxpayer', 60000)],
    ...patch,
    virginia: { ...r.virginia, enabled: true, localityCode: '760', withholding: { taxpayer: 2500, spouse: 0 }, ...va }
  }
}

const run = (ret: TaxReturnInput) => {
  const res = computeReturn(ret)
  return { res, va: computeVirginia(ret, res) }
}

test('2026: Virginia is on as an early-release draft', () => {
  assert.equal(stateReady('VA', 2026), true)
  assert.equal(stateDraft('VA', 2026), true)
  assert.equal(stateDraft('VA', 2025), false)
  assert.equal(stateReady('MD', 2026), false)
})

test('2026 rates, standard deduction and exemptions are unchanged from 2025', () => {
  const { va } = run(base(2026))
  assert.equal(va.lines['11'], 8750)
  assert.equal(va.lines['12'], 930)
  assert.equal(va.lines['15'], va.lines['9'] - 8750 - 930)
  assert.equal(va.lines['16'], vaTax(va.lines['15']))
  assert.equal(vaTax(47000), 2445) // the instructions' STA example: $2,445 on $47,000
  const mfj = run(base(2026, { filingStatus: 'mfj', spouse: { ...emptyReturn().spouse, firstName: 'Al', lastName: 'Lee', ssn: '987654321', age: 41 } })).va
  assert.equal(mfj.lines['11'], 17500)
})

test('2026 poverty guidelines (Schedule ADJ line 11)', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => povertyGuideline(n, 2026)), [15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720])
  assert.equal(povertyGuideline(10, 2026), 55720 + 2 * 5680)
  assert.equal(povertyGuideline(1, 2025), 15650)
  // Single, VAGI $15,800: under the 2026 line but over the 2025 one.
  const low = (y: 2025 | 2026) => run(base(y, { w2s: [w2('taxpayer', 15800)] })).va.lowIncome
  assert.equal(low(2026).eligible, true)
  assert.equal(low(2025).eligible, false)
})

test('2026 age deduction: born on or before January 1, 1962', () => {
  const born = (y: 2025 | 2026) => run(base(y, { taxpayer: { ...emptyReturn().taxpayer, firstName: 'Jo', lastName: 'Lee', ssn: '123456789', age: y - 1961 } }, { birthDate: { taxpayer: '06/01/1961', spouse: '' } })).va
  assert.equal(born(2026).age.kind.taxpayer, 'income')
  assert.equal(born(2025).age.kind.taxpayer, 'none')
  // $60,000 wages: $12,000 less the $10,000 over the $50,000 single limit.
  assert.equal(born(2026).lines['4'], 2000)
})

test('2026 Schedule A: the limitation starts above the 2026 thresholds', () => {
  const itemizer = (y: 2025 | 2026, wages: number) => run(base(y, {
    w2s: [w2('taxpayer', wages)], deductionChoice: 'itemized',
    itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 20000, realEstateTax: 9000, mortgageInterest: 30000, charityCash: 10000 }
  })).va.itemized
  // $336,000 is over the 2025 single threshold ($332,700) but under 2026's ($340,750).
  assert.equal(itemizer(2025, 336000).worksheet?.['6'], 332700)
  assert.equal(itemizer(2026, 336000).worksheet, null)
  const high = itemizer(2026, 400000)
  assert.equal(high.worksheet?.['6'], 340750)
  assert.equal(high.worksheet?.['8'], Math.round((high.worksheet!['5'] - 340750) * 0.03))
  assert.equal(high.limited, true)
})

test('2026 underpayment: no addition to tax when $1,000 or less is owed', () => {
  // Owes a few hundred dollars more than withheld: an addition under the 2025 $150 rule, none for 2026.
  const owe = (y: 2025 | 2026) => run(base(y, {}, { withholding: { taxpayer: 2400, spouse: 0 } })).va
  const v26 = owe(2026)
  assert.ok(v26.lines['27'] > 150 && v26.lines['27'] <= 1000, `owed ${v26.lines['27']}`)
  assert.equal(v26.underpayment.safe, true)
  assert.match(v26.underpayment.reason, /\$1,000 or less/)
  assert.equal(v26.form760c.columns[0].due, '2026-05-01')
  assert.equal(owe(2025).form760c.columns[0].due, '2025-05-01')
})

test('2026 educator deduction (code 118): up to $500 an educator; not for 2025', () => {
  const ed = (y: 2025 | 2026) => run(base(y, {}, { deductions: [{ ...emptyVaEntry('118'), amount: 800 }] })).va
  const v26 = ed(2026)
  assert.equal(v26.adj.deductions.find((d) => d.code === '118')?.amount, 500)
  assert.ok(v26.issues.some((i) => i.includes('code 118')))
  const v25 = ed(2025)
  assert.equal(v25.adj.deductions.find((d) => d.code === '118'), undefined)
  assert.ok(v25.issues.some((i) => i.includes('not available for 2025')))
})

test('2026 packet: Form 760, Schedule ADJ and Schedule A drafts fill; Form 760C is listed, not included', async () => {
  const ret = base(2026, {
    filingStatus: 'mfj',
    spouse: { ...emptyReturn().spouse, firstName: 'Al', lastName: 'Lee', ssn: '987654321', age: 41 },
    dependents: [{ ...emptyDependent(), name: 'Mia Lee', relationship: 'Daughter', age: 9, ssn: '111223333', monthsLivedWithYou: 12 }],
    w2s: [w2('taxpayer', 300000), w2('spouse', 160000)], deductionChoice: 'itemized',
    itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 26000, realEstateTax: 9000, mortgageInterest: 30000, charityCash: 12000 }
  }, {
    withholding: { taxpayer: 12000, spouse: 6000 }, deductions: [{ ...emptyVaEntry('118'), amount: 300 }],
    additions: [{ ...emptyVaEntry('20'), amount: 400 }]
  })
  const { res, va } = run(ret)
  assert.ok(va.itemized.worksheet && va.itemized.worksheet['6'] === 408900)
  assert.equal(va.needs760c, true)
  const packet = buildVirginiaPacket(ret, res, va)
  assert.deepEqual(packet.forms.map((f) => f.id), ['va760', 'va760adj', 'va760sa'])
  assert.ok(packet.notIncluded.some((n) => n.startsWith('Form 760C (the 2026 form is not released yet')))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes, problems: p2 } = await buildPdf(lib, packet.forms, load, '2026 Virginia Form 760 (draft)')
  assert.deepEqual(p2, [])
  const doc = await lib.PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 6)
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
  const v = packet.forms[0].values
  assert.equal(v['16. Amount of tax'], String(va.lines['16']))
  assert.equal(v['10. Itemized Deductions'], String(va.lines['10']))
})

test('every Virginia 2026 draft is labeled as a 2026 draft', async () => {
  for (const f of ['va760.pdf', 'va760adj.pdf', 'va760sa.pdf']) {
    const doc = await lib.PDFDocument.load(await load(f))
    assert.match(doc.getTitle() ?? '', /^2026 Virginia .*draft/)
    assert.ok(doc.getForm().getFields().length > 50, f)
  }
})
