/**
 * 2025 audit sweep: every state with an individual income tax × every filing status × typical returns.
 * Invariants: finite line values, never both an amount owed and a refund, no negative amounts owed or refunded, tax rising
 * with income; every PDF value lands on a field of the official form; the filled return shows the engine's amount
 * owed or refund.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099Div, empty1099Int, empty1099R, emptyBusiness, emptyDependent, emptyRental, emptyReturn, emptySocialSecurity, emptyTransaction, emptyW2 } from './model.ts'
import type { TaxReturnInput } from './model.ts'
import { fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'
import { STATES } from './auditStates.ts'

type Fs = TaxReturnInput['filingStatus']
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', ein: '12-3456789', wages, socialSecurityWages: Math.min(wages, 176100), medicareWages: wages, federalWithholding: Math.round(wages * 0.1), socialSecurityWithheld: Math.min(wages, 176100) * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name: string, ssn: string) => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn, monthsLivedWithYou: 12, childRelationship: true })

export function person(code: string, fs: Fs, patch: Partial<TaxReturnInput> = {}): TaxReturnInput {
  const r = emptyReturn()
  const married = fs === 'mfj' || fs === 'mfs'
  return {
    ...r, filingStatus: fs, residentState: code,
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 45 },
    spouse: married ? { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 44 } : r.spouse,
    contact: { ...r.contact, street: '100 Main St', city: 'Capital City', state: code, zip: '12345', phone: '555-555-0100' },
    ...patch
  }
}

/** Typical returns for one filing status. */
export function scenarios(code: string, fs: Fs): [string, TaxReturnInput][] {
  const married = fs === 'mfj' || fs === 'mfs'
  const needsKid = fs === 'hoh' || fs === 'qss'
  const kids = needsKid ? [kid(8, 'Amy Doe', '111223333')] : []
  const spouseW2 = fs === 'mfj' ? [w2(40000, 'spouse')] : []
  return [
    ['W-2 $55,000', person(code, fs, { w2s: [w2(55000), ...spouseW2], dependents: kids })],
    ['low income with children (credits)', person(code, fs, { w2s: [w2(22000)], dependents: [kid(5, 'Amy Doe', '111223333'), kid(9, 'Ben Doe', '111224444')] })],
    ['family itemizing, interest and dividends', person(code, fs, {
      w2s: [w2(140000), ...spouseW2], dependents: [kid(7, 'Amy Doe', '111223333'), kid(15, 'Ben Doe', '111224444')],
      interest: [{ ...empty1099Int(), payer: 'Bank', interest: 1800 }],
      dividends: [{ ...empty1099Div(), payer: 'Fund', ordinaryDividends: 3000, qualifiedDividends: 2500, capitalGainDistributions: 1200 }],
      itemized: { ...emptyReturn().itemized, mortgageInterest: 22000, realEstateTax: 7000, stateLocalIncomeOrSalesTax: 8000, charityCash: 6000 }
    })],
    ['retirees: Social Security, pension, IRA', person(code, fs, {
      taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true },
      spouse: married ? { ...emptyReturn().spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 68, age65OrOlder: true } : emptyReturn().spouse,
      dependents: kids,
      socialSecurity: [{ ...emptySocialSecurity(), owner: 'taxpayer', netBenefits: 32000 }],
      retirement: [{ ...empty1099R('taxpayer'), payer: 'Pension Plan', grossDistribution: 30000, taxableAmount: 30000, code: '7', federalWithholding: 3000 },
        { ...empty1099R('taxpayer'), payer: 'IRA Co', grossDistribution: 12000, taxableAmount: 12000, code: '7', ira: true }]
    })],
    ['self-employed with rental and capital gains', person(code, fs, {
      dependents: kids,
      businesses: [{ ...emptyBusiness('taxpayer'), name: 'Studio', activity: 'Design', businessCode: '541430', grossReceipts: 90000, expenses: { ...emptyBusiness().expenses, supplies: 6000 } }],
      rentals: [{ ...emptyRental('taxpayer'), address: '5 Oak Ave', rents: 18000, expenses: { ...emptyRental().expenses, mortgageInterest: 6000, taxes: 3000, repairs: 2000 } }],
      capitalTransactions: [{ ...emptyTransaction(), description: '100 XYZ', term: 'long', dateAcquired: '01/02/2020', dateSold: '06/01/2025', proceeds: 30000, costBasis: 10000 }]
    })],
    ['high income with a capital loss', person(code, fs, {
      w2s: [w2(420000), ...spouseW2], dependents: kids,
      capitalTransactions: [{ ...emptyTransaction(), description: '50 ABC', term: 'short', dateAcquired: '01/02/2025', dateSold: '06/01/2025', proceeds: 5000, costBasis: 20000 }]
    })],
    ['no income', person(code, fs, { dependents: kids })]
  ]
}

