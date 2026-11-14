/**
 * What-if scenarios: a few common changes applied on top of a return, so their effect on the tax
 * can be compared side by side. The return itself is never changed.
 */
import { computeReturn } from './compute.ts'
import type { TaxReturnResult } from './compute.ts'
import { emptyBusiness, emptyTransaction, newId } from './model.ts'
import type { DeductionChoice, Scenario, TaxReturnInput } from './model.ts'

const pos = (n: number): number => Math.max(0, n)

export const emptyScenario = (name = 'Scenario'): Scenario => ({
  id: newId('scn'), name, filingStatus: '', deductionChoice: '', pretax401k: 0, ira: 0, hsa: 0, charity: 0,
  otherIncome: 0, selfEmployment: 0, longTermGain: 0, shortTermGain: 0, extraPayments: 0
})

/** True when the scenario changes nothing. */
export const isEmptyScenario = (s: Scenario): boolean =>
  !s.filingStatus && !s.deductionChoice && [s.pretax401k, s.ira, s.hsa, s.charity, s.otherIncome, s.selfEmployment, s.longTermGain, s.shortTermGain, s.extraPayments].every((n) => !n)

export function applyScenario(base: TaxReturnInput, s: Scenario): TaxReturnInput {
  const ret: TaxReturnInput = structuredClone({ ...base, scenarios: [] })
  if (s.filingStatus) ret.filingStatus = s.filingStatus
  if (s.deductionChoice) ret.deductionChoice = s.deductionChoice as DeductionChoice
  // Pre-tax 401(k) deferral: lowers box 1 wages on the taxpayer's largest W-2; Social Security and Medicare wages stay.
  if (s.pretax401k > 0) {
    const mine = ret.w2s.filter((w) => w.owner === 'taxpayer').sort((a, b) => b.wages - a.wages)[0] ?? ret.w2s[0]
    if (mine) {
      if (!mine.socialSecurityWages) mine.socialSecurityWages = mine.wages
      if (!mine.medicareWages) mine.medicareWages = mine.wages
      mine.wages = pos(mine.wages - s.pretax401k)
    }
  }
  if (s.ira) ret.adjustments.iraDeduction = pos(ret.adjustments.iraDeduction + s.ira)
  if (s.hsa) {
    const h = ret.hsa.taxpayer
    if (h.coverage === 'none') { h.coverage = 'self'; h.monthsCovered = 12 }
    h.personalContributions = pos(h.personalContributions + s.hsa)
  }
  if (s.charity) ret.itemized.charityCash = pos(ret.itemized.charityCash + s.charity)
  if (s.otherIncome) ret.otherIncome += s.otherIncome
  if (s.selfEmployment) {
    const biz = ret.businesses.find((b) => b.owner === 'taxpayer')
    if (biz) biz.grossReceipts += s.selfEmployment
    else ret.businesses.push({ ...emptyBusiness(), name: 'What-if business', activity: 'Services', businessCode: '541990', required1099s: false, grossReceipts: s.selfEmployment })
  }
  const sale = (term: 'short' | 'long', gain: number): void => {
    if (!gain) return
    ret.capitalTransactions.push({ ...emptyTransaction(), description: 'What-if sale', term, dateAcquired: 'VARIOUS', dateSold: '12/31/2025', proceeds: pos(gain), costBasis: pos(-gain) })
  }
  sale('long', s.longTermGain)
  sale('short', s.shortTermGain)
  if (s.extraPayments) {
    const q = ret.payments.estimatedByQuarter
    q[3] = pos(q[3] + s.extraPayments)
    ret.payments.estimatedTaxPayments = q.reduce((a, b) => a + b, 0)
  }
  return ret
}

export interface ScenarioRow {
  totalIncome: number; agi: number; deductions: number; taxableIncome: number
  incomeTax: number; credits: number; otherTaxes: number; totalTax: number
  payments: number; refund: number; owed: number
  /** Total tax over total income. */ effectiveRate: number
  /** Share of the next $1,000 of ordinary income lost to tax, including phase-outs and refundable credits. */ marginalRate: number
}

export function summarize(input: TaxReturnInput, res: TaxReturnResult = computeReturn(input)): ScenarioRow {
  const f = res.f1040
  const bump = computeReturn({ ...input, otherIncome: input.otherIncome + 1000 })
  return {
    totalIncome: f['9'], agi: f['11a'], deductions: f['14'], taxableIncome: f['15'],
    incomeTax: f['18'], credits: f['21'], otherTaxes: f['23'], totalTax: f['24'],
    payments: f['33'], refund: f['34'], owed: f['37'],
    effectiveRate: f['9'] > 0 ? f['24'] / f['9'] : 0,
    marginalRate: ((bump.f1040['24'] - bump.f1040['33']) - (f['24'] - f['33'])) / 1000
  }
}
