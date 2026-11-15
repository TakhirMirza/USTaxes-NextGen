/**
 * District of Columbia Form D-40, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 D-40 Booklet (DC Office of Tax and Revenue): Form D-40, Schedule I, Calculation F,
 * Calculation I (tax rate schedule), the DC EITC worksheet for filers without a qualifying child, and the
 * Schedule H property tax credit worksheet. DC does not follow several 2025 federal changes (higher
 * standard deduction, Schedule 1-A deductions, bonus depreciation), which is why its standard deduction
 * is its own. Amounts are whole dollars.
 */
import type { TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { vaBonusAddition } from './va2025.ts'

export const DC_STANDARD_DEDUCTION = { single: 15000, mfs: 15000, hoh: 22500, mfj: 30000, qss: 30000 } as const
export const DC_ADDITIONAL_STANDARD = { married: 1600, unmarried: 2000 }
export const DC_ITEMIZED_LIMIT = { threshold: 200000, mfsThreshold: 100000, rate: 0.05 }
export const DC_EITC_CHILDLESS = { max: 649, rate: 0.0765, phaseIn: 8484, phaseOutStart: 23288, phaseOutRate: 0.0848, limit: 30941 }
export const DC_PROPERTY_CREDIT = { max: 1425, under70Limit: 66000, over70Limit: 90000, rentShare: 0.2 }
export const DC_COLLEGE_SAVINGS_MAX = 4000
export const DC_CHILD_CARE_RATE = 0.32

/** Calculation I: [rate, over]. */
const RATES: [number, number][] = [[0.04, 0], [0.06, 10000], [0.065, 40000], [0.085, 60000], [0.0925, 250000], [0.0975, 500000], [0.1075, 1000000]]

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

function scheduleTax(income: number): number {
  let tax = 0
  RATES.forEach(([rate, over], i) => {
    const next = RATES[i + 1]?.[1] ?? Infinity
    if (income > over) tax += (Math.min(income, next) - over) * rate
  })
  return tax
}

/** DC tax: the tax tables up to $100,000 ($50 rows, figured at their middle; $0 under $50), Calculation I above. */
export function dcTax(taxable: number): number {
  const t = pos(taxable)
  if (t > 100000) return r(scheduleTax(t))
  if (t < 50) return 0
  const mid = Math.floor(t / 50) * 50 + 25
  return r(scheduleTax(mid))
}

/** D-40 filing status oval: 1 single, 2 MFJ, 3 MFS, 4 dependent, 8 head of household, 9 qualifying widow(er). */
export type DcStatus = 1 | 2 | 3 | 4 | 8 | 9
export function dcStatus(ret: TaxReturnInput): DcStatus {
  if (ret.canBeClaimedAsDependent) return 4
  return ({ single: 1, mfj: 2, mfs: 3, hoh: 8, qss: 9 } as const)[ret.filingStatus]
}

export interface DcResult {
  status: DcStatus
  lines: Record<string, number>
  scheduleI: { additions: Record<string, number>; subtractions: Record<string, number> }
  deduction: { method: 'standard' | 'itemized'; standard: number; additional: number; boxes: { you65: boolean; youBlind: boolean; spouse65: boolean; spouseBlind: boolean }; extraEach: number; itemized: { f: number; limited: number; reduction: number } | null }
  eitc: { children: number; earned: number; federal: number; childless: boolean }
  propertyCredit: { eligible: boolean; base: number; threshold: number; credit: number; reason: string }
  issues: string[]
  attach: string[]
}

const isOlder = (p: TaxReturnInput['taxpayer']): boolean => p.age65OrOlder || p.age >= 65

export function computeDc(ret: TaxReturnInput, res: TaxReturnResult): DcResult {
  const d = ret.dc
  const f = res.f1040
  const status = dcStatus(ret)
  const joint = ret.filingStatus === 'mfj'
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])

  // ── Income information (lines a–d) ──
  L['a'] = r(f['1z'] + res.schedule1.unemployment)
  L['b'] = r(res.schedule1.businessIncome)
  L['c'] = r(f['7a'])
  L['d'] = r(res.schedule1.rentalIncome)
  L['4'] = fagi

  // ── Schedule I, Calculation A (additions) ──
  const additions: Record<string, number> = {}
  additions['3'] = vaBonusAddition(ret)
  additions['7'] = r(pos(d.otherStateBondInterest) + pos(d.otherAdditions))
  additions['9'] = additions['3'] + additions['7']
  L['5'] = 0
  L['6'] = additions['9']
  L['7'] = L['4'] + L['5'] + L['6']

  // ── Subtractions ──
  L['8'] = 0
  L['9'] = r(pos(d.stateRefundInFagi))
  L['10'] = r(f['6b'])
  L['11'] = 0
  L['12'] = r(pos(d.survivorBenefits))
  L['13'] = r(res.schedule1.unemployment)
  const subtractions: Record<string, number> = {}
  subtractions['1'] = r(pos(d.usObligationInterest))
  subtractions['6'] = Math.min(r(pos(d.collegeSavings)), joint ? 2 * DC_COLLEGE_SAVINGS_MAX : DC_COLLEGE_SAVINGS_MAX)
  subtractions['13'] = r(pos(d.otherSubtractions))
  subtractions['16'] = subtractions['1'] + subtractions['6'] + subtractions['13']
  L['14'] = subtractions['16']
  L['15'] = L['8'] + L['9'] + L['10'] + L['11'] + L['12'] + L['13'] + L['14']
  L['16'] = L['7'] - L['15']

  // ── Deduction: the same type as the federal return ──
  const fs = ret.filingStatus
  const unmarried = fs === 'single' || fs === 'hoh' || status === 4
  const extra = unmarried ? DC_ADDITIONAL_STANDARD.unmarried : DC_ADDITIONAL_STANDARD.married
  const boxes = (isOlder(ret.taxpayer) ? 1 : 0) + (ret.taxpayer.blind ? 1 : 0) + (joint ? (isOlder(ret.spouse) ? 1 : 0) + (ret.spouse.blind ? 1 : 0) : 0)
  const standard: number = DC_STANDARD_DEDUCTION[fs]
  const additional = boxes * extra
  let itemized: DcResult['deduction']['itemized'] = null
  let method: 'standard' | 'itemized' = 'standard'
  if (res.deduction.used === 'itemized') {
    method = 'itemized'
    // Calculation F: federal itemized less state and local taxes, plus real estate (no SALT cap) and other taxes.
    const a = r(res.deduction.itemized)
    const b = r(res.scheduleA.taxes)
    const fLine = a - b + r(pos(ret.itemized.realEstateTax)) + 0
    let limited = fLine
    let reduction = 0
    const limit = fs === 'mfs' ? DC_ITEMIZED_LIMIT.mfsThreshold : DC_ITEMIZED_LIMIT.threshold
    if (L['16'] > limit) {
      const g = r(res.scheduleA.medical)
      const h = fLine - g
      reduction = r((L['16'] - limit) * DC_ITEMIZED_LIMIT.rate)
      limited = g + pos(h - reduction)
    }
    itemized = { f: fLine, limited, reduction }
    L['18'] = limited
  } else L['18'] = standard + additional
  L['19'] = L['16'] - L['18']
  L['20'] = dcTax(L['19'])

  // ── Credits ──
  const careTentative = res.form2441.expensesUsed > 0 ? r(res.form2441.expensesUsed * res.form2441.rate) : 0
  L['21care'] = careTentative
  L['21'] = r(careTentative * DC_CHILD_CARE_RATE)
  L['22'] = r(pos(d.nonrefundableCredits))
  L['23'] = L['21'] + L['22']
  L['24'] = pos(L['20'] - L['23'])
  L['25'] = d.fullYearCoverage ? 0 : r(pos(d.hsrPayment))
  L['26'] = L['24'] + L['25']

  // DC EITC: 100% of the federal credit with a qualifying child; its own worksheet without one.
  const children = res.eic.qualifyingChildren
  const earned = r(res.eic.earnedIncome)
  const fedEic = r(res.eic.credit)
  L['27a'] = children
  L['27b'] = earned
  L['27c'] = children > 0 ? fedEic : 0
  L['27d'] = children > 0 ? fedEic : 0
  let childless = 0
  const e = DC_EITC_CHILDLESS
  if (children === 0 && earned > 0 && status !== 4 && earned <= e.limit && fagi <= e.limit && res.eic.investmentIncome <= 11950) {
    const tentative = earned < e.phaseIn ? earned * e.rate : e.max
    const higher = Math.max(earned, fagi)
    childless = higher < e.phaseOutStart ? tentative : pos(tentative - (higher - e.phaseOutStart) * e.phaseOutRate)
  }
  L['27e'] = r(childless)

  // Schedule H property tax credit (renters: 20% of rent counts as property tax).
  const older70 = ret.taxpayer.age >= 70 || (joint && ret.spouse.age >= 70)
  const base = d.housing === 'rent' ? r(pos(d.housingAmount) * DC_PROPERTY_CREDIT.rentShare) : d.housing === 'own' ? r(pos(d.housingAmount)) : 0
  const pct = older70 ? 0.03 : fagi < 25000 ? 0.03 : fagi < 52000 ? 0.04 : 0.05
  const limit = older70 ? DC_PROPERTY_CREDIT.over70Limit : DC_PROPERTY_CREDIT.under70Limit
  let reason = ''
  if (d.housing === 'none') reason = 'No rent or property tax entered.'
  else if (status === 4) reason = 'Not available to someone who can be claimed as a dependent.'
  else if (fagi > limit) reason = `Federal AGI is over the ${limit.toLocaleString('en-US')} limit.`
  const eligible = !reason && base > 0
  const threshold = r(pos(fagi) * pct)
  const credit = eligible ? Math.min(DC_PROPERTY_CREDIT.max, pos(base - threshold)) : 0
  L['28'] = credit
  L['29'] = r(pos(d.refundableCredits))
  L['30'] = L['27d'] + L['27e'] + L['28'] + L['29']

  // ── Payments ──
  L['31'] = r(pos(d.withholding))
  L['32'] = r(pos(d.estimatedPayments))
  L['33'] = r(pos(d.extensionPayments))
  L['36'] = L['30'] + L['31'] + L['32'] + L['33']
  L['37'] = pos(L['26'] - L['36'])
  L['38'] = pos(L['36'] - L['26'])
  L['39'] = Math.min(r(pos(d.creditForward)), L['38'])
  L['40'] = 0
  L['41'] = Math.min(r(pos(d.contribution)), pos(L['38'] - L['39']))
  L['42'] = L['37'] + L['40'] + L['41'] * (L['37'] > 0 ? 1 : 0)
  L['43'] = pos(L['38'] - L['39'] - L['40'] - L['41'])

  // ── Notes ──
  if (L['22'] > 0 || L['29'] > 0) attach.push('Schedule U (other credits)')
  if (!d.fullYearCoverage) attach.push('Schedule HSR (health care shared responsibility payment)')
  if (additions['3'] > 0) issues.push(`DC does not allow federal bonus depreciation: ${additions['3'].toLocaleString('en-US')} is added back (Schedule I, Calculation A, line 3).`)
  if (method === 'itemized') issues.push(`You itemized federally, so DC uses itemized deductions too: federal itemized less state and local taxes, with your full real estate tax added back${itemized?.reduction ? `, reduced by ${itemized.reduction.toLocaleString('en-US')} for DC AGI over the threshold` : ''}.`)
  if (res.schedule1A && (res.schedule1A.tips > 0 || res.schedule1A.overtime > 0)) issues.push('DC does not allow the federal deductions for tips, overtime, car loan interest or seniors; they never reach DC AGI, so nothing changes here.')
  if (L['27e'] === 0 && children === 0 && earned > 0 && earned <= e.limit && fagi <= e.limit && status !== 4) issues.push('Without a qualifying child, the DC EITC comes from the DC worksheet; check that you meet the federal rules other than age.')
  if (d.housing === 'rent' && eligible && !d.landlord.name.trim()) issues.push('Schedule H asks for your landlord’s name, address and phone number.')
  if (d.housing === 'own' && eligible && !d.ssl.square.trim()) issues.push('Schedule H asks for the square, suffix and lot from your real property tax bill.')
  if (ret.dependents.some((x) => !d.dependentBirthDates[x.id])) issues.push('Schedule S asks for each dependent’s date of birth.')
  if (d.housing !== 'none' && !eligible && reason) issues.push(`Property tax credit: ${reason}`)
  if (L['37'] > 0 && L['32'] === 0 && L['37'] > 100) issues.push('If you owe more than $100, DC may charge underpayment interest (Form D-2210); OTR figures it if you leave it blank.')
  return {
    status, lines: L, scheduleI: { additions, subtractions },
    deduction: { method, standard, additional, boxes: { you65: isOlder(ret.taxpayer), youBlind: ret.taxpayer.blind, spouse65: joint && isOlder(ret.spouse), spouseBlind: joint && ret.spouse.blind }, extraEach: extra, itemized },
    eitc: { children, earned, federal: fedEic, childless: children === 0 },
    propertyCredit: { eligible, base, threshold, credit, reason },
    issues, attach
  }
}
