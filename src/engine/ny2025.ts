/**
 * New York Form IT-201, full-year resident income tax return, tax year 2025 — New York State, New York
 * City and Yonkers.
 *
 * Source: 2025 IT-201-I (NYS and NYC tax rate schedules, tax computation worksheets 1–16 for New York AGI
 * over $107,650, standard deduction table, household credit tables 1–6, NYC school tax credit, Yonkers
 * worksheet, sales and use tax chart), Form IT-213 (Empire State child credit), Form IT-215 and its
 * instructions (NYS EIC, NYC EIC rate worksheet). The NYS and NYC tax tables (taxable income under
 * $65,000) figure the tax at the middle of each row: $0–$13, $13–$25, $25–$50, $50–$100, then $50 rows.
 * Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { careQualifyingPerson } from './compute.ts'

export const NY_STANDARD_DEDUCTION = { single: 8000, mfs: 8000, mfj: 16050, hoh: 11200, qss: 16050, dependent: 3100 } as const
export const NY_DEPENDENT_EXEMPTION = 1000
export const NY_PENSION_EXCLUSION = 20000
export const NY_529_MAX = { single: 5000, joint: 10000 }
export const NY_EIC_RATE = 0.3
export const NY_EIC_INVESTMENT_LIMIT = 11950
export const NY_YONKERS_RATE = 0.1675
export const NY_ESCC = { under4: 1000, age4to16: 330, threshold: { mfj: 110000, single: 75000, hoh: 75000, qss: 75000, mfs: 55000 }, rate: 0.0165 }

type Bracket = [over: number, base: number, rate: number]
type Sched = 'mfj' | 'single' | 'hoh'
const NYS: Record<Sched, Bracket[]> = {
  mfj: [[0, 0, 0.04], [17150, 686, 0.045], [23600, 976, 0.0525], [27900, 1202, 0.055], [161550, 8553, 0.06], [323200, 18252, 0.0685], [2155350, 143754, 0.0965], [5000000, 418263, 0.103], [25000000, 2478263, 0.109]],
  single: [[0, 0, 0.04], [8500, 340, 0.045], [11700, 484, 0.0525], [13900, 600, 0.055], [80650, 4271, 0.06], [215400, 12356, 0.0685], [1077550, 71413, 0.0965], [5000000, 449929, 0.103], [25000000, 2509929, 0.109]],
  hoh: [[0, 0, 0.04], [12800, 512, 0.045], [17650, 730, 0.0525], [20900, 901, 0.055], [107650, 5672, 0.06], [269300, 15371, 0.0685], [1616450, 107651, 0.0965], [5000000, 434163, 0.103], [25000000, 2494163, 0.109]]
}
const NYC: Record<Sched, Bracket[]> = {
  mfj: [[0, 0, 0.03078], [21600, 665, 0.03762], [45000, 1545, 0.03819], [90000, 3264, 0.03876]],
  single: [[0, 0, 0.03078], [12000, 369, 0.03762], [25000, 858, 0.03819], [50000, 1813, 0.03876]],
  hoh: [[0, 0, 0.03078], [14400, 443, 0.03762], [30000, 1030, 0.03819], [60000, 2176, 0.03876]]
}
/** Tax computation worksheets for New York AGI over $107,650: [flat rate, flat-rate ceiling, steps: [taxable over, recapture base, incremental benefit]]. */
const RECAPTURE: Record<Sched, { flatRate: number; flatTop: number; steps: [over: number, base: number, benefit: number][] }> = {
  mfj: { flatRate: 0.055, flatTop: 161550, steps: [[161550, 333, 807], [323200, 1140, 2747], [2155350, 3887, 60350], [5000000, 64237, 32500]] },
  single: { flatRate: 0.06, flatTop: 215400, steps: [[215400, 568, 1831], [1077550, 2399, 30172], [5000000, 32571, 32500]] },
  hoh: { flatRate: 0.06, flatTop: 269300, steps: [[269300, 787, 2289], [1616450, 3076, 45261], [5000000, 48337, 32500]] }
}

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const round4 = (n: number): number => Math.round(n * 10000) / 10000
const sched = (fs: TaxReturnInput['filingStatus']): Sched => (fs === 'mfj' || fs === 'qss' ? 'mfj' : fs === 'hoh' ? 'hoh' : 'single')

