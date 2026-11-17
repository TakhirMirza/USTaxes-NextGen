/**
 * Oregon Form OR-40 (2025). The engine's tax matches every tax table row quoted from the 2025 OR-40 instructions
 * (38 rows across the table) and both rate charts; other expected values are worked by hand from the instructions,
 * Schedule OR-ASC, Publication OR-17 and the 01-29-2026 errata.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { OrInput, TaxReturnInput } from './model.ts'
import { computeOregon, orFederalTaxLimit, orSavingsRate, orTax, orWfhdcLimit } from './or2025.ts'
import { buildOrPacket } from '../pdf/or2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'OR',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '955 Center St NE', city: 'Salem', state: 'OR', zip: '97301', phone: '503-555-0100' },
    ...patch
  }
}
const or = (ret: TaxReturnInput, x: Partial<OrInput> = {}) => {
  const r = { ...ret, or: { ...ret.or, ...x } }
  const res = computeReturn(r)
  return { or: computeOregon(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '93-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('OR tax table, rate charts and limit tables', () => {
  assert.equal(orTax(35, false), 2)
  assert.equal(orTax(4450, false), 212)
  assert.equal(orTax(4450, true), 211)
  assert.equal(orTax(11150, false), 665)
  assert.equal(orTax(19550, true), 1144)
  assert.equal(orTax(22250, true), 1327)
  assert.equal(orTax(49950, false), 4060)
  assert.equal(orTax(60000, true), 3756 + 875) // the instructions' Chart J example: $3,756 + 8.75% over $50,000
  assert.equal(orTax(125001, false), 10627)
  assert.equal(orFederalTaxLimit(124999, 'single'), 8500)
  assert.equal(orFederalTaxLimit(127000, 'single'), 6800)
  assert.equal(orFederalTaxLimit(285000, 'mfj'), 1700)
  assert.equal(orFederalTaxLimit(132000, 'mfs'), 2550)
  assert.equal(orFederalTaxLimit(145000, 'single'), 0)
  assert.equal(orSavingsRate(72000), 0.25)
  assert.equal(orWfhdcLimit(4), 96450)
  assert.equal(orWfhdcLimit(9), 162450)
})

test('OR single W-2: federal tax subtraction, standard deduction, exemption credit', () => {
  const w = w2(60000)
  const { or: r, res } = or(base({ w2s: [w] }))
  const fedTax = Math.round(res.f1040['22'])
  assert.equal(r.lines['10'], fedTax)
  assert.equal(r.lines['15'], 60000 - fedTax)
  assert.equal(r.lines['17'], 2835)
  assert.equal(r.lines['19'], 60000 - fedTax - 2835)
  assert.equal(r.lines['20'], orTax(r.lines['19'], false))
  assert.equal(r.lines['25'], 256)
  const paid = or(base({ w2s: [w] }), { w2: withheld(w, 3000), kickerLiability2024: 4000 }).or
  assert.equal(paid.lines['32'], 395) // 9.863% of $4,000
  assert.equal(paid.lines['47'], Math.max(0, 3000 + 395 - paid.lines['31']))
})

test('OR family: Oregon Kids Credit and EIC at 12% with a child under 3', () => {
  const { or: r, res } = or(base({ filingStatus: 'mfj', w2s: [w2(25000)], dependents: [kid(2), kid(4, 'Amy Doe')] }))
  assert.equal(r.kidsCredit['4'], 25000 - r.lines['10'])
  assert.equal(r.lines['38'], 2100)
  assert.equal(r.lines['37'], Math.round(res.f1040['27a'] * 0.12))
  assert.equal(r.lines['25'], 4 * 256)
  const phased = or(base({ filingStatus: 'hoh', w2s: [w2(29000)], dependents: [kid(4)] })).or
  const k4 = phased.kidsCredit['4']
  assert.ok(k4 > 26550 && k4 < 31550)
  assert.equal(phased.lines['38'], 1050 - Math.round(1050 * (Math.round(((k4 - 26550) / 5000) * 100) / 100))) // worksheet lines 7–10
})

test('OR retiree: retirement income credit (9%) and the extra standard deduction at 65', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'PERS', grossDistribution: 12000, taxableAmount: 12000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 6000 }
  const { or: r } = or(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [pension], socialSecurity: [ss] }))
  assert.equal(r.lines['7'], 12000)
  assert.equal(r.lines['17'], 2835 + 1200)
  assert.equal(r.lines['19'], 12000 - 4035)
  assert.equal(r.lines['20'], 449)
  assert.equal(r.retirementCredit?.['credit'], 135) // 9% × (7,500 − 6,000)
  assert.equal(r.lines['29'], 449 - 256 - 135)
})

test('OR subtractions and refundable credits: U.S. interest, tips, 529', () => {
  const { or: r } = or(base({ w2s: [w2(60000)] }), { usObligationInterest: 300, collegeSavings: 1000, ableContributions: 100 })
  assert.deepEqual(r.asc.subtractions, [{ code: '315', amount: 300 }])
  assert.deepEqual(r.asc.refundable, [{ code: '896', amount: 180 }, { code: '897', amount: 50 }])
  assert.equal(r.lines['39'], 230)
})

test('OR-40, OR-ASC, OR-A and OR-WFHDC: every value lands on one field and the PDF builds', async () => {
  const w = w2(40000)
  const b0 = emptyReturn()
  const { or: r, res, ret } = or(base({ filingStatus: 'mfj', w2s: [w, w2(12000, 'spouse')], dependents: [kid(2), kid(6, 'Amy Doe')],
    dependentCare: { expenses: 6000, employerBenefits: 0, providers: [{ id: 'p', name: 'Little Firs Daycare', address: '12 Oak St, Salem OR 97302', tin: '931112222', householdEmployee: false, amountPaid: 6000 }] },
    itemized: { ...b0.itemized, mortgageInterest: 9000, realEstateTax: 3500, charityCash: 800 },
    refundDeposit: { routingNumber: '123000220', accountNumber: '5551212', accountType: 'checking' } }),
  { w2: withheld(w, 2000), birthDate: { taxpayer: '01/02/1985', spouse: '03/04/1986' }, dependentBirthDates: {}, usObligationInterest: 50, wfhdcPercent: 0.4, kickerLiability2024: 1500, politicalContributions: 100 })
  assert.equal(r.itemize, true)
  assert.ok((r.wfhdc?.['29'] ?? 0) > 0)
  const packet = buildOrPacket(ret, res, r)
  assert.deepEqual(packet.forms.map((x) => x.id), ['or40', 'orasc', 'ora', 'orwfhdc'])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 OR')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-OR.pdf`, bytes)
})
