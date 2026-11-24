/**
 * Louisiana Form IT-540 (2025). Expected values are worked by hand from the 2025 IT-540 instructions: flat 3% tax,
 * $12,500 / $25,000 standard deduction, lines 9A–9D for federal itemizers, Schedule E exempt income (06E at most
 * $12,000 per person 65 or older, 07E taxable Social Security), the refundable and nonrefundable child care credits
 * and the earned income credit (5% of the federal credit).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { LaInput, TaxReturnInput } from './model.ts'
import { computeLouisiana, laNonrefundableCare, laRefundableCareRate } from './la2025.ts'
import { buildLaPacket } from '../pdf/la2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'LA',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '617 N 3rd St', city: 'Baton Rouge', state: 'LA', zip: '70802', phone: '225-555-0100' },
    ...patch
  }
}
const la = (ret: TaxReturnInput, x: Partial<LaInput> = {}) => {
  const r = { ...ret, la: { ...ret.la, ...x } }
  const res = computeReturn(r)
  return { la: computeLouisiana(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '72-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('LA single W-2: 3% after the $12,500 standard deduction', () => {
  const w = w2(60000)
  const { la: r } = la(base({ w2s: [w] }), { w2: withheld(w, 1500) })
  assert.equal(r.usesScheduleE, false)
  assert.equal(r.lines['7'], 60000)
  assert.equal(r.lines['10'], 47500)
  assert.equal(r.lines['11'], 1425)
  assert.equal(r.lines['38'], 75)
})

test('LA joint filers and head of household get $25,000', () => {
  assert.equal(la(base({ filingStatus: 'mfj', w2s: [w2(80000)] })).la.lines['11'], 1650)
  assert.equal(la(base({ filingStatus: 'hoh', w2s: [w2(40000)], dependents: [kid(15)] })).la.lines['8'], 25000)
})

test('LA retiree: Social Security and the $12,000 retirement exemption at 65', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const { la: r, res } = la(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [pension], socialSecurity: [ss] }))
  assert.equal(r.usesScheduleE, true)
  assert.deepEqual(r.exempt.map((x) => x.code), ['06', '07'])
  assert.equal(r.exempt[0].amount, 12000)
  assert.equal(r.exempt[1].amount, Math.round(res.f1040['6b']))
  assert.equal(r.lines['7'], Math.round(res.f1040['11a']) - 12000 - Math.round(res.f1040['6b']))
  // Exempt state retirement (02E) comes off the pension before the 06E worksheet.
  const lasers = la(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [pension] }),
    { exemptRetirement: { ...emptyReturn().la.exemptRetirement, '02E': { taxpayer: 25000, spouse: 0 } } }).la
  assert.equal(lasers.exempt.find((x) => x.code === '02')?.amount, 25000)
  assert.equal(lasers.exempt.find((x) => x.code === '06')?.amount, 5000)
})

test('LA itemizers: only medical above the federal standard deduction (9D)', () => {
  const { la: r } = la(base({ w2s: [w2(100000)], itemized: { ...emptyReturn().itemized, medical: 30000, mortgageInterest: 12000 } }))
  assert.equal(r.lines['9B'], 30000 - 7500)
  assert.equal(r.lines['9C'], 15750)
  assert.equal(r.lines['9D'], 22500 - 15750)
  assert.equal(r.lines['10'], 100000 - 12500 - 6750)
})

test('LA credits: earned income credit and both child care credits', () => {
  assert.equal(laRefundableCareRate(15000), 0.35)
  assert.equal(laRefundableCareRate(24000), 0.3)
  assert.equal(laNonrefundableCare(600, 30000), 180)
  assert.equal(laNonrefundableCare(600, 50000), 60)
  assert.equal(laNonrefundableCare(600, 90000), 25)
  const low = la(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(4)], dependentCare: { expenses: 2000, employerBenefits: 0, providers: [] } }))
  assert.ok(low.res.f1040['27a'] > 0)
  assert.equal(low.la.lines['16'], Math.round(low.res.f1040['27a'] * 0.05))
  assert.equal(low.la.lines['14A'], 2000)
  assert.equal(low.la.lines['14'], Math.round(2000 * 0.32 * 0.5)) // AGI $20,000: .32
  const mid = la(base({ filingStatus: 'mfj', w2s: [w2(30000), w2(20000, 'spouse')], dependents: [kid(5)], dependentCare: { expenses: 3000, employerBenefits: 0, providers: [] } })).la
  assert.equal(mid.schJ['1'], 600) // 20% × $3,000
  assert.equal(mid.schJ['2'], 60) // AGI $50,000: 10%
  assert.equal(mid.lines['21'], 60)
})

test('IT-540: every value lands on one field and the PDF builds', async () => {
  const w = w2(60000)
  const pension = { ...empty1099R(), owner: 'spouse' as const, payer: 'TRSL', grossDistribution: 20000, taxableAmount: 20000, code: '7' }
  const { la: r, res, ret } = la(base({ filingStatus: 'mfj', w2s: [w, w2(15000, 'spouse')], dependents: [kid(5), kid(10, 'Amy Doe')], retirement: [pension],
    dependentCare: { expenses: 4000, employerBenefits: 0, providers: [{ id: 'p', name: 'Little Tigers', address: '1 Main St, Baton Rouge LA', tin: '721112222', householdEmployee: false, amountPaid: 4000 }] },
    refundDeposit: { routingNumber: '065400137', accountNumber: '5551212', accountType: 'checking' } }),
  { w2: withheld(w, 2600), birthDate: { taxpayer: '01/02/1985', spouse: '03/04/1960' }, usObligationInterest: 100, useTax: 20,
    exemptRetirement: { ...emptyReturn().la.exemptRetirement, '03E': { taxpayer: 0, spouse: 20000 } }, retired: { taxpayer: '', spouse: '062020' } })
  const packet = buildLaPacket(ret, res, r)
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.deepEqual(packet.forms[0].pages, [1, 2, 3, 4, 7, 11, 12, 15])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 LA')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-LA.pdf`, bytes)
})

test('LA Schedules F and I: listed credits fill the schedules and lines 17 and 26', async () => {
  const w = w2(50000)
  const { la: r, res, ret } = la(base({ w2s: [w] }), {
    w2: withheld(w, 1000),
    schF: [{ description: 'Stillborn child', code: '76F', amount: 5000 }, { description: 'School readiness directors', code: '66', amount: 1800 }], schoolReadinessLicense: 'CC-123456',
    musical: [{ cert: 'MTP-2025-01', amount: 700 }],
    schI: [{ description: 'Inventory tax', code: '50', amount: 450 }]
  })
  assert.equal(r.lines['17'], 7500)
  assert.equal(r.lines['26'], 450)
  const packet = buildLaPacket(ret, res, r)
  const v = packet.forms[0].values
  assert.deepEqual([v['SchFDescript2'], v['SchFCode2'], v['SchFCode3'], v['SchFSchReadinessLicenseNo'], v['SchFCertNo7A'], v['SchICode1']], ['STILLBORN CHILD', '76', '66', 'CC123456', 'MTP202501', '50'])
  assert.ok(packet.forms[0].pages!.includes(9) && packet.forms[0].pages!.includes(10))
  assert.ok(!packet.notIncluded.some((x) => x.includes('list each credit')))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 LA')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-LAF.pdf`, bytes)
  // A total entered without rows still works.
  assert.equal(la(base({ w2s: [w] }), { otherRefundableCredits: 300 }).la.lines['17'], 300)
})
