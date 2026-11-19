/**
 * Iowa IA 1040 (2025). Expected values are worked by hand from the 2025 IA 1040 expanded instructions: federal taxable
 * income plus Schedule 1 modifications, 3.8% tax, $40 / $20 / $40 exemption credits, the low-income exemption, the
 * school district surtax, the early childhood development credit and the 15% Iowa EITC.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { IaInput, TaxReturnInput } from './model.ts'
import { computeIowa, iaCarePercent } from './ia2025.ts'
import { buildIaPacket } from '../pdf/ia2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'IA',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1305 E Walnut St', city: 'Des Moines', state: 'IA', zip: '50319', phone: '515-555-0100' },
    ...patch
  }
}
const ia = (ret: TaxReturnInput, x: Partial<IaInput> = {}) => {
  const r = { ...ret, ia: { ...ret.ia, ...x } }
  const res = computeReturn(r)
  return { ia: computeIowa(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '42-1234567', stateId: '123456789', stateIncome: null, stateTax: tax } })

test('IA care credit percentage table', () => {
  assert.equal(iaCarePercent(9999), 0.75)
  assert.equal(iaCarePercent(24999), 0.55)
  assert.equal(iaCarePercent(40000), 0.3)
  assert.equal(iaCarePercent(90000), 0)
})

test('IA single W-2: 3.8% of federal taxable income, exemption credit, school surtax', () => {
  const w = w2(60000)
  const { ia: r } = ia(base({ w2s: [w] }), { w2: withheld(w, 2000), surtaxRate: 8, schoolDistrictNo: '1611' })
  assert.equal(r.lines['2'], 44250)
  assert.equal(r.lines['4'], 44250)
  assert.equal(r.lines['5'], 1682)
  assert.equal(r.lines['8'], 40)
  assert.equal(r.lines['12'], 1642)
  assert.equal(r.lines['19'], 131)
  assert.equal(r.lines['22'], 1773)
  assert.equal(r.lines['32'], 227)
  assert.equal(r.taxReduction, false)
})

test('IA retiree: Social Security and pension subtracted; low-income exemption', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'IPERS', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const { ia: r, res } = ia(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 68, age65OrOlder: true }, retirement: [pension], socialSecurity: [ss] }), { healthInsurance: 2400 })
  assert.equal(r.schedule1.B['7'], 30000)
  assert.equal(r.schedule1.B['5'], Math.round(res.f1040['6b']))
  assert.equal(r.schedule1.lines['15'], 2400)
  assert.equal(r.step3.b, 1)
  assert.equal(r.lowIncomeExempt, true)
  assert.equal(r.lines['22'], 0)
})

test('IA head of household: credits, tuition, early childhood credit and Iowa EITC', () => {
  const w = w2(30000)
  const k1 = kid(4)
  const k2 = kid(8, 'Amy Doe')
  const { ia: r, res } = ia(base({ filingStatus: 'hoh', w2s: [w], dependents: [k1, k2] }), { w2: withheld(w, 300), tuition: { [k2.id]: 3000 }, earlyChildhood: { [k1.id]: 800 } })
  assert.equal(r.lines['4'], 6375)
  assert.equal(r.lines['5'], 242)
  assert.equal(r.lines['8'], 160)
  assert.equal(r.lines['9'], 500)
  assert.equal(r.lines['12'], 0)
  assert.equal(r.lines['22'], 0)
  assert.equal(r.careCredit, 'early')
  assert.equal(r.lines['24'], 200)
  assert.equal(r.lines['25'], Math.round(res.f1040['27a'] * 0.15))
  assert.equal(r.lines['32'], 300 + 200 + r.lines['25'])
})

test('IA 1040: every value lands on one field and the PDF builds', async () => {
  const w = w2(45000)
  const s = w2(20000, 'spouse')
  const k = kid(4)
  const { ia: r, res, ret } = ia(base({ filingStatus: 'mfj', w2s: [w, s], dependents: [k], refundDeposit: { routingNumber: '124000054', accountNumber: '5551212', accountType: 'checking' } }), { w2: { ...withheld(w, 1500), ...withheld(s, 500) }, usObligationInterest: 40, surtaxRate: 3, schoolDistrictNo: '1611', countyNo: '77', birthDate: { taxpayer: '3/4/1985', spouse: '05/06/1986' }, fishWildlife: 5 })
  const packet = buildIaPacket(ret, res, r)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 4, 5])
  assert.equal(packet.forms[0].values['Date of Birth MMDDYYYY'], '03041985')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 IA')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-IA.pdf`, bytes)
})
