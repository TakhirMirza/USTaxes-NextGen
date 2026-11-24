/**
 * New Mexico PIT-1 (2025). Tax table rows checked against the 2025 tax rate tables; returns worked by hand from the 2025
 * PIT-1, PIT-ADJ and PIT-RC instructions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { NmInput, TaxReturnInput } from './model.ts'
import { computeNewMexico, nmChildCreditPerChild, nmDayCareChild, nmLowIncomePropertyPercent, nmLowIncomeRebate, nmLowMiddleExemption, nmMaxPropertyTaxLiability, nmOtherStateCredit, nmSeniorExemption, nmTax } from './nm2025.ts'
import { buildNmPacket } from '../pdf/nm2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'NM',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1100 S St Francis Dr', city: 'Santa Fe', state: 'NM', zip: '87505', phone: '505-555-0100' },
    ...patch
  }
}
const nm = (ret: TaxReturnInput, x: Partial<NmInput> = {}) => {
  const r = { ...ret, nm: { ...ret.nm, ...x } }
  const res = computeReturn(r)
  return { nm: computeNewMexico(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '85-1234567', stateId: '01-123456-00-0', stateIncome: null, stateTax: tax } })

test('NM tax rate table rows and schedule', () => {
  assert.equal(nmTax(59, 'single'), 0)
  assert.equal(nmTax(80, 'mfj'), 1)
  assert.equal(nmTax(150, 'mfs'), 2)
  assert.equal(nmTax(250, 'hoh'), 4)
  assert.equal(nmTax(5550, 'single'), 84)
  assert.equal(nmTax(5550, 'mfs'), 110)
  assert.equal(nmTax(8050, 'single'), 164)
  assert.equal(nmTax(8050, 'mfj'), 122)
  assert.equal(nmTax(16550, 'hoh'), 394)
  assert.equal(nmTax(25050, 'mfs'), 872)
  assert.equal(nmTax(99950, 'single'), 4356)
  assert.equal(nmTax(99950, 'mfj'), 4087)
  assert.equal(nmTax(250000, 'single'), 9746 + 2360)
})

test('NM worksheets and tables', () => {
  assert.equal(nmSeniorExemption(18000, 'single'), 8000)
  assert.equal(nmSeniorExemption(18001, 'single'), 7000)
  assert.equal(nmSeniorExemption(51000, 'mfj'), 1000)
  assert.equal(nmSeniorExemption(51001, 'mfj'), 0)
  assert.equal(nmLowMiddleExemption(50000, 'mfj', 4), 2000)
  assert.equal(nmLowMiddleExemption(36668, 'single', 1), 0)
  assert.equal(nmLowIncomeRebate(9500, 3), 390)
  assert.equal(nmLowIncomeRebate(36001, 3), 0)
  assert.equal(nmChildCreditPerChild(25000), 637)
  assert.equal(nmChildCreditPerChild(400000), 26)
})

test('NM PIT-RC sections 3–5 and the line 20 worksheet', () => {
  assert.equal(nmMaxPropertyTaxLiability(9500), 75)
  assert.equal(nmMaxPropertyTaxLiability(16001), null)
  assert.equal(nmLowIncomePropertyPercent(8000), 0.75)
  assert.equal(nmLowIncomePropertyPercent(17000), 0.5)
  assert.equal(nmLowIncomePropertyPercent(24000), 0.35)
  assert.equal(nmDayCareChild(200, 10), 480)
  assert.equal(nmDayCareChild(100, 7), 280)
  assert.equal(nmDayCareChild(50, 10), 160)
  assert.equal(nmOtherStateCredit(1000, 25000, 600, 10000, 10000), 400)
})

test('NM low-income senior: property tax rebate and the additional county rebate', () => {
  const p = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: 9000, taxableAmount: 9000, code: '7' }
  const { nm: r } = nm(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p] }), { propertyTax: 900, county: 'SF' })
  assert.equal(r.rc['13'], 9000)
  assert.equal(r.rc['17b'], 60)
  assert.equal(r.rc['17c'], 250)
  assert.equal(r.rc['18c'], 350)
  assert.equal(r.rc['13a'], 3)
  assert.equal(r.rc['14'], 431)
  assert.equal(r.rc['26'], 250 + 350 + 431)
})

test('NM single W-2', () => {
  const w = w2(55000)
  const { nm: r } = nm(base({ w2s: [w] }), { w2: withheld(w, 1500) })
  assert.equal(r.lines['12'], 15750)
  assert.equal(r.lines['14'], 0)
  assert.equal(r.lines['17'], 39250)
  assert.equal(r.lines['18'], 1436)
  assert.equal(r.lines['42'], 64)
})

test('NM family: certain dependents, low- and middle-income exemption, Child Income Tax Credit, WFTC', () => {
  const { nm: r, res } = nm(base({ filingStatus: 'mfj', w2s: [w2(50000)], dependents: [kid(3), kid(8, 'Amy Doe')] }))
  assert.equal(r.lines['13'], 4000)
  assert.equal(r.lines['14'], 2000)
  assert.equal(r.lines['17'], 12500)
  assert.equal(r.lines['18'], 266)
  assert.equal(r.rc['25'], 848)
  assert.equal(r.lines['25'], Math.round(Math.round(res.f1040['27a']) * 0.25))
})

test('NM retiree: Social Security exemption and armed forces retirement', () => {
  const p = { ...empty1099R(), id: 'm', owner: 'taxpayer' as const, payer: 'DFAS', grossDistribution: 35000, taxableAmount: 35000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const { nm: r, res } = nm(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }), { retirementKind: { m: 'military' } })
  assert.equal(r.adj['24'], 30000)
  assert.equal(r.adj['25'], Math.round(res.f1040['6b']))
  assert.ok(r.lines['17'] < 5000)
})

test('PIT-1 with PIT-ADJ, PIT-RC and PIT-CR: the PDF builds', async () => {
  const w = w2(22000)
  const k = kid(4)
  const { nm: r, res, ret } = nm(base({ filingStatus: 'mfj', w2s: [w], dependents: [k], refundDeposit: { routingNumber: '107000327', accountNumber: '5551212', accountType: 'checking' } }), { w2: withheld(w, 300), usObligationInterest: 40, dependentBirthDate: { [k.id]: '04/15/2021' }, dayCare: { [k.id]: { days: 200, rate: 10 } }, crCredits: [{ code: 'F01', approval: 'FP-123', applied: 50, refund: 100 }], contributions: { '3': 5 }, party: { taxpayer: '2', spouse: '1' } })
  assert.equal(r.rc['19'], 480)
  assert.equal(r.lines['26'], 100)
  assert.equal(r.lines['40'], 9)
  assert.equal(r.pitd['11'], 4)
  const packet = buildNmPacket(ret, res, r)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 4, 5, 7])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 NM')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-NM.pdf`, bytes)
})

test('PIT-S lists dependents six and up', async () => {
  const kids = Array.from({ length: 7 }, (_, i) => kid(2 + i, `Kid${i + 1} Doe`))
  const { nm: r, res, ret } = nm(base({ filingStatus: 'mfj', w2s: [w2(60000)], dependents: kids }))
  const packet = buildNmPacket(ret, res, r)
  assert.ok(packet.forms[0].pages?.includes(6))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 NM')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-NMS.pdf`, bytes)
})

test('PIT-CR Supplemental lists credits six and up', async () => {
  const crs = Array.from({ length: 8 }, (_, i) => ({ code: i % 2 ? 'A01' : 'F01', approval: `AP-${i + 1}`, applied: 10 * (i + 1), refund: i % 2 ? 0 : 5 }))
  const { nm: r, res, ret } = nm(base({ w2s: [w2(80000)] }), { crCredits: crs })
  assert.equal(r.lines['26'], 20)
  assert.ok(!r.attach.some((x) => x.includes('Supplemental')))
  const packet = buildNmPacket(ret, res, r)
  const sup = packet.forms.find((f) => f.id === 'nm-pitcrs')
  assert.ok(sup)
  assert.ok(sup.draw!.some((d) => d.text === 'AP-6') && sup.draw!.some((d) => d.text === 'AP-8') && !sup.draw!.some((d) => d.text === 'AP-5'))
  assert.ok(sup.draw!.some((d) => d.text === '210.00')) // 60 + 70 + 80
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 NM')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-NMCR.pdf`, bytes)
})

test('PIT-CR Supplemental: a second sheet for credits 31 and up', async () => {
  const crs = Array.from({ length: 33 }, (_, i) => ({ code: 'A01', approval: `AP-${i + 1}`, applied: 1, refund: 0 }))
  const { nm: r, res, ret } = nm(base({ w2s: [w2(80000)] }), { crCredits: crs })
  const packet = buildNmPacket(ret, res, r)
  const ids = packet.forms.map((f) => f.id)
  assert.deepEqual(ids, ['nmpit1', 'nm-pitcrs', 'nm-pitcrs-2'])
  const second = packet.forms.find((f) => f.id === 'nm-pitcrs-2')!
  assert.ok(second.draw!.some((d) => d.text === 'AP-31') && second.draw!.some((d) => d.text === 'AP-33'))
  assert.ok(!r.attach.some((x) => x.includes('31 and up')))
})
