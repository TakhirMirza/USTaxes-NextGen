/**
 * Arkansas AR1000F (2025). Table rows checked against the 2025 AR1000F/AR1000NR instructions; returns worked by hand.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { ArInput, TaxReturnInput } from './model.ts'
import { arAdditionalCredit, arLowTax, arRegularTax, computeArkansas } from './ar2025.ts'
import { buildArPacket } from '../pdf/ar2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'AR',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1816 W 7th St', city: 'Little Rock', state: 'AR', zip: '72201', phone: '501-555-0100' },
    ...patch
  }
}
const ar = (ret: TaxReturnInput, x: Partial<ArInput> = {}) => {
  const r = { ...ret, ar: { ...ret.ar, ...x } }
  const res = computeReturn(r)
  return { ar: computeArkansas(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '71-1234567', stateId: '123456789', stateIncome: null, stateTax: tax } })

test('AR tax tables match the 2025 booklet', () => {
  assert.equal(arRegularTax(5099), 0)
  assert.equal(arRegularTax(5650), 1)
  assert.equal(arRegularTax(10000), 89)
  assert.equal(arRegularTax(13550), 183)
  assert.equal(arRegularTax(21450), 441)
  assert.equal(arRegularTax(47530), 1434)
  assert.equal(arRegularTax(74950), 2503)
  assert.equal(arRegularTax(75050), 2507)
  assert.equal(arRegularTax(94750), 3296)
  assert.equal(arRegularTax(100000), 3809)
  assert.equal(arRegularTax(120000), 3809 + 780)
  assert.equal(arLowTax('single', 14643), 0)
  assert.equal(arLowTax('single', 16000), 117)
  assert.equal(arLowTax('single', 17501), null)
  assert.equal(arLowTax('mfj2', 36100), 790)
  assert.equal(arAdditionalCredit(26500), 60)
  assert.equal(arAdditionalCredit(26550), 55)
  assert.equal(arAdditionalCredit(27600), 5)
  assert.equal(arAdditionalCredit(27601), 0)
})

test('AR single W-2: standard deduction and regular table', () => {
  const w = w2(50000)
  const { ar: r } = ar(base({ w2s: [w] }), { w2: withheld(w, 1500) })
  assert.equal(r.lines['25'], 50000)
  assert.equal(r.lines['27'], 2470)
  assert.equal(r.lines['28'], 47530)
  assert.equal(r.lines['29'], 1434)
  assert.equal(r.lines['34'], 29)
  assert.equal(r.lines['38'], 1405)
  assert.equal(r.lines['50'], 95)
})

test('AR low income table and the additional credit for qualified individuals', () => {
  const { ar: r } = ar(base({ w2s: [w2(16000)] }))
  assert.equal(r.table, 'low')
  assert.equal(r.lines['27'], 0)
  assert.equal(r.lines['29'], 117)
  assert.equal(r.lines['36'], 60)
  assert.equal(r.lines['38'], 117 - 29 - 60)
})

test('AR retiree: $6,000 pension exemption, Social Security exempt, 65 box', () => {
  const p = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'APERS', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const { ar: r } = ar(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 68, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }))
  assert.equal(r.lines['18A'], 24000)
  assert.equal(r.lines['25'], 24000)
  assert.equal(r.boxes.taxpayer.special, false)
  assert.equal(r.lines['7A'], 58)
  const mil = { ...p, id: 'm', payer: 'DFAS' }
  const m = ar(base({ retirement: [mil] }), { retirementKind: { m: 'military' } }).ar
  assert.equal(m.militaryRetirement.taxpayer, 30000)
  assert.equal(m.lines['25'], 0)
})

test('AR1000F: every value lands on one field and the PDF builds', async () => {
  const w = w2(45000)
  const s = w2(20000, 'spouse')
  const { ar: r, res, ret } = ar(base({ filingStatus: 'mfj', w2s: [w, s], dependents: [kid(4)], refundDeposit: { routingNumber: '082000073', accountNumber: '5551212', accountType: 'checking' } }), { w2: { ...withheld(w, 1500), ...withheld(s, 600) }, usObligationInterest: 40 })
  const packet = buildArPacket(ret, res, r)
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 AR')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-AR.pdf`, bytes)
})
