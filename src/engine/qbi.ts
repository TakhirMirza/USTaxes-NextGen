/**
 * Qualified business income deduction (section 199A), tax year 2025.
 *
 * Below the threshold the simplified Form 8995 applies. Above it, Form 8995-A applies the
 * W-2 wage / UBIA limit per business, the Part III phase-in, and the Schedule A rules for
 * specified service trades or businesses (SSTB). Losses from one business (and a loss carried
 * from 2024) reduce the others in proportion to their income, as in Schedule C (Form 8995-A).
 */
import * as R from './rules2025.ts'
import type { FilingStatus } from './rules2025.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

export interface QbiBusinessInput {
  id: string; name: string; tin: string; sstb: boolean
  /** Net profit less the business's share of deductible SE tax, SE health insurance, etc. */
  qbi: number
  w2Wages: number; ubia: number
}

export interface QbiBusinessResult {
  id: string; name: string; tin: string; sstb: boolean
  /** Schedule A applicable percentage for an SSTB inside the phase-in range (1 otherwise). */
  applicablePct: number
  excluded: boolean
  /** QBI before netting losses (after the SSTB percentage). */ qbiBeforeNetting: number
  line2: number; line3: number; line4: number; line5: number; line6: number; line7: number; line8: number
  line9: number; line10: number; line11: number; line12: number; line13: number; line15: number
  /** Part III, when the phase-in applies. */
  phase: { line17: number; line18: number; line19: number; line25: number; line26: number } | null
}

export interface QbiResult {
  form: 'none' | '8995' | '8995a'
  threshold: number; phaseInRange: number
  taxableIncomeBeforeQbi: number; netCapitalGain: number
  businesses: QbiBusinessResult[]
  /** Form 8995 line 2 / total QBI after netting (may be negative). */ totalQbi: number
  priorLoss: number
  /** Line 16 of 8995-A or line 4 of 8995 (× 20% already applied on 8995-A). */
  qbiComponent: number
  reitPtp: number; priorReitLoss: number; reitComponent: number
  beforeIncomeLimit: number; incomeLimit: number
  deduction: number
  /** Losses carried to 2026 (positive numbers). */ lossCarryforward: number; reitLossCarryforward: number
  /** 8995-A Part III numbers shared by every business. */
  phaseIn: { line20: number; line21: number; line22: number; line23: number; pct: number } | null
}