function schedule(table: Bracket[], income: number): number {
  let row = table[0]
  for (const b of table) if (income > b[0]) row = b
  return row[1] + (income - row[0]) * row[2]
}
/** Middle of the tax-table row that contains `t` (rows: $0–13, 13–25, 25–50, 50–100, then $50 wide). */
export function tableMiddle(t: number): number {
  if (t < 13) return 6.5
  if (t < 25) return 19
  if (t < 50) return 37.5
  if (t < 100) return 75
  return Math.floor(t / 50) * 50 + 25
}

/** Line 39: NYS tax — tax table under $65,000, rate schedule, or the tax computation worksheets when NYAGI is over $107,650. */
export function nysTax(taxable: number, nyagi: number, fs: TaxReturnInput['filingStatus']): number {
  const t = pos(r(taxable))
  const s = sched(fs)
  if (t <= 0) return 0
  if (nyagi <= 107650) return t < 65000 ? r(schedule(NYS[s], tableMiddle(t))) : r(schedule(NYS[s], t))
  if (nyagi > 25000000) return r(t * 0.109)
  const w = RECAPTURE[s]
  if (t <= w.flatTop) {
    const flat = t * w.flatRate
    if (nyagi >= 157650) return r(flat)
    const tax = schedule(NYS[s], t)
    return r(tax + (flat - tax) * round4((nyagi - 107650) / 50000))
  }
  let step = w.steps[0]
  for (const st of w.steps) if (t > st[0]) step = st
  const ratio = round4(Math.min(pos(nyagi - step[0]), 50000) / 50000)
  return r(r(schedule(NYS[s], t)) + step[1] + step[2] * ratio)
}

/** Line 47a: NYC resident tax — NYC tax table under $65,000, rate schedule above. */
export function nycTax(taxable: number, fs: TaxReturnInput['filingStatus']): number {
  const t = pos(r(taxable))
  if (t <= 0) return 0
  const s = sched(fs)
  return r(schedule(NYC[s], t < 65000 ? tableMiddle(t) : t))
}

type Household = { limits: number[]; perPerson: number[][]; over7: number[] }
/** NYS household credit tables 2 and 3 (amount by number of people 1–7, plus the "over 7" step). */
const NYS_HH: Record<'joint' | 'mfs', Household> = {
  joint: {
    limits: [5000, 6000, 7000, 20000, 22000, 25000, 28000, 32000],
    perPerson: [[90, 105, 120, 135, 150, 165, 180], [75, 90, 105, 120, 135, 150, 165], [65, 80, 95, 110, 125, 140, 155], [60, 75, 90, 105, 120, 135, 150], [60, 70, 80, 90, 100, 110, 120], [50, 60, 70, 80, 90, 100, 110], [40, 45, 50, 55, 60, 65, 70], [20, 25, 30, 35, 40, 45, 50]],
    over7: [15, 15, 15, 15, 10, 10, 5, 5]
  },
  mfs: {
    limits: [5000, 6000, 7000, 20000, 22000, 25000, 28000, 32000],
    perPerson: [[45, 53, 60, 68, 75, 83, 90], [38, 45, 53, 60, 68, 75, 83], [33, 40, 48, 55, 63, 70, 78], [30, 38, 45, 53, 60, 68, 75], [30, 35, 40, 45, 50, 55, 60], [25, 30, 35, 40, 45, 50, 55], [20, 23, 25, 28, 30, 33, 35], [10, 13, 15, 18, 20, 23, 25]],
    over7: [8, 8, 8, 8, 5, 5, 3, 3]
  }
}
const NYS_HH_SINGLE: [limit: number, credit: number][] = [[5000, 75], [6000, 60], [7000, 50], [20000, 45], [25000, 40], [28000, 20]]
const NYC_HH: Record<'joint' | 'mfs', Household> = {
  joint: { limits: [15000, 17500, 20000, 22500], perPerson: [[30, 60, 90, 120, 150, 180, 210], [25, 50, 75, 100, 125, 150, 175], [15, 30, 45, 60, 75, 90, 105], [10, 20, 30, 40, 50, 60, 70]], over7: [30, 25, 15, 10] },
  mfs: { limits: [15000, 17500, 20000, 22500], perPerson: [[15, 30, 45, 60, 75, 90, 105], [13, 25, 38, 50, 63, 75, 88], [8, 15, 23, 30, 38, 45, 53], [5, 10, 15, 20, 25, 30, 35]], over7: [15, 13, 8, 5] }
}
const NYC_HH_SINGLE: [limit: number, credit: number][] = [[10000, 15], [12500, 10]]

