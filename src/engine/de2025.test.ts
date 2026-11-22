/**
 * Delaware PIT-RES (2025), worked by hand from the 2025 PIT-RES instructions and the 2025 tax table
 * (revenuefiles.delaware.gov/2025/TY25_taxtable.pdf).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { DeInput, TaxReturnInput } from './model.ts'
import { computeDelaware, deNet, deTax } from './de2025.ts'
import { buildDePacket } from '../pdf/de2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kai Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'DE',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '820 N French St', city: 'Wilmington', state: 'DE', zip: '19801', phone: '302-555-0100' },
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<DeInput> = {}) => {
  const r = { ...ret, de: { ...ret.de, ...x } }
  const res = computeReturn(r)
  return { de: computeDelaware(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '51-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('DE tax table and schedule match the official 2025 table', () => {
  // Rows from TY25_taxtable.pdf.
  const rows: [number, number][] = [[1999, 0], [2000, 1], [2049, 1], [2150, 4], [4950, 65], [5000, 67], [5150, 73], [9950, 260], [10000, 262], [10050, 265],
    [17550, 625], [17650, 629], [19950, 740], [20000, 742], [20150, 750], [24950, 1000], [25000, 1002], [25150, 1011], [59800, 2934], [59950, 2942]]
  for (const [x, t] of rows) assert.equal(deTax(x), t, `tax on ${x}`)
  assert.equal(deTax(60000), 2944) // $2,943.50 rounds up
  assert.equal(deTax(67751), 3455) // the table’s worked example
})

test('DE single W-2: standard deduction and personal credit', () => {
  const w = w2(50000)
  const { de } = run(base({ w2s: [w] }), { w2: withheld(w, 2200) })
  const B = de.B
  assert.equal(de.status, 1)
  assert.equal(B['12'], 50000)
  assert.equal(B['20'], 3250)
  assert.equal(B['23'], 46750)
  assert.equal(B['24'], 2210) // row 46,750–46,800: 1001 + 0.0555 × 21,775 = 2209.51
  assert.equal(B['27a'], 110)
  assert.equal(B['33'], 2100)
  assert.equal(de.lines['47'], 100)
})

test('DE married couple: status 4 beats a joint return when both earn', () => {
  const t = w2(60000)
  const s = w2(40000, 'spouse')
  const { de } = run(base({ filingStatus: 'mfj', w2s: [t, s] }))
  assert.equal(de.status, 4)
  assert.equal(de.A['1'], 40000)
  assert.equal(de.B['1'], 60000)
  assert.equal(de.A['20'], 3250)
  assert.equal(de.B['20'], 3250)
  assert.equal(de.A['24'], deTax(36750))
  assert.equal(de.B['24'], deTax(56750))
  assert.ok(de.alternative && de.alternative.status === 2 && de.alternative.net > deNet(de))
  const joint = run(base({ filingStatus: 'mfj', w2s: [t, s] }), { status: 'joint' }).de
  assert.equal(joint.status, 2)
  assert.equal(joint.B['20'], 6500)
  assert.equal(joint.B['27a'], 220)
  assert.equal(joint.B['24'], deTax(93500))
})

test('DE 60+: pension exclusion with eligible retirement income, SS subtracted, extra credits', () => {
  const p = { ...empty1099R(), payer: 'Pension', grossDistribution: 10000, taxableAmount: 10000 }
  const ss = { ...emptySocialSecurity(), netBenefits: 30000 }
  const r0 = emptyReturn()
  const { de, res } = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 67, age65OrOlder: true }, retirement: [p], socialSecurity: [ss], w2s: [w2(20000)] }))
  assert.equal(de.B['6'], 10000)
  assert.equal(de.B['8a'], Math.round(res.f1040['6b']))
  assert.equal(de.B['21'], 2500)
  assert.equal(de.B['27b'], 110)
  // Under 60: non-military pension is capped at $2,000; a military pension at $12,500.
  const young = run(base({ retirement: [{ ...p, taxableAmount: 15000, grossDistribution: 15000 }] }))
  assert.equal(young.de.B['6'], 2000)
  const mil = run(base({ retirement: [{ ...p, taxableAmount: 15000, grossDistribution: 15000 }] }), { militaryPension: { taxpayer: true, spouse: false } })
  assert.equal(mil.de.B['6'], 12500)
})

test('DE EITC: refundable 4.5% when it beats the tax, otherwise nonrefundable 20%', () => {
  const { de, res } = run(base({ filingStatus: 'hoh', w2s: [w2(18000)], dependents: [kid(5)] }))
  const eic = Math.round(res.f1040['27a'])
  assert.ok(eic > 0)
  assert.equal(de.status, 5)
  const e = de.eitc!
  assert.equal(e.l14, Math.round(eic * 0.045))
  assert.equal(e.l15, Math.round(eic * 0.2))
  if (e.l14 >= e.l12) assert.equal(de.B['34'], e.l14)
  else assert.equal(de.B['34'], Math.min(e.l12, e.l15))
})

test('DE itemized deductions leave out Delaware income tax', () => {
  const w = w2(150000)
  const r0 = emptyReturn()
  const { de } = run(base({ w2s: [w], itemized: { ...r0.itemized, mortgageInterest: 12000, stateLocalIncomeOrSalesTax: 9000, realEstateTax: 3000, charityCash: 2000 } }), { w2: withheld(w, 8000) })
  assert.equal(de.itemize, true)
  assert.equal(de.rsa['5a'], 1000)
  assert.equal(de.rsa['5f'], 4000)
  assert.equal(de.rsa['17a'], 18000)
  assert.equal(de.B['20'], 18000)
})

test('PIT-RES packet: every value lands on one field and the PDF builds', async () => {
  const t = w2(60000)
  const s = w2(40000, 'spouse')
  const r0 = emptyReturn()
  const p = { ...empty1099R('spouse'), payer: 'State Pension', grossDistribution: 5000, taxableAmount: 5000 }
  const { de, res, ret } = run(base({ filingStatus: 'mfj', w2s: [t, s], retirement: [p], dependents: [kid(8)], itemized: { ...r0.itemized, mortgageInterest: 9000, realEstateTax: 2500, charityCash: 1500 },
    refundDeposit: { ...r0.refundDeposit, routingNumber: '031100001', accountNumber: '12340818', accountType: 'checking' } }),
  { w2: { ...withheld(t, 3500), ...withheld(s, 2600) }, r1099: { [p.id]: { ein: '51-7654321', stateId: '', stateIncome: null, stateTax: 150 } }, estimatedPayments: 200,
    tuition529: { taxpayer: 800, spouse: 0 }, contributions: { A: 10, R: 5 }, firefighter: { taxpayer: '17', spouse: '' }, crs: { '17': 2 },
    sCorp: [{ fein: '51-1112223', name: 'Doe Co', owner: 'taxpayer', amount: 300 }], otherState: { state: 'PA', owner: 'taxpayer', income: 20000, tax: 600 }, deduction: 'itemized' })
  const packet = buildDePacket(ret, res, de)
  assert.deepEqual(packet.forms.map((f) => f.id), ['de-res', 'de-rss', 'de-rsa', 'de-crs'])
  assert.equal(packet.forms[0].values.filingStatusRadio, '#2')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 DE')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-DE.pdf`, bytes)
})
