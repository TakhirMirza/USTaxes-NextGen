/**
 * Vermont IN-111 (2025), worked by hand from the 2025 Income Tax Return Booklet (rate schedules on page 46, tax
 * tables from page 47, IN-112 worksheets on pages 16–17 and 33–34).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptySocialSecurity, emptyTransaction, emptyW2 } from './model.ts'
import type { TaxReturnInput, VtInput } from './model.ts'
import { computeVermont, vtChildCreditPerChild, vtTax, vtUseTaxEstimate } from './vt2025.ts'
import { buildVtPacket } from '../pdf/vt2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kai Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'VT',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '133 State St', city: 'Montpelier', state: 'VT', zip: '05633', phone: '802-555-0100' },
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<VtInput> = {}) => {
  const r = { ...ret, vt: { ...ret.vt, schoolCode: '126', ...x } }
  const res = computeReturn(r)
  return { vt: computeVermont(r, res), res, ret: r }
}

test('VT tax table rows and rate schedules', () => {
  // Rows from the 2025 tax tables (single / joint / separate / head of household).
  const rows: [number, number, number, number, number][] = [[50, 0, 0, 0, 0], [150, 5, 5, 5, 5], [5050, 169, 169, 169, 169], [41350, 1385, 1385, 1389, 1385],
    [50150, 1705, 1680, 1969, 1680], [74950, 3341, 2511, 3606, 2796]]
  for (const [x, s, j, m, h] of rows) {
    assert.equal(vtTax(x, 'single'), s, `single ${x}`)
    assert.equal(vtTax(x, 'mfj'), j, `joint ${x}`)
    assert.equal(vtTax(x, 'mfs'), m, `separate ${x}`)
    assert.equal(vtTax(x, 'hoh'), h, `hoh ${x}`)
  }
  assert.equal(vtTax(85000, 'mfj'), 2929) // the booklet’s worked example
  assert.equal(vtTax(250000, 'single'), Math.round(16175 + 300 * 0.0875))
})

test('VT child tax credit table and use tax estimate', () => {
  assert.equal(vtChildCreditPerChild(125000), 1000)
  assert.equal(vtChildCreditPerChild(125001), 980)
  assert.equal(vtChildCreditPerChild(137500), 740)
  assert.equal(vtChildCreditPerChild(174000), 20)
  assert.equal(vtChildCreditPerChild(174001), 0)
  assert.equal(vtUseTaxEstimate(20000), 0)
  assert.equal(vtUseTaxEstimate(30000), 10)
  assert.equal(vtUseTaxEstimate(30001), 15)
  assert.equal(vtUseTaxEstimate(100000), 45)
  assert.equal(vtUseTaxEstimate(400000), 150)
})

test('VT single W-2: standard deduction, exemption, tax table', () => {
  const w = w2(50000)
  const { vt } = run(base({ w2s: [w] }), { w2: { [w.id]: { ein: '03-1234567', stateId: '', stateIncome: null, stateTax: 1300 } } })
  const L = vt.lines
  assert.equal(L['4'], 7650)
  assert.equal(L['5e'], 5300)
  assert.equal(L['7'], 37050)
  assert.equal(L['8'], 1241) // row 37,000–37,100: 3.35% × 37,050
  assert.equal(L['16'], 1241)
  assert.equal(L['29'], 59)
})

test('VT family: EITC 38%, child tax credit for a child under 6, 72% of the child care credit', () => {
  const { vt, res } = run(base({ filingStatus: 'mfj', w2s: [w2(25000), w2(15000, 'spouse')], dependents: [kid(3), kid(8, 'Lei Doe')] }))
  const P2 = vt.p2
  assert.equal(vt.lines['4'], 15300)
  assert.equal(vt.lines['5d'], 4)
  assert.equal(vt.lines['7'], pos(40000 - 15300 - 21200))
  assert.equal(P2['3'], 1)
  assert.equal(P2['4'], 1000)
  assert.equal(P2['7'], Math.round(res.f1040['27a'] * 0.38))
  assert.equal(vt.lines['26c'], P2['13'])
})

test('VT retirement income exemption phases out between $55,000 and $65,000', () => {
  const ss = { ...emptySocialSecurity(), netBenefits: 30000 }
  const r0 = emptyReturn()
  const old = { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }
  const low = run(base({ taxpayer: old, socialSecurity: [ss], w2s: [w2(20000)] }))
  assert.equal(low.vt.retirementChoice, 'ss')
  assert.equal(low.vt.p1['12'], Math.round(low.res.f1040['6b']))
  assert.equal(low.vt.lines['4'], 7650 + 1250)
  const mid = run(base({ taxpayer: old, socialSecurity: [ss], w2s: [w2(38000)] }))
  const agi = mid.vt.lines['1']
  assert.ok(agi > 55000 && agi < 65000, `AGI ${agi}`)
  const share = Math.min(1, Math.round((65000 - agi) / 10000 * 100) / 100)
  assert.equal(mid.vt.p1['12'], Math.round(mid.res.f1040['6b'] * share))
})

test('VT capital gains flat exclusion and charitable credit', () => {
  const r0 = emptyReturn()
  const { vt } = run(base({ w2s: [w2(60000)], capitalTransactions: [{ ...emptyTransaction(), term: 'long' as const, proceeds: 20000, costBasis: 8000 }], itemized: { ...r0.itemized, charityCash: 30000 } }))
  assert.equal(vt.p1['8'], 5000)
  assert.equal(vt.lines['13'], 1000)
})

test('IN-111 packet: every value lands on one field and the PDF builds', async () => {
  const r0 = emptyReturn()
  const t = w2(45000)
  const s = w2(30000, 'spouse')
  const { vt, res, ret } = run(base({ filingStatus: 'mfj', w2s: [t, s], dependents: [kid(4)], itemized: { ...r0.itemized, charityCash: 1000 }, capitalTransactions: [{ ...emptyTransaction(), term: 'long' as const, proceeds: 9000, costBasis: 6000 }] }), {
    w2: { [t.id]: { ein: '03-1234567', stateId: '', stateIncome: null, stateTax: 1600 }, [s.id]: { ein: '03-7654321', stateId: '', stateIncome: null, stateTax: 900 } },
    usObligationInterest: 0, contributions: { '24a': 5, '24c': 10 }, birthDates: { taxpayer: '4/5/1985', spouse: '6/7/1986' }, veteran: false, militaryPay: 4000, activeDutyMonths: 3,
    bondInterest: 0, useTax: { mode: 'estimate', amount: 0 },
    otherState: { state: 'NH', income: 20000, tax: 500, bonusAdded: 0, muniInterest: 0, bonusSubtracted: 0, usInterest: 0 },
    in119: { ...r0.vt.in119, vtRecapture: 40, credits: { '2': { earned: 100, carry: 50 } } },
    renter: { ...r0.vt.renter, claim: true, county: 'Washington', span: '12604012346', address: '9 Main St', unit: '2', monthsRented: 12 },
    homestead: { ...r0.vt.homestead, file: true, claimCredit: true, span: '126-040-12345', location: '12 Elm St', town: 'Montpelier', housesiteValue: 250000, educationTax: 3800, municipalTax: 2100, ownership: 100 }
  })
  const packet = buildVtPacket(ret, res, vt)
  assert.deepEqual(packet.forms.map((f) => f.id), ['vt-in111', 'vt-in112', 'vt-in113', 'vt-in117', 'vt-in119', 'vt-in153', 'vt-hs122', 'vt-rcc146'])
  assert.equal(vt.p1['8'], 3000)
  assert.equal(vt.lines['18'], 150)
  assert.equal(vt.lines['9'], 40)
  assert.ok(vt.lines['17'] > 0 && vt.lines['17'] <= 500)
  assert.ok(vt.adjustment < 1 && vt.adjustment > 0.9)
  assert.ok(vt.hi144 && vt.hi144.z > 0)
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 VT')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-VT.pdf`, bytes)
})

function pos(n: number): number { return Math.max(0, n) }

test('VT Worksheet IN-152: underpayment interest and penalty by quarter', async () => {
  const ret = base({ w2s: [w2(100000)] })
  const none = run(ret)
  assert.equal(none.vt.in152, null)
  assert.ok(none.vt.issues.some((x) => x.includes('IN-152 section')))
  const { vt, res, ret: r } = run(ret, { in152: { priorTax: 3000, quarterly: [1000, 0, 0, 0], paidDate: '' } })
  const w = vt.in152!
  assert.equal(w.l1, Math.round((vt.lines['20'] - vt.lines['26c']) * 0.9))
  assert.ok(w.l1 > 3000)
  assert.equal(w.l3, 3000)
  const q = w.quarters
  assert.deepEqual(q.map((x) => x.l4), [750, 750, 750, 750])
  assert.deepEqual(q.map((x) => x.l5c), [750, 250, 0, 0]) // the 250 excess moves to June
  assert.deepEqual(q.map((x) => x.l6), [0, 500, 750, 750])
  assert.deepEqual(q.map((x) => x.l8a), [0, 200, 108, 0])
  assert.deepEqual(q.map((x) => x.l8b), [0, 104, 104, 90])
  assert.deepEqual(q.map((x) => x.l12), [0, 10, 7, 3])
  const interest = 500 * 200 / 365 * 0.085 + 500 * 104 / 365 * 0.0775 + 750 * 108 / 365 * 0.085 + 750 * 104 / 365 * 0.0775 + 750 * 90 / 365 * 0.0775
  assert.equal(w.l11, Math.round(interest))
  assert.equal(w.l14, Math.round(500 * 0.1 + 750 * 0.07 + 750 * 0.03))
  assert.equal(w.l15, w.l11 + w.l14)
  assert.equal(vt.lines['31'], w.l15)
  assert.equal(vt.lines['32'], vt.lines['30'] + w.l15)
  // Paid in full on February 10, 2026: days and months stop there.
  const early = run(ret, { in152: { priorTax: 3000, quarterly: [1000, 0, 0, 0], paidDate: '02/10/2026' } }).vt.in152!
  assert.deepEqual(early.quarters.map((x) => x.l8b), [0, 40, 40, 26])
  assert.deepEqual(early.quarters.map((x) => x.l12), [0, 8, 5, 1])
  const packet = buildVtPacket(r, res, vt)
  assert.ok(packet.forms.some((f) => f.id === 'vt-in152'))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 VT')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-VT152.pdf`, bytes)
})