function householdCredit(single: [number, number][], table: Record<'joint' | 'mfs', Household>, fs: TaxReturnInput['filingStatus'], fagi: number, people: number): number {
  if (fs === 'single') return single.find(([lim]) => fagi <= lim)?.[1] ?? 0
  const t = table[fs === 'mfs' ? 'mfs' : 'joint']
  const i = t.limits.findIndex((lim) => fagi <= lim)
  if (i < 0) return 0
  const n = Math.max(1, people)
  return n <= 7 ? t.perPerson[i][n - 1] : t.perPerson[i][6] + (n - 7) * t.over7[i]
}

/** NYC EIC rate worksheet (IT-215 instructions): the share of the federal EIC, by New York AGI. */
export function nycEicRate(nyagi: number): number {
  const phase = (start: number, rate: number): number => round4(rate - round4((nyagi - start) * 0.00002))
  if (nyagi < 5000) return 0.3
  if (nyagi < 7500) return phase(4999, 0.3)
  if (nyagi < 15000) return 0.25
  if (nyagi < 17500) return phase(14999, 0.25)
  if (nyagi < 20000) return 0.2
  if (nyagi < 22500) return phase(19999, 0.2)
  if (nyagi < 40000) return 0.15
  if (nyagi < 42500) return phase(39999, 0.15)
  return 0.1
}

/** Sales and use tax chart (line 59), by federal AGI. */
export function salesTaxChart(fagi: number): number {
  if (fagi <= 15000) return 3
  if (fagi <= 30000) return 6
  if (fagi <= 50000) return 10
  if (fagi <= 75000) return 15
  if (fagi <= 100000) return 18
  if (fagi <= 150000) return 26
  if (fagi <= 200000) return 34
  return Math.min(125, r(fagi * 0.000175))
}

/** IT-216 line 10: decimal by federal AGI. */
export function nyCareDecimal(fagi: number): number {
  if (fagi <= 15000) return 0.35
  return Math.max(0.2, Math.round((0.35 - Math.ceil((fagi - 15000) / 2000) * 0.01) * 100) / 100)
}
const CARE_25_40 = [1.099, 1.098, 1.097, 1.095, 1.094, 1.093, 1.091, 1.09, 1.089, 1.087, 1.086, 1.085, 1.083, 1.082, 1.081, 1.079, 1.078, 1.077, 1.075, 1.074, 1.073, 1.071, 1.07, 1.069, 1.067, 1.066, 1.065, 1.063, 1.062, 1.061, 1.059, 1.058, 1.057, 1.055, 1.054, 1.053, 1.051, 1.05, 1.049, 1.047, 1.046, 1.045, 1.043, 1.042, 1.041, 1.039, 1.038, 1.037, 1.035, 1.034, 1.033, 1.031, 1.03, 1.029, 1.027, 1.026, 1.025, 1.023, 1.022, 1.021, 1.019, 1.018, 1.017, 1.015, 1.014, 1.013, 1.011, 1.01, 1.009, 1.007, 1.006, 1.005, 1.003, 1.002, 1.001]
const CARE_50_65 = [1.162, 1.15, 1.137, 1.125, 1.112, 1.099, 1.088, 1.075, 1.062, 1.05, 1.037, 1.025, 1.013, 1, 0.987, 0.975, 0.963, 0.95, 0.938, 0.925, 0.912, 0.901, 0.888, 0.875, 0.863, 0.927, 0.913, 0.9, 0.886, 0.872, 0.859, 0.845, 0.831, 0.819, 0.805, 0.791, 0.778, 0.764, 0.75, 0.737, 0.723, 0.709, 0.696, 0.682, 0.668, 0.656, 0.642, 0.628, 0.615, 0.601, 1.07, 1.047, 1.022, 0.996, 0.973, 0.947, 0.922, 0.899, 0.873, 0.848, 0.824, 0.799, 0.773, 0.75, 0.724, 0.699, 0.676, 0.65, 0.625, 0.601, 0.576, 0.55, 0.527, 0.502, 0.476]
/** IT-216 line 13: New York State child and dependent care credit limitation table, by New York AGI ($200 rows, "over … but not over"). */
export function nyCareLimitation(nyagi: number): number {
  if (nyagi <= 25000) return 1.1
  if (nyagi <= 40000) return CARE_25_40[Math.ceil((nyagi - 25000) / 200) - 1]
  if (nyagi <= 50000) return 1
  if (nyagi <= 65000) return CARE_50_65[Math.ceil((nyagi - 50000) / 200) - 1]
  if (nyagi <= 150000) return 0.6
  return 0.2
}
/** IT-216 Worksheet 2 line 6: NYC child and dependent care credit limitation, by federal AGI. */
export function nycCareLimitation(fagi: number): number {
  if (fagi <= 25000) return 0.75
  if (fagi > 30000) return 0
  return Math.round((0.735 - (Math.ceil((fagi - 25000) / 200) - 1) * 0.03) * 1000) / 1000
}
const CARE_LIMIT = [0, 3000, 6000, 7500, 8500, 9000]
/** IT-270 income thresholds by number of dependents: [joint or surviving spouse, others]. */
const ELIMINATION_THRESHOLD: { joint: number[]; other: number[] } = {
  joint: [0, 36789, 46350, 54545, 61071, 68403, 75204, 91902],
  other: [0, 31503, 36824, 46512, 53711, 59928, 65712, 74565, 88361]
}
export function eliminationThreshold(fs: TaxReturnInput['filingStatus'], dependents: number): number {
  const t = fs === 'mfj' || fs === 'qss' ? ELIMINATION_THRESHOLD.joint : ELIMINATION_THRESHOLD.other
  return dependents <= 0 ? 0 : t[Math.min(dependents, t.length - 1)]
}
/** IT-196 limits: the line 40 limitation ($ federal AGI) and Worksheet 3 starting point (NYAGI). */
const IT196_LIMIT = { single: 340700, mfj: 408850, qss: 408850, mfs: 204400, hoh: 374800 } as const
const IT196_WS3 = { single: 100000, mfs: 100000, hoh: 150000, mfj: 200000, qss: 200000 } as const

