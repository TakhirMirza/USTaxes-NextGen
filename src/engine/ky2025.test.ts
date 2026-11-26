/**
 * Kentucky Form 740 (2025). Expected values are worked by hand from the 2025 Form 740 instructions packet: 4% tax,
 * $3,270 standard deduction (per spouse on a combined return), the $31,110 pension exclusion, the Family Size Tax
 * Credit (the packet's two examples: family of two at $22,650 → 80%; family of four at $33,000 → 90%) and 20% of the
 * federal dependent care credit.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyStudent, emptyW2 } from './model.ts'
import type { KyInput, TaxReturnInput } from './model.ts'
import { computeKentucky, kyFamilyCreditRate } from './ky2025.ts'
import { buildKyPacket } from '../pdf/ky2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'KY',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '501 High St', city: 'Frankfort', state: 'KY', zip: '40601', phone: '502-555-0100' },
    ...patch
  }
}
const ky = (ret: TaxReturnInput, x: Partial<KyInput> = {}) => {
  const r = { ...ret, ky: { ...ret.ky, ...x } }
  const res = computeReturn(r)
  return { ky: computeKentucky(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '61-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('KY Family Size Tax Credit table', () => {
  assert.equal(kyFamilyCreditRate(2, 22650), 0.8)
  assert.equal(kyFamilyCreditRate(4, 33000), 0.9)
  assert.equal(kyFamilyCreditRate(1, 15650), 1)
  assert.equal(kyFamilyCreditRate(4, 42760), 0.1) // $42,760 is the packet's upper limit for a family of four
  assert.equal(kyFamilyCreditRate(4, 42761), 0)
})

test('KY single W-2: 4% after the $3,270 standard deduction', () => {
  const w = w2(50000)
  const { ky: r } = ky(base({ w2s: [w] }), { w2: withheld(w, 1800) })
  assert.equal(r.status, 'single')
  assert.equal(r.colB['11'], 46730)
  assert.equal(r.colB['12'], 1869)
  assert.equal(r.lines['21'], 0)
  assert.equal(r.lines['41'], 1800 - 1869 < 0 ? 0 : 1800 - 1869)
  assert.equal(r.lines['36'], 69)
})

test('KY low income: the Family Size Tax Credit wipes out the tax', () => {
  const { ky: r } = ky(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(5)] }))
  assert.equal(r.status, 'single')
  assert.equal(r.familySize, 2)
  assert.equal(r.lines['19'], 669)
  assert.equal(r.lines['21'], 669)
  assert.equal(r.lines['26'], 0)
})

test('KY retiree: pension exclusion, Social Security and the personal tax credit', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: 40000, taxableAmount: 40000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 20000 }
  const { ky: r, res } = ky(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [pension], socialSecurity: [ss] }))
  assert.equal(r.schM.B['9'], 31110)
  assert.equal(r.schM.B['10'], Math.round(res.f1040['6b']))
  assert.equal(r.colB['9'], 8890)
  assert.equal(r.colB['12'], 225)
  assert.equal(r.colB['17'], 40)
  assert.equal(r.lines['19'], 185)
})

test('KY married, both working: combined return (status 2) with two standard deductions', () => {
  const { ky: r } = ky(base({ filingStatus: 'mfj', w2s: [w2(40000), w2(30000, 'spouse')], dependents: [kid(5)], dependentCare: { expenses: 3000, employerBenefits: 0, providers: [] } }))
  assert.equal(r.status, 'combined')
  assert.equal(r.colA['5'], 30000)
  assert.equal(r.colB['5'], 40000)
  assert.equal(r.colA['12'], 1069)
  assert.equal(r.colB['12'], 1469)
  assert.equal(r.lines['19'], 2538)
  assert.equal(r.lines['24'], 120) // 20% of the $600 federal credit
  const joint = ky(base({ filingStatus: 'mfj', w2s: [w2(40000), w2(30000, 'spouse')] }), { forceJoint: true }).ky
  assert.equal(joint.status, 'joint')
  assert.equal(joint.lines['19'], Math.round((70000 - 3270) * 0.04))
})

test('Form 740: every value lands on one field and the PDF builds', async () => {
  const w = w2(40000)
  const { ky: r, res, ret } = ky(base({ filingStatus: 'mfj', w2s: [w, w2(30000, 'spouse')], dependents: [kid(5)] }), { w2: withheld(w, 2000), usObligationInterest: 100 })
  const packet = buildKyPacket(ret, res, r)
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 KY')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-KY.pdf`, bytes)
})

test('KY schedules: Schedule M, Schedule A and Schedule ITC with Worksheet A', async () => {
  const r0 = emptyReturn()
  const pension = { ...empty1099R('taxpayer'), payer: 'Pension Fund', grossDistribution: 40000, taxableAmount: 40000, code: '7' }
  const { ky: k, res, ret } = ky(base({
    taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 66 }, w2s: [w2(60000)], retirement: [pension],
    itemized: { ...r0.itemized, mortgageInterest: 8000, charityCash: 2000 }
  }), {
    otherAdditions: 100, otherAdditionsText: 'Other', schM: { ...r0.ky.schM, stateRefund: 300 }, schA: { ...r0.ky.schA, gambling: 500 },
    itc: { '7': { taxpayer: 200, spouse: 0 } }, otherState: { state: 'Ohio', owner: 'taxpayer', income: 10000, tax: 600 }, birthDate: { taxpayer: '01/02/1959', spouse: '' }
  })
  assert.equal(k.schM.B['6'], 100); assert.equal(k.schM.B['9'], 31110); assert.equal(k.schM.B['17'], 31410)
  assert.equal(k.colB['9'], 68690)
  assert.equal(k.schA['15'], 10500); assert.ok(k.itemize)
  assert.equal(k.colB['11'], 58190); assert.equal(k.colB['12'], 2328)
  const w = k.wsA!
  assert.equal(w['7'], 48190); assert.equal(w['8'], 1928); assert.equal(w['10'], 400); assert.equal(w['12'], 400)
  assert.equal(k.itc.F['6'], 400); assert.equal(k.itc.F['25'], 600); assert.equal(k.colB['15'], 600)
  assert.equal(k.colB['17'], 40)
  const packet = buildKyPacket(ret, res, k)
  assert.deepEqual(packet.forms.map((f) => f.id).filter((x) => !x.startsWith('st-')), ['ky740', 'ky-schm', 'ky-scha', 'ky-itc'])
  assert.deepEqual(packet.forms[3].pages, [0, 1, 2])
  assert.equal(packet.forms[1].values['SchMWkstColB(d)'], '40000')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 KY')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-KYS.pdf`, bytes)
})

test('KY combined return: Schedule A split between spouses', () => {
  const r0 = emptyReturn()
  const { ky: k } = ky(base({ filingStatus: 'mfj', w2s: [w2(60000), w2(40000, 'spouse')], itemized: { ...r0.itemized, mortgageInterest: 9000 } }))
  assert.equal(k.status, 'combined')
  assert.equal(k.schA['16'], 9000)
  assert.equal(k.schA['17'] + k.schA['18'], 100)
  assert.equal(k.schA['19'] + k.schA['20'], 9000)
  assert.equal(k.colA['10'], k.schA['19'])
})

test('Form 8863-K (25% of the federal credit at Kentucky schools) and Schedule P (government pensions)', async () => {
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const st = { ...emptyStudent(), name: 'Amy Doe', ssn: '222334444', institution: 'University of Kentucky', institutionAddress: 'Lexington, KY', institutionEin: '610600439', qualifiedExpenses: 5000, aotcEligible: true }
  const st2 = { ...emptyStudent(), name: 'Pat Doe', ssn: '123456789', institution: 'Ohio State', qualifiedExpenses: 3000, aotcEligible: false }
  const w = w2(60000)
  const e = ky(base({ w2s: [w], students: [st, st2] }), { w2: withheld(w, 2000), kyStudents: { [st.id]: true } })
  const K = e.ky.k8863!
  assert.equal(K['2'], 2500)
  assert.equal(K['6'], 0)
  assert.equal(K['12'], Math.round(K['11'] * 0.25))
  assert.equal(e.ky.lines['23'], Math.min(K['12'], e.ky.lines['22']))
  const pe = buildKyPacket(e.ret, e.res, e.ky)
  const k8 = pe.forms.find((f) => f.id === 'ky8863k')!.values
  assert.equal(k8['8863KLine1columnf1'], '2500')
  assert.equal(k8['8863KLine17'], String(e.ky.lines['23']))
  assert.ok(!pe.notIncluded.some((n) => n.startsWith('Form 8863-K (')))
  // Schedule P: a state pension from a 1995 retirement is excluded in full; a federal one at 40% exempt; the rest up to $31,110.
  const p1 = { ...empty1099R('taxpayer'), payer: 'KY Retirement Systems', grossDistribution: 40000, taxableAmount: 40000, code: '7' }
  const p2 = { ...empty1099R('taxpayer'), payer: 'OPM', grossDistribution: 20000, taxableAmount: 20000, code: '7' }
  const p3 = { ...empty1099R('taxpayer'), payer: 'IRA Co', grossDistribution: 10000, taxableAmount: 10000, code: '7', ira: true }
  const r = ky(base({ taxpayer: { ...base({}).taxpayer, age: 70 }, retirement: [p1, p2, p3] }), { govPensions: { [p1.id]: { date: '06/30/1995', exemptPercent: 0 }, [p2.id]: { date: '01/31/2010', exemptPercent: 40 } } })
  const P = r.ky.schP!.byOwner.taxpayer
  assert.equal(P.c, 40000 + 8000)
  assert.equal(P.l2, 70000 - 48000)
  assert.equal(P.l3, 22000)
  assert.equal(P.l4, 70000)
  assert.equal(r.ky.schM.B['9'], 70000)
  const pr = buildKyPacket(r.ret, r.res, r.ky)
  const sp = pr.forms.find((f) => f.id === 'kyschp')!.values
  assert.equal(sp['TSchPLine1ColB1'], '40000')
  assert.equal(sp['Text30SchPLine1(b)ExemptPerc1'], '40%')
  assert.equal(sp['Text30SchPLine4B'], '70000')
  assert.ok(!pr.notIncluded.some((n) => n.startsWith('Schedule P, if')))
  for (const packet of [pe, pr]) {
    const problems: FillProblem[] = []
    for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
    assert.deepEqual(problems, [])
  }
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-KY-more.pdf`, (await buildPdf(lib, [...pe.forms, ...pr.forms], load, 'KY')).bytes)
})