export function qbiDeduction(args: {
  fs: FilingStatus; taxableIncomeBeforeQbi: number; netCapitalGain: number
  businesses: QbiBusinessInput[]; priorLoss: number; reitPtp: number; priorReitLoss: number
}): QbiResult {
  const { fs, taxableIncomeBeforeQbi: ti, netCapitalGain } = args
  const threshold = R.QBI_SIMPLE_THRESHOLD[fs]
  const range = R.QBI_PHASE_IN_RANGE[fs]
  const priorLoss = pos(args.priorLoss)
  const priorReitLoss = pos(args.priorReitLoss)
  const reitPtp = r(args.reitPtp)
  const above = ti > threshold
  const overRange = ti >= threshold + range
  const phasePct = above && !overRange ? (ti - threshold) / range : above ? 1 : 0
  const anyQbi = args.businesses.some((b) => b.qbi !== 0) || priorLoss > 0
  if (!anyQbi && reitPtp === 0 && priorReitLoss === 0) {
    return {
      form: 'none', threshold, phaseInRange: range, taxableIncomeBeforeQbi: ti, netCapitalGain, businesses: [], totalQbi: 0,
      priorLoss: 0, qbiComponent: 0, reitPtp: 0, priorReitLoss: 0, reitComponent: 0, beforeIncomeLimit: 0, incomeLimit: 0,
      deduction: 0, lossCarryforward: 0, reitLossCarryforward: 0, phaseIn: null
    }
  }

  // SSTB rules (Schedule A): fully excluded over the range, scaled down inside it.
  const scaled = args.businesses.filter((b) => b.qbi !== 0).map((b) => {
    const applicablePct = b.sstb && above ? (overRange ? 0 : 1 - phasePct) : 1
    return { ...b, applicablePct, excluded: applicablePct === 0, qbi: r(b.qbi * applicablePct), w2Wages: r(b.w2Wages * applicablePct), ubia: r(b.ubia * applicablePct) }
  })
  const counted = scaled.filter((b) => !b.excluded)
  const totalQbi = r(sum(counted.map((b) => b.qbi)))
  const net = totalQbi - priorLoss
  const lossCarryforward = net < 0 ? r(-net) : 0

  // REIT dividends and PTP income.
  const reitNet = reitPtp - priorReitLoss
  const reitComponent = r(pos(reitNet) * R.QBI_RATE)
  const reitLossCarryforward = reitNet < 0 ? r(-reitNet) : 0
  const incomeBase = pos(ti - netCapitalGain)
  const incomeLimit = r(incomeBase * R.QBI_RATE)

  if (!above) {
    const qbiComponent = r(pos(net) * R.QBI_RATE)
    const beforeIncomeLimit = qbiComponent + reitComponent
    const businesses = scaled.map((b) => blankBusiness(b, b.qbi))
    return {
      form: '8995', threshold, phaseInRange: range, taxableIncomeBeforeQbi: ti, netCapitalGain, businesses, totalQbi, priorLoss,
      qbiComponent, reitPtp, priorReitLoss, reitComponent, beforeIncomeLimit, incomeLimit,
      deduction: Math.min(beforeIncomeLimit, incomeLimit), lossCarryforward, reitLossCarryforward, phaseIn: null
    }
  }

  // Net losses (including the 2024 carryforward) against businesses with income, pro rata.
  const positives = counted.filter((b) => b.qbi > 0)
  const posTotal = sum(positives.map((b) => b.qbi))
  const negTotal = -sum(counted.filter((b) => b.qbi < 0).map((b) => b.qbi)) + priorLoss
  const afterNetting = (b: typeof scaled[number]): number => {
    if (b.excluded || b.qbi <= 0) return 0
    if (negTotal >= posTotal) return 0
    return r(b.qbi - (negTotal * b.qbi) / posTotal)
  }

  const businesses: QbiBusinessResult[] = scaled.map((b) => {
    const line2 = afterNetting(b)
    const line3 = r(line2 * R.QBI_RATE)
    const line4 = b.excluded ? 0 : b.w2Wages
    const line5 = r(line4 * 0.5)
    const line6 = r(line4 * 0.25)
    const line7 = b.excluded ? 0 : b.ubia
    const line8 = r(line7 * 0.025)
    const line9 = line6 + line8
    const line10 = Math.max(line5, line9)
    const line11 = Math.min(line3, line10)
    let line12 = 0
    let phase: QbiBusinessResult['phase'] = null
    if (!overRange && line10 < line3) {
      const line19 = line3 - line10
      const line25 = r(line19 * phasePct)
      const line26 = line3 - line25
      phase = { line17: line3, line18: line10, line19, line25, line26 }
      line12 = line26
    }
    const line13 = Math.max(line11, line12)
    return {
      id: b.id, name: b.name, tin: b.tin, sstb: b.sstb, applicablePct: b.applicablePct, excluded: b.excluded, qbiBeforeNetting: b.qbi,
      line2, line3, line4, line5, line6, line7, line8, line9, line10, line11, line12, line13, line15: line13, phase
    }
  })
  const qbiComponent = sum(businesses.map((b) => b.line15))
  const beforeIncomeLimit = qbiComponent + reitComponent
  return {
    form: '8995a', threshold, phaseInRange: range, taxableIncomeBeforeQbi: ti, netCapitalGain, businesses, totalQbi, priorLoss,
    qbiComponent, reitPtp, priorReitLoss, reitComponent, beforeIncomeLimit, incomeLimit,
    deduction: Math.min(beforeIncomeLimit, incomeLimit), lossCarryforward, reitLossCarryforward,
    phaseIn: overRange ? null : { line20: ti, line21: threshold, line22: ti - threshold, line23: range, pct: phasePct }
  }
}

function blankBusiness(b: QbiBusinessInput & { applicablePct: number; excluded: boolean }, line2: number): QbiBusinessResult {
  return {
    id: b.id, name: b.name, tin: b.tin, sstb: b.sstb, applicablePct: b.applicablePct, excluded: b.excluded, qbiBeforeNetting: b.qbi,
    line2, line3: r(line2 * R.QBI_RATE), line4: 0, line5: 0, line6: 0, line7: 0, line8: 0, line9: 0, line10: 0, line11: 0, line12: 0,
    line13: 0, line15: 0, phase: null
  }
}