export interface NyItemized { lines: Record<string, number>; total: number }
/** Form IT-196: New York itemized deduction (pre-2018 federal rules, no SALT cap, state income tax out). */
export function nyItemized(ret: TaxReturnInput, res: TaxReturnResult, nyagi: number): NyItemized | null {
  const it = ret.itemized
  const misc = pos(ret.ny.itemizedMiscellaneous)
  if (it.medical + it.stateLocalIncomeOrSalesTax + it.realEstateTax + it.personalPropertyTax + it.mortgageInterest + it.charityCash + it.charityNonCash + it.other + misc <= 0) return null
  const fs = ret.filingStatus
  const fagi = r(res.f1040['11a'])
  const L: Record<string, number> = {}
  L['1'] = r(pos(it.medical)); L['2'] = fagi; L['3'] = r(pos(fagi) * 0.1); L['4'] = pos(L['1'] - L['3'])
  L['5'] = r(pos(it.stateLocalIncomeOrSalesTax)); L['6'] = r(pos(it.realEstateTax)); L['7'] = r(pos(it.personalPropertyTax)); L['8'] = 0
  L['9'] = L['5'] + L['6'] + L['7'] + L['8']
  L['10'] = r(pos(it.mortgageInterest)); L['15'] = L['10']
  L['16'] = r(pos(it.charityCash)); L['17'] = r(pos(it.charityNonCash)); L['19'] = L['16'] + L['17']
  L['25'] = r(misc); L['26'] = fagi; L['27'] = r(pos(fagi) * 0.02); L['28'] = pos(L['25'] - L['27'])
  L['39'] = r(pos(it.other))
  const sum = L['4'] + L['9'] + L['15'] + L['19'] + L['28'] + L['39']
  // Line 40 worksheet (overall limitation).
  let line9 = 0
  let line3 = 0
  if (fagi > IT196_LIMIT[fs]) {
    line3 = pos(sum - L['4'])
    if (line3 > 0) line9 = r(Math.min(line3 * 0.8, (fagi - IT196_LIMIT[fs]) * 0.03))
  }
  L['40'] = sum - line9
  // Line 41: state and local income taxes, reduced in proportion when the deduction was limited (Worksheet 2).
  L['41'] = line9 > 0 && line3 > 0 ? r(L['5'] - L['5'] * Math.round((line9 / line3) * 10000) / 10000) : L['5']
  L['42'] = L['40'] - L['41']
  L['44'] = 0
  L['45'] = L['42'] + L['44']
  // Line 46: high-income adjustment.
  let adj = 0
  if (nyagi > 100000 && nyagi <= 475000) {
    const over = nyagi - IT196_WS3[fs]
    if (over > 0) adj = r(Math.round(Math.min(over, 50000) / 50000 * 10000) / 10000 * L['45'] * 0.25)
  } else if (nyagi > 475000 && nyagi <= 525000) {
    const q = 0.25 * L['45']
    adj = r(q + Math.round(Math.min(nyagi - 475000, 50000) / 50000 * 10000) / 10000 * q)
  } else if (nyagi > 525000 && nyagi <= 1000000) adj = r(L['45'] * 0.5)
  L['46'] = adj
  L['47'] = nyagi > 10000000 ? r(L['19'] * 0.25) : nyagi > 1000000 ? r(L['19'] * 0.5) : L['45'] - L['46']
  L['48'] = 0
  L['49'] = L['47'] + L['48']
  return { lines: L, total: L['49'] }
}

