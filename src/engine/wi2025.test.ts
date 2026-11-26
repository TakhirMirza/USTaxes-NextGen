/**
 * Wisconsin Form 1 (2025). Expected values are worked by hand from the 2025 Form 1 instructions: the Standard
 * Deduction Table, the tax table (the engine matches all 1,005 rows in all three columns) and the Tax Computation
 * Worksheet, the school property tax credit tables, Schedules 1 and 2, and the earned income credit percentages.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099Div, emptyDependent, emptyReturn, emptySocialSecurity, emptyTransaction, emptyW2 } from './model.ts'
import type { TaxReturnInput, WiInput } from './model.ts'
import { computeWisconsin, wiHomeownerCredit, wiRenterCredit, wiStandardDeduction, wiTax } from './wi2025.ts'
import { buildWiPacket } from '../pdf/wi2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'WI',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1 State St', city: 'Madison', state: 'WI', zip: '53703', phone: '608-555-0100' },
    ...patch
  }
}
const wi = (ret: TaxReturnInput, w: Partial<WiInput> = {}) => {
  const x = { ...ret, wi: { ...ret.wi, ...w } }
  const res = computeReturn(x)
  return { wi: computeWisconsin(x, res), res, ret: x }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '39-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('WI tax table, worksheet and standard deduction table', () => {
  assert.equal(wiTax(28653, 'mfj'), 1084) // the instructions' example
  assert.equal(wiTax(39424, 'single'), 1604)
  assert.equal(wiTax(150000, 'single'), Math.round(150000 * 0.053 - 586.44))
  assert.equal(wiTax(500000, 'mfj'), Math.round(500000 * 0.0765 - 10911.83))
  assert.equal(wiStandardDeduction(50000, 'single'), 9876)
  assert.equal(wiStandardDeduction(70000, 'mfj'), 16795)
  assert.equal(wiStandardDeduction(5000, 'hoh'), 17520)
  assert.equal(wiStandardDeduction(200000, 'mfj'), 0)
})

test('WI school property tax credit tables', () => {
  assert.equal(wiRenterCredit(2050, true), 49)
  assert.equal(wiRenterCredit(2050, false), 62)
  assert.equal(wiRenterCredit(13000, false), 300)
  assert.equal(wiHomeownerCredit(10), 2)
  assert.equal(wiHomeownerCredit(1510), 182)
  assert.equal(wiHomeownerCredit(5000), 300)
})

test('WI single W-2', () => {
  const w = w2(50000)
  const { wi: r } = wi(base({ w2s: [w] }), { w2: withheld(w, 2000) })
  assert.equal(r.lines['7'], 50000)
  assert.equal(r.lines['8'], 9876)
  assert.equal(r.lines['10c'], 700)
  assert.equal(r.lines['11'], 39424)
  assert.equal(r.lines['12'], 1604)
  assert.equal(r.lines['41'], 396)
})

test('WI married couple: exemptions, married couple credit, school property tax credit', () => {
  const { wi: r } = wi(base({ filingStatus: 'mfj', w2s: [w2(40000), w2(30000, 'spouse')], dependents: [kid(5), kid(9, 'Amy Doe')] }), { propertyTaxes: 1510 })
  assert.equal(r.lines['8'], 16795)
  assert.equal(r.lines['10a'], 2800) // 2 filers + 2 dependents
  assert.equal(r.lines['11'], 70000 - 16795 - 2800)
  assert.equal(r.lines['18'], 480) // 3% × $16,000
  assert.equal(r.lines['16b'], 182)
})

test('WI subtractions: Social Security, 30% capital gain exclusion; $500 loss limit', () => {
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 30000 }
  const div = { ...empty1099Div(), payer: 'Fund', ordinaryDividends: 10000, capitalGainDistributions: 10000 }
  const { wi: r, res } = wi(base({ w2s: [w2(40000)], socialSecurity: [ss], dividends: [div] }))
  assert.equal(r.sb['socialSecurity'], Math.round(res.f1040['6b']))
  assert.equal(r.sb['capitalGain'], 3000)
  assert.equal(r.lines['6'], r.sb['socialSecurity'] + 3000)
})

test('WI earned income credit: 4% / 11% / 34% of the federal credit', () => {
  const { wi: one, res } = wi(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(5)] }))
  assert.equal(one.eicPercent, 4)
  assert.equal(one.lines['30'], Math.round(res.f1040['27a'] * 0.04))
  const { wi: three } = wi(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(5), kid(7, 'B Doe'), kid(9, 'C Doe')] }))
  assert.equal(three.eicPercent, 34)
})

test('WI itemized deduction credit (Schedule 1)', () => {
  const { wi: r, res } = wi(base({ filingStatus: 'mfj', w2s: [w2(70000)], itemized: { ...emptyReturn().itemized, mortgageInterest: 20000, charityCash: 5000 } }))
  assert.equal(r.sch1['5'], Math.round(res.scheduleA.interest) + Math.round(res.scheduleA.charity))
  assert.equal(r.lines['13'], Math.round(Math.max(0, r.sch1['5'] - r.lines['8']) * 0.05))
})

test('WI Form 1: every value lands on one field and the PDF builds', async () => {
  const w = w2(40000)
  const { wi: r, res, ret } = wi(base({ filingStatus: 'mfj', w2s: [w, w2(30000, 'spouse')], dependents: [kid(5)], itemized: { ...emptyReturn().itemized, mortgageInterest: 20000, charityCash: 5000 } }),
    { w2: withheld(w, 1500), districtType: 'city', districtName: 'Madison', county: 'Dane', schoolDistrict: '3269', rentHeatIncluded: 0, propertyTaxes: 3000, donations: { '1a': 10 } })
  const packet = buildWiPacket(ret, res, r)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 4])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  await fillForm(lib, await load('wi1.pdf'), { ...packet.forms[0] }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 WI')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-WI.pdf`, bytes)
})

test('WI Schedules SB, AD, WD, CR and OS print on the official forms', async () => {
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  // Gain case: Social Security, retirement subtraction (age 68), 30% exclusion on long-term gains, other state credit, CR credits.
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 30000 }
  const div = { ...empty1099Div(), payer: 'Fund', ordinaryDividends: 10000, capitalGainDistributions: 10000 }
  const g = wi(base({ taxpayer: { ...base({}).taxpayer, age: 68, age65OrOlder: true }, w2s: [w2(40000)], socialSecurity: [ss], dividends: [div] }),
    { retirementSubtraction: 5000, otherSubtractions: 700, otherStateBondInterest: 400, nonrefundableCredits: 150, otherStateCredit: 300, otherStateCode: 'mn' })
  const p = buildWiPacket(g.ret, g.res, g.wi)
  const ids = p.forms.map((f) => f.id)
  for (const id of ['wi-sb', 'wi-ad', 'wi-wd', 'wi-cr', 'wi-os']) assert.ok(ids.includes(id), ids.join(', '))
  const sb = p.forms.find((f) => f.id === 'wi-sb')!.values
  assert.equal(sb.line4, String(g.wi.sb['socialSecurity']))
  assert.equal(sb.line5, '3000')
  assert.equal(sb.line16, '5000')
  assert.equal(sb.line49d, '700')
  assert.equal(sb.line50, String(g.wi.lines['6']))
  const wd = p.forms.find((f) => f.id === 'wi-wd')!.values
  assert.equal(wd['14'], '10000')
  assert.equal(wd['20'], '3000')
  assert.equal(wd['29d'], '3000') // matches Schedule SB line 5
  const os = p.forms.find((f) => f.id === 'wi-os')!.values
  assert.equal(os.sta1, 'M'); assert.equal(os.sta1a, 'N'); assert.equal(os.state41, '300')
  assert.ok(!p.notIncluded.some((n) => /^Schedule (AD|SB|WD) \(/.test(n)), p.notIncluded.join('; '))
  // Loss case: $500 limit; the add-back lands on Schedule AD line 2 and WD line 29h; Part V carryovers.
  const l = wi(base({ w2s: [w2(40000)], capitalTransactions: [{ ...emptyTransaction(), description: 'XYZ', term: 'long', dateAcquired: '01/02/2020', dateSold: '05/01/2025', proceeds: 2000, costBasis: 10000 }] }))
  const pl = buildWiPacket(l.ret, l.res, l.wi)
  const ad = pl.forms.find((f) => f.id === 'wi-ad')!.values
  assert.equal(ad.line2, '2500')
  const wdl = pl.forms.find((f) => f.id === 'wi-wd')!.values
  assert.equal(wdl['28'], '500'); assert.equal(wdl['29e'], '3000'); assert.equal(wdl['29h'], '2500'); assert.equal(wdl['39'], '7500')
  for (const packet of [p, pl]) {
    const problems: FillProblem[] = []
    for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
    assert.deepEqual(problems, [])
  }
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-WI-sched.pdf`, (await buildPdf(lib, [...p.forms, ...pl.forms.slice(1)], load, 'WI')).bytes)
})