const STATUSES: Fs[] = ['single', 'mfj', 'mfs', 'hoh', 'qss']

for (const st of STATES) {
  test(`${st.code} 2025: invariants for every filing status and typical return`, () => {
    const problems: string[] = []
    for (const fs of STATUSES) {
      for (const [name, ret] of scenarios(st.code, fs)) {
        const res = computeReturn(ret)
        let x: { lines: Record<string, number> }
        try { x = st.compute(ret, res) } catch (e) { problems.push(`${fs} / ${name}: engine threw ${(e as Error).message}`); continue }
        for (const [k, v] of Object.entries(x.lines)) if (typeof v === 'number' && !Number.isFinite(v)) problems.push(`${fs} / ${name}: line ${k} = ${v}`)
        const owed = x.lines[st.owed] ?? 0, refund = x.lines[st.refund] ?? 0
        if (owed < 0 || refund < 0) problems.push(`${fs} / ${name}: owed ${owed}, refund ${refund} (negative)`)
        if (owed > 0 && refund > 0) problems.push(`${fs} / ${name}: both owed ${owed} and refund ${refund}`)
        try { st.build(ret, res, x) } catch (e) { problems.push(`${fs} / ${name}: PDF packet threw ${(e as Error).message}`) }
      }
      // Tax rises with income (W-2 only, no children, above the credit ranges): owed − refund never falls as wages rise.
      let prev = -Infinity
      for (let wages = 60000; wages <= 400000; wages += 20000) {
        const ret = person(st.code, fs, { w2s: [{ ...w2(wages), federalWithholding: 0 }], dependents: fs === 'hoh' || fs === 'qss' ? [kid(8, 'Amy Doe', '111223333')] : [] })
        const res = computeReturn(ret)
        const x = st.compute(ret, res)
        const net = (x.lines[st.owed] ?? 0) - (x.lines[st.refund] ?? 0)
        if (net < prev - 1) problems.push(`${fs}: tax fell from ${prev} to ${net} when wages rose to ${wages}`)
        prev = net
      }
    }
    assert.deepEqual(problems, [])
  })
}

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const cache = new Map<string, Uint8Array>()
const load = async (file: string): Promise<Uint8Array> => {
  if (!cache.has(file)) cache.set(file, await readFile(new URL(file, formsDir)))
  return cache.get(file)!
}
const digitsOf = (v: unknown): string => String(v ?? '').replace(/[^\d]/g, '')

for (const st of STATES) {
  test(`${st.code} 2025: the filled PDF matches the engine (every value on a field; amount owed or refund shown)`, async () => {
    const problems: string[] = []
    for (const fs of ['single', 'mfj', 'hoh'] as Fs[]) {
      for (const [name, ret] of scenarios(st.code, fs).filter((_, i) => i === 0 || i === 2 || i === 3)) {
        const res = computeReturn(ret)
        const x = st.compute(ret, res)
        const packet = st.build(ret, res, x)
        const fill: FillProblem[] = []
        for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, fill)
        for (const p of fill) problems.push(`${fs} / ${name}: ${p.form} ${p.key}: ${p.problem}`)
        const exact = Math.max(x.lines[st.owed] ?? 0, x.lines[st.refund] ?? 0)
        const amount = Math.round(exact)
        if (amount > 0) {
          // Whole dollars, dollars with "00" cents, or dollars and cents (states that keep cents, e.g. Rhode Island).
          const wants = new Set([String(amount), `${amount}00`, String(Math.floor(exact)), String(Math.round(exact * 100))])
          const hit = (v: unknown): boolean => wants.has(digitsOf(v))
          // Forms with one box per digit (New Jersey): the boxes of a line are written in order, so their joined text holds the amount.
          const boxes = (vals: unknown[]): boolean => vals.filter((v) => typeof v === 'string' && v.length <= 1).join('').includes(`${amount}00`)
          const shown = packet.forms.filter((f) => !f.id.startsWith('st-')).some((f) => Object.values(f.values).some(hit) || boxes(Object.values(f.values)) || (f.draw ?? []).some((d) => hit(d.text)))
          if (!shown) problems.push(`${fs} / ${name}: amount ${amount} (line ${(x.lines[st.owed] ?? 0) > 0 ? st.owed : st.refund}) not found in the filled forms`)
        }
      }
    }
    assert.deepEqual(problems, [])
  })
}