export interface NyResult {
  lines: Record<string, number>
  deduction: { method: 'standard' | 'itemized'; standard: number; itemized: number; it196: NyItemized | null }
  care: { persons: number; line3a: number; line5: number; line6: number; line7: number; line8: number; line10: number; line11: number; line13: number; line14: number; under4Expenses: number; nycLine4: number; nycLine6: number; nycCredit: number }
  elimination: { threshold: number; line3: number; line5: number; line10: number; credit: number }
  pensionExclusion: Record<Owner, number>
  escc: { under4: number; age4to16: number; reduction: number }
  eic: { federal: number; tentative: number; worksheetB: number; nycRate: number }
  issues: string[]
  attach: string[]
}

export function computeNewYork(ret: TaxReturnInput, res: TaxReturnResult): NyResult {
  const d = ret.ny
  const f = res.f1040
  const s1 = res.schedule1
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const nyc = d.locality === 'nyc'
  const yonkers = d.locality === 'yonkers'
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []

  // ── Federal income (lines 1–19) ──
  L['1'] = r(f['1z'])
  L['2'] = r(f['2b'])
  L['3'] = r(f['3b'])
  L['4'] = r(pos(d.stateRefundInFagi))
  L['5'] = 0
  L['6'] = r(s1.businessIncome)
  L['7'] = r(f['7a'])
  L['8'] = r(s1.otherGains)
  L['9'] = r(f['4b'])
  L['10'] = r(f['5b'])
  L['11'] = r(s1.rentalIncome)
  L['12'] = 0
  L['13'] = 0
  L['14'] = r(s1.unemployment)
  L['15'] = r(f['6b'])
  L['19'] = r(f['11a'])
  L['18'] = r(s1.totalAdjustments)
  L['17'] = L['19'] + L['18']
  L['16'] = L['17'] - (L['1'] + L['2'] + L['3'] + L['4'] + L['5'] + L['6'] + L['7'] + L['8'] + L['9'] + L['10'] + L['11'] + L['13'] + L['14'] + L['15'])
  const fagi = L['19']

  // ── New York additions ──
  L['20'] = r(pos(d.otherStateBondInterest))
  L['21'] = r(pos(d.pension414h))
  L['22'] = r(pos(d.nys529Distributions))
  L['23'] = r(pos(d.otherAdditions))
  L['24'] = L['19'] + L['20'] + L['21'] + L['22'] + L['23']

  // ── New York subtractions ──
  L['25'] = L['4']
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  L['26'] = r(owners.reduce((s, o) => s + pos(d.govPensions[o]), 0))
  L['27'] = L['15']
  L['28'] = r(pos(d.usBondInterest))
  // Pension and annuity income exclusion: up to $20,000 each, if 59½ before 2025 (age 60 or older at the end of 2025).
  const pensionExclusion: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
  for (const o of owners) {
    const person = o === 'taxpayer' ? ret.taxpayer : ret.spouse
    const taxable = ret.retirement.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0)
    const auto = person.age >= 60 ? pos(taxable - pos(d.govPensions[o])) : 0
    pensionExclusion[o] = r(Math.min(NY_PENSION_EXCLUSION, d.pensionExclusionOverride[o] ?? auto))
  }
  L['29'] = pensionExclusion.taxpayer + pensionExclusion.spouse
  L['30'] = r(Math.min(pos(d.nys529Contributions), joint ? NY_529_MAX.joint : NY_529_MAX.single) + pos(d.nys529Earnings))
  L['31'] = r(pos(d.otherSubtractions))
  L['32'] = L['25'] + L['26'] + L['27'] + L['28'] + L['29'] + L['30'] + L['31']
  L['33'] = L['24'] - L['32']
  const nyagi = L['33']

  // ── Deduction and exemptions ──
  const standard: number = ret.canBeClaimedAsDependent && fs === 'single' ? NY_STANDARD_DEDUCTION.dependent : NY_STANDARD_DEDUCTION[fs]
  const it196 = nyItemized(ret, res, L['33'])
  const itemized = it196?.total ?? 0
  const method: 'standard' | 'itemized' = it196 && (itemized > standard || (fs === 'mfs' && res.deduction.used === 'itemized')) ? 'itemized' : 'standard'
  L['34'] = method === 'itemized' ? itemized : standard
  L['35'] = pos(L['33'] - L['34'])
  L['36box'] = ret.dependents.length
  L['36'] = ret.dependents.length * NY_DEPENDENT_EXEMPTION
  L['37'] = pos(L['35'] - L['36'])
  L['38'] = L['37']

  // ── NYS tax and credits ──
  L['39'] = nysTax(L['38'], nyagi, fs)
  const people = ret.dependents.length + 1 + (joint ? 1 : 0)
  L['40'] = ret.canBeClaimedAsDependent ? 0 : householdCredit(NYS_HH_SINGLE, NYS_HH, fs, fagi, people)
  L['41'] = r(pos(d.residentCredit))
  L['42'] = r(pos(d.otherNonrefundableCredits))
  L['43'] = L['40'] + L['41'] + L['42']
  L['44'] = pos(L['39'] - L['43'])
  L['45'] = r(pos(d.otherTaxes))
  L['46'] = L['44'] + L['45']

  // ── NYC ──
  if (nyc) {
    L['47'] = L['38']
    L['47a'] = nycTax(L['47'], fs)
    L['48'] = ret.canBeClaimedAsDependent ? 0 : householdCredit(NYC_HH_SINGLE, NYC_HH, fs, fagi, people)
    L['49'] = pos(L['47a'] - L['48'])
  } else { L['47'] = 0; L['47a'] = 0; L['48'] = 0; L['49'] = 0 }
  L['50'] = 0
  L['51'] = 0
  L['52'] = L['49'] + L['50'] + L['51']
  L['53'] = nyc ? r(pos(d.nycNonrefundableCredits)) : 0
  L['54'] = pos(L['52'] - L['53'])
  L['54e'] = 0

  // ── Refundable credits ──
  // Empire State child credit (IT-213).
  const kids = ret.dependents.filter((x) => x.childRelationship && x.age < 17 && x.monthsLivedWithYou > 6)
  const under4 = kids.filter((x) => x.age < 4).length
  const age4to16 = kids.length - under4
  const esccBase = under4 * NY_ESCC.under4 + age4to16 * NY_ESCC.age4to16
  const line6 = Math.floor(pos(fagi) / 1000) * 1000
  const esccReduction = r(pos(line6 - NY_ESCC.threshold[fs]) * NY_ESCC.rate)
  L['63'] = pos(esccBase - esccReduction)
  // NYS EIC (IT-215): 30% of the federal EIC, less the household credit used against tax.
  const fedEic = r(res.eic.credit)
  const tentative = r(fedEic * NY_EIC_RATE)
  const worksheetB = pos(L['39'] - L['41'])
  const nysEic = fedEic > 0 && res.eic.investmentIncome <= NY_EIC_INVESTMENT_LIMIT ? pos(tentative - Math.min(worksheetB, L['40'])) : 0
  // Child and dependent care credit (IT-216): NYS credit, plus the NYC credit for children under 4.
  const carePersons = ret.dependents.filter(careQualifyingPerson)
  const care = { persons: carePersons.length, line3a: 0, line5: 0, line6: 0, line7: 0, line8: 0, line10: 0, line11: 0, line13: 0, line14: 0, under4Expenses: 0, nycLine4: 0, nycLine6: 0, nycCredit: 0 }
  if (carePersons.length > 0 && ret.dependentCare.expenses > 0) {
    care.line3a = r(ret.dependentCare.expenses)
    const limit = CARE_LIMIT[Math.min(5, carePersons.length)]
    const p3 = res.form2441.partIII
    const line3b = p3 ? pos(limit - p3.line28) : Infinity
    care.line5 = r(Math.min(care.line3a, line3b, limit))
    care.line6 = r(res.form2441.line4)
    care.line7 = joint ? r(res.form2441.line5) : care.line6
    care.line8 = pos(Math.min(care.line5, care.line6, care.line7))
    care.line10 = nyCareDecimal(fagi)
    care.line11 = r(care.line8 * care.line10)
    care.line13 = nyCareLimitation(nyagi)
    care.line14 = r(care.line11 * care.line13)
    const under4 = carePersons.filter((x) => x.age < 4)
    care.under4Expenses = r(d.careExpensesUnder4 ?? (under4.length === carePersons.length ? care.line3a : 0))
    if (nyc && fagi <= 30000 && under4.length > 0 && care.line14 > 0 && care.line3a > 0) {
      care.nycLine4 = Math.min(1, Math.round((care.under4Expenses / care.line3a) * 10000) / 10000)
      care.nycLine6 = nycCareLimitation(fagi)
      care.nycCredit = r(r(care.line14 * care.nycLine4) * care.nycLine6)
    }
  }
  L['64'] = care.line14 + care.nycCredit
  L['65'] = nysEic
  L['66'] = 0
  L['67'] = r(pos(d.realPropertyCredit))
  L['68'] = r(pos(d.collegeTuitionCredit))
  // NYC school tax credits and NYC EIC.
  const schoolIncome = fagi - L['9']
  const eligibleNyc = nyc && !ret.canBeClaimedAsDependent
  L['69'] = eligibleNyc && schoolIncome <= 250000 ? (sched(fs) === 'mfj' ? 125 : 63) : 0
  let rateReduction = 0
  if (eligibleNyc && schoolIncome <= 500000) {
    const t = Math.min(L['47'], 500000)
    const [top, base] = sched(fs) === 'mfj' ? [21600, 37] : sched(fs) === 'hoh' ? [14400, 25] : [12000, 21]
    rateReduction = t <= top ? r(t * 0.00171) : r(base + (t - top) * 0.00228)
  }
  L['69a'] = rateReduction
  const nycRate = nycEicRate(nyagi)
  L['70'] = nyc && fedEic > 0 && res.eic.investmentIncome <= NY_EIC_INVESTMENT_LIMIT ? r(fedEic * nycRate) : 0
  // NYC income tax elimination credit (IT-270).
  const elimination = { threshold: eliminationThreshold(fs, ret.dependents.length), line3: 0, line5: 0, line10: 0, credit: 0 }
  if (nyc && ret.dependents.length > 0 && L['54'] > 0 && res.eic.investmentIncome <= 10000) {
    elimination.line3 = pos(fagi - elimination.threshold)
    if (elimination.line3 <= 5000) {
      elimination.line5 = Math.round(((5000 - elimination.line3) / 5000) * 10000) / 10000
      elimination.line10 = L['54'] - (care.nycCredit + L['70'])
      if (elimination.line10 > 0) elimination.credit = r(elimination.line10 * elimination.line5)
    }
  }
  L['70a'] = elimination.credit
  L['71'] = r(pos(d.otherRefundableCredits))

  // ── Yonkers resident surcharge ──
  if (yonkers && L['46'] > 0) {
    const j = L['63'] + L['67'] + L['64'] + L['65'] + L['66'] + L['68'] + L['69'] + L['69a'] + 0
    L['55'] = r(pos(L['46'] - j) * NY_YONKERS_RATE)
  } else L['55'] = 0
  L['56'] = 0
  L['57'] = 0
  L['58'] = L['54'] + L['54e'] + L['55'] + L['56'] + L['57']
  L['59'] = d.salesTaxChart ? salesTaxChart(fagi) : r(pos(d.salesTax))
  L['60'] = r(pos(d.contributions))
  L['61'] = L['46'] + L['58'] + L['59'] + L['60']
  L['62'] = L['61']

  // ── Payments ──
  L['72'] = r(pos(d.withholding))
  L['73'] = nyc ? r(pos(d.nycWithholding)) : 0
  L['74'] = yonkers ? r(pos(d.yonkersWithholding)) : 0
  L['75'] = r(pos(d.estimatedPayments))
  L['76'] = ['63', '64', '65', '66', '67', '68', '69', '69a', '70', '70a', '71', '72', '73', '74', '75'].reduce((s, k) => s + L[k], 0)
  L['77'] = pos(L['76'] - L['62'])
  L['79'] = Math.min(r(pos(d.creditForward)), L['77'])
  L['78'] = L['77'] - L['79']
  L['78a'] = 0
  L['78b'] = L['78']
  L['80'] = pos(L['62'] - L['76'])
  L['81'] = 0
  L['82'] = 0

  // ── Notes ──
  if (L['23'] > 0 || L['31'] > 0) attach.push('Form IT-225, New York State modifications')
  if (method === 'itemized') attach.push('Form IT-196, New York itemized deductions')
  if (L['41'] > 0) attach.push('Form IT-112-R, resident credit for tax paid to another state')
  if (L['42'] > 0 || L['45'] > 0 || L['71'] > 0) attach.push('Form IT-201-ATT, other credits and taxes')
  if (L['64'] > 0) attach.push('Form IT-216, child and dependent care credit')
  if (L['67'] > 0) attach.push('Form IT-214, real property tax credit')
  if (L['68'] > 0) attach.push('Form IT-272, college tuition credit')
  if (L['70a'] > 0) attach.push('Form IT-270, NYC income tax elimination credit')
  if (!d.schoolDistrictCode.trim()) issues.push('Enter your school district name and code number (from the IT-201 instructions); New York requires them.')
  if (!d.county.trim()) issues.push('Enter your New York State county of residence.')
  if (it196 && method === 'standard' && res.deduction.used === 'itemized') issues.push(`You itemized federally, but the New York standard deduction (${standard.toLocaleString('en-US')}) is larger than the New York itemized deduction (${itemized.toLocaleString('en-US')}).`)
  if (method === 'itemized') issues.push(`New York itemized deduction (Form IT-196): ${itemized.toLocaleString('en-US')} — medical over 10% of AGI, no SALT cap, state and local income tax left out${it196 && it196.lines['46'] ? `, reduced by ${it196.lines['46'].toLocaleString('en-US')} for New York AGI over $100,000` : ''}.`)
  if (L['29'] > 0) issues.push(`Pension and annuity exclusion: ${L['29'].toLocaleString('en-US')} (up to $20,000 each for people who were 59½ before 2025). Check that the pensions qualify.`)
  if (ret.retirement.some((x) => x.taxableAmount > 0) && L['29'] === 0 && owners.some((o) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age >= 59)) issues.push('If you were 59½ before January 1, 2025, up to $20,000 of private pension and IRA income can be excluded; enter it if it was not figured.')
  if (fs === 'mfs') issues.push('Married filing separately: the household credit tables use both spouses’ federal AGI; check the amount on line 40.')
  if (nyagi > 107650) issues.push('New York AGI is over $107,650, so the tax comes from the tax computation worksheets (the lower brackets’ benefit is phased out).')
  if (kids.length > 0 && L['63'] === 0 && esccBase > 0) issues.push('The Empire State child credit is phased out by your federal AGI.')
  if (kids.length > 0) attach.push('Form IT-213, Empire State child credit')
  if (L['65'] > 0 || L['70'] > 0) attach.push('Form IT-215, earned income credit')
  if (ret.dependentCare.employerBenefits > 0 && care.line14 > 0) issues.push('You received dependent care benefits: check Form IT-216 line 3b (Worksheet 1) against your federal Form 2441 Part III.')
  if (care.nycCredit === 0 && nyc && fagi <= 30000 && carePersons.some((x) => x.age < 4) && carePersons.some((x) => x.age >= 4) && d.careExpensesUnder4 === null) issues.push('For the NYC child care credit, enter how much of your care expenses was for children under 4.')
  if (s1.businessIncome > 50000 && (nyc || ['Nassau', 'Suffolk', 'Westchester', 'Rockland', 'Orange', 'Putnam', 'Dutchess'].includes(d.county))) issues.push('Self-employment earnings over $50,000 in the Metropolitan Commuter Transportation District may owe the MCTMT (lines 54a–54e); it is not figured here.')

  return {
    lines: L,
    deduction: { method, standard, itemized, it196 },
    care,
    elimination,
    pensionExclusion,
    escc: { under4, age4to16, reduction: esccReduction },
    eic: { federal: fedEic, tentative, worksheetB, nycRate },
    issues, attach
  }
}
