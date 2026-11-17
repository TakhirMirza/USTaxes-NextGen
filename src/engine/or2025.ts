/**
 * Oregon Form OR-40, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form OR-40 and its instructions (150-101-040-1, with the 01-29-2026 errata), Schedules OR-ASC, OR-A
 * and OR-WFHDC with their instructions, Publication OR-CODES and Publication OR-17 (2025): federal AGI plus additions,
 * less the federal tax liability subtraction (at most $8,500, phased out from $125,000 / $250,000 of AGI), taxable
 * Social Security and OR-ASC subtractions (U.S. bond interest, federal pension, the federal tip / overtime / vehicle
 * loan interest deductions); the larger of Schedule OR-A and the standard deduction; tax from the 2025 tax table
 * (below $50,000) or rate charts; the $256 exemption credit; political contribution, retirement income and other
 * state credits; the 9.863% kicker; Oregon EIC (9%, or 12% with a child under 3), the Oregon Kids Credit and the
 * WFHDC, 529 and ABLE refundable credits. Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const OR_EXEMPTION_CREDIT = 256
export const OR_KICKER_RATE = 0.09863

/** Line 20: the 2025 tax table below $50,000 (rows of $20/$30/$50, then $100, at the midpoint) or the rate charts. */
export function orTax(taxable: number, joint: boolean): number {
  const x = pos(r(taxable))
  if (x >= 50000) {
    if (joint) return r(x <= 250000 ? 3756 + 0.0875 * (x - 50000) : 21256 + 0.099 * (x - 250000))
    return r(x <= 125000 ? 4065 + 0.0875 * (x - 50000) : 10627 + 0.099 * (x - 125000))
  }
  const m = x < 20 ? 10 : x < 50 ? 35 : x < 100 ? 75 : Math.floor(x / 100) * 100 + 50
  const [a, b, c1, c2] = joint ? [8800, 22200, 418, 1323] : [4400, 11100, 209, 661]
  return r(m < a ? 0.0475 * m : m < b ? c1 + 0.0675 * (m - a) : c2 + 0.0875 * (m - b))
}

/** Table 4: the most federal tax that can be subtracted (line 10) at a given federal AGI. */
export function orFederalTaxLimit(agi: number, fs: TaxReturnInput['filingStatus']): number {
  const base = fs === 'mfs' ? 4250 : 8500
  const [start, step] = fs === 'single' || fs === 'mfs' ? [125000, 5000] : [250000, 10000]
  if (agi < start) return base
  return pos(r(base * (1 - 0.2 * (Math.floor((agi - start) / step) + 1))))
}

/** Table 14: share of 529 / ABLE contributions allowed as a credit, by federal AGI. */
export function orSavingsRate(agi: number): number {
  return agi <= 30000 ? 1 : agi <= 70000 ? 0.5 : agi <= 100000 ? 0.25 : agi <= 250000 ? 0.1 : 0.05
}

/** Table 16: the WFHDC income limit for a household size. */
export function orWfhdcLimit(size: number): number {
  const n = Math.min(8, Math.max(2, size))
  return 63450 + (n - 2) * 16500
}

export interface OrResult {
  lines: Record<string, number>
  asc: { additions: { code: string; amount: number }[]; subtractions: { code: string; amount: number }[]; standard: { code: string; state: string; amount: number }[]; refundable: { code: string; amount: number }[] }
  schA: Record<string, number>
  itemize: boolean
  exemptions: { taxpayer: number; spouse: number; dependents: number; disabledChildren: number; total: number }
  wfhdc: Record<string, number> | null
  kidsCredit: Record<string, number>
  retirementCredit: Record<string, number> | null
  issues: string[]
  attach: string[]
}

export function computeOregon(ret: TaxReturnInput, res: TaxReturnResult): OrResult {
  const d = ret.or
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const jointRates = fs === 'mfj' || fs === 'hoh' || fs === 'qss'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const agi = r(f['11a'])
  L['7'] = agi

  // ── Schedule OR-ASC, sections A and B ──
  const additions: { code: string; amount: number }[] = []
  if (d.otherStateBondInterest > 0) additions.push({ code: '158', amount: r(d.otherStateBondInterest) })
  if (d.otherAddition.amount > 0 && /^1\d\d$/.test(d.otherAddition.code)) additions.push({ code: d.otherAddition.code, amount: r(d.otherAddition.amount) })
  const subtractions: { code: string; amount: number }[] = []
  const sub = (code: string, amount: number): void => { if (r(amount) > 0) subtractions.push({ code, amount: r(amount) }) }
  sub('307', Math.min(pos(d.federalPension), r(pos(f['5b']))))
  sub('315', pos(d.usObligationInterest))
  sub('390', pos(res.schedule1A.tips))
  sub('391', pos(res.schedule1A.overtime))
  sub('392', pos(res.schedule1A.carLoanInterest))
  if (/^3\d\d$/.test(d.otherSubtraction.code)) sub(d.otherSubtraction.code, pos(d.otherSubtraction.amount))
  L['8'] = additions.reduce((s, x) => s + x.amount, 0)
  L['9'] = L['7'] + L['8']

  // ── Subtractions ──
  const fedTax = pos(r(f['22']) + r(res.schedule2.earlyDistributionTax + res.schedule2.hsaExcessTax + res.schedule2.hsaAdditionalTax) - r(f['29']) - r(f['30'] ?? 0))
  L['10'] = Math.min(fedTax, orFederalTaxLimit(agi, fs))
  L['11'] = r(pos(f['6b']))
  L['12'] = 0
  L['13'] = subtractions.reduce((s, x) => s + x.amount, 0)
  L['14'] = L['10'] + L['11'] + L['12'] + L['13']
  L['15'] = L['9'] - L['14']

  // ── Deductions ──
  const it = ret.itemized
  const A: Record<string, number> = {}
  A['1'] = r(pos(it.medical))
  A['2'] = agi
  A['3'] = r(pos(agi) * 0.075)
  A['4'] = pos(A['1'] - A['3'])
  A['5'] = 0
  A['6'] = r(pos(it.realEstateTax))
  A['7'] = r(pos(it.personalPropertyTax))
  A['9'] = Math.min(A['5'] + A['6'] + A['7'], fs === 'mfs' ? 20000 : 40000)
  A['11'] = A['9']
  A['12'] = r(pos(it.mortgageInterest))
  A['17'] = A['12']
  A['18'] = r(pos(it.charityCash))
  A['19'] = r(pos(it.charityNonCash))
  A['21'] = A['18'] + A['19']
  A['22'] = r(pos(it.other))
  A['23'] = A['4'] + A['11'] + A['17'] + A['21'] + A['22']
  const boxes = owners.reduce((s, o) => s + (person(o).age65OrOlder || person(o).age >= 65 ? 1 : 0) + (person(o).blind ? 1 : 0), 0)
  const base = { single: 2835, mfj: 5670, mfs: 2835, hoh: 4560, qss: 5670 }[fs]
  let standard = base
  if (ret.canBeClaimedAsDependent) {
    const earned = ret.w2s.filter((w) => w.owner === 'taxpayer').reduce((s, w) => s + w.wages, 0) + res.scheduleC.filter((x) => x.owner === 'taxpayer').reduce((s, x) => s + x.netProfit, 0)
    standard = Math.min(base, Math.max(r(earned) + 450, 1350))
  }
  standard += boxes * (fs === 'single' || fs === 'hoh' ? 1200 : 1000)
  const itemize = A['23'] > standard
  L['16'] = itemize ? A['23'] : 0
  L['17'] = standard
  L['18'] = Math.max(L['16'], L['17'])
  L['19'] = pos(L['15'] - L['18'])

  // ── Tax ──
  L['20'] = orTax(L['19'], jointRates)
  L['21'] = 0
  L['22'] = 0
  L['23'] = 0
  L['24'] = L['20'] + L['23']

  // ── Standard credits ──
  const limitRegular = fs === 'single' || fs === 'mfs' ? 100000 : 200000
  const ex = { taxpayer: ret.canBeClaimedAsDependent ? 0 : 1, spouse: joint ? 1 : 0, dependents: ret.dependents.length, disabledChildren: ret.dependents.filter((x) => d.childDisability[x.id]).length, total: 0 }
  const severe = owners.filter((o) => d.severeDisability[o]).length
  ex.total = ex.taxpayer + ex.spouse + ex.dependents + ex.disabledChildren + severe
  const counted = (agi <= limitRegular ? ex.taxpayer + ex.spouse + ex.dependents : 0) + (agi <= 100000 ? ex.disabledChildren + severe : 0)
  L['25'] = counted * OR_EXEMPTION_CREDIT
  L['26'] = agi <= (joint ? 150000 : 75000) ? Math.min(r(pos(d.politicalContributions)), joint ? 100 : 50) : 0
  const standardCredits: { code: string; state: string; amount: number }[] = []
  // Retirement income credit (811).
  let retirementCredit: Record<string, number> | null = null
  const eligible62 = owners.filter((o) => person(o).age >= 62 || person(o).age65OrOlder)
  const ss = r(pos(f['6a']))
  if (eligible62.length > 0) {
    const W: Record<string, number> = {}
    W['1'] = r(pos(ret.retirement.filter((x) => owners.includes(x.owner)).reduce((s, x) => s + pos(x.taxableAmount), 0)))
    W['2'] = subtractions.find((x) => x.code === '307')?.amount ?? 0
    W['3'] = pos(W['1'] - W['2'])
    W['4'] = joint ? 15000 : 7500
    W['5'] = ss
    W['6'] = pos(W['4'] - W['5'])
    W['7'] = d.householdIncome ?? r(pos(agi - f['6b'] + f['2a']))
    W['8'] = joint ? 30000 : 15000
    W['9'] = pos(W['7'] - W['8'])
    W['10'] = pos(W['6'] - W['9'])
    W['11'] = Math.min(W['3'], W['10'])
    const limit = joint ? 45000 : 22500
    W['credit'] = W['7'] < limit && W['5'] < W['4'] && W['7'] + W['5'] < limit ? r(W['11'] * 0.09) : 0
    if (W['3'] > 0) retirementCredit = W
    if (W['credit'] > 0) standardCredits.push({ code: '811', state: '', amount: W['credit'] })
  }
  if (d.otherStateCredit.amount > 0) standardCredits.push({ code: '802', state: d.otherStateCredit.state.toUpperCase().slice(0, 2), amount: r(d.otherStateCredit.amount) })
  L['27'] = standardCredits.reduce((s, x) => s + x.amount, 0)
  L['28'] = L['25'] + L['26'] + L['27']
  L['29'] = pos(L['24'] - L['28'])
  L['30'] = 0
  L['31'] = L['29'] - L['30']

  // ── Kicker, payments and refundable credits ──
  const kicker = r(pos(d.kickerLiability2024) * OR_KICKER_RATE)
  L['32'] = d.donateKicker ? 0 : kicker
  L['55b'] = d.donateKicker ? kicker : 0
  const w2Tax = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + r(pos(d.w2[w.id]?.stateTax ?? 0)), 0)
  L['33'] = w2Tax + r(pos(d.withholding1099))
  L['34'] = r(pos(d.priorYearRefundApplied))
  L['35'] = r(pos(d.estimatedPayments))
  L['36'] = 0
  const youngest = ret.dependents.length ? Math.min(...ret.dependents.map((x) => x.age)) : 99
  L['37'] = r(pos(f['27a']) * (youngest < 3 ? 0.12 : 0.09))
  // Oregon Kids Credit worksheet.
  const K: Record<string, number> = {}
  const losses = [f['7a'], res.schedule1.businessIncome, res.schedule1.otherGains, res.schedule1.rentalIncome].reduce((s, n) => s + pos(-n), 0)
  K['1'] = L['15']
  K['2'] = ['390', '391', '392'].reduce((s, c) => s + (subtractions.find((x) => x.code === c)?.amount ?? 0), 0)
  K['3'] = pos(r(losses) - 20000)
  K['4'] = K['1'] + K['2'] + K['3']
  K['6'] = pos(K['4'] - 26550)
  K['7'] = Math.round((K['6'] / 5000) * 100) / 100
  K['8a'] = Math.min(5, ret.dependents.filter((x) => x.age <= 5).length)
  K['8'] = K['8a'] * 1050
  K['9'] = r(K['7'] * K['8'])
  K['10'] = fs === 'mfs' || K['4'] >= 31550 ? 0 : pos(K['8'] - K['9'])
  L['38'] = K['10']
  // Refundable OR-ASC credits.
  const refundable: { code: string; amount: number }[] = []
  let wfhdc: Record<string, number> | null = null
  if (d.wfhdcPercent > 0 && ret.dependentCare.expenses > 0) {
    const W: Record<string, number> = {}
    const earned = (o: Owner): number => pos(r(ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0)
      + res.scheduleC.filter((x) => x.owner === o).reduce((s, x) => s + x.netProfit, 0) - res.scheduleSE.filter((x) => x.owner === o).reduce((s, x) => s + x.total / 2, 0)))
    W['10'] = r(pos(ret.dependentCare.expenses))
    W['15'] = ex.taxpayer + ex.spouse + ex.dependents
    W['16'] = res.form2441.qualifyingPersons >= 2 ? 24000 : 12000
    W['17'] = Math.min(r(pos(ret.dependentCare.employerBenefits)), fs === 'mfs' ? 2500 : 5000)
    W['18'] = pos(W['16'] - W['17'])
    W['19'] = W['10']
    W['20'] = earned('taxpayer')
    W['21'] = joint ? earned('spouse') : W['20']
    W['22'] = Math.min(W['18'], W['19'], W['20'], W['21'])
    W['23'] = Math.min(1, d.wfhdcPercent)
    W['24'] = r(W['22'] * W['23'])
    W['29'] = W['24']
    W['limit'] = orWfhdcLimit(W['15'])
    if (Math.max(agi, L['15']) > W['limit']) {
      issues.push(`The WFHDC credit is for households with income up to ${W['limit'].toLocaleString('en-US')} (household of ${W['15']}); this return is over the limit.`)
      W['29'] = 0
    }
    wfhdc = W
    if (W['29'] > 0) refundable.push({ code: '895', amount: W['29'] })
  }
  const cap = joint ? 360 : 180
  const rate = orSavingsRate(agi)
  if (d.collegeSavings > 0) refundable.push({ code: '896', amount: Math.min(cap, r(d.collegeSavings * rate)) })
  if (d.ableContributions > 0) refundable.push({ code: '897', amount: Math.min(cap, r(d.ableContributions * rate)) })
  L['39'] = refundable.reduce((s, x) => s + x.amount, 0)
  L['40'] = L['32'] + L['33'] + L['34'] + L['35'] + L['36'] + L['37'] + L['38'] + L['39']
  L['41'] = pos(L['40'] - L['31'])
  L['42'] = pos(L['31'] - L['40'])
  L['45'] = 0
  L['46'] = L['42'] + L['45']
  L['47'] = pos(L['41'] - L['45'])
  L['48'] = Math.min(r(pos(d.creditForward)), L['47'])
  L['52'] = L['48']
  L['53'] = L['47'] - L['52']

  // ── Notes ──
  if (L['33'] > 0) attach.push('W-2s and 1099s showing Oregon tax withheld')
  attach.push('A copy of your federal Form 1040 (Oregon may adjust the return without it)')
  if (standardCredits.some((x) => x.code === '802')) attach.push('Schedule OR-ASC code 802: the other state’s return')
  if (L['26'] > 0) issues.push('Keep receipts for the political contributions (line 26).')
  if (d.kickerLiability2024 === 0) issues.push('Kicker: enter your 2024 Oregon tax (2024 Form OR-40, line 24) to claim the 9.863% surplus credit; you must have filed a 2024 Oregon return.')
  if (ret.dependentCare.expenses > 0 && d.wfhdcPercent === 0) issues.push('Working family household and dependent care credit: enter your credit percentage from the WFHDC calculator on the Oregon Department of Revenue site (Publication OR-WFHDC-TB).')
  if (ret.retirement.some((x) => /federal|opm|military|dfas/i.test(x.payer)) && d.federalPension === 0) issues.push('Federal pensions for service before October 1, 1991 can be subtracted (code 307): enter the subtraction from the Publication OR-17 worksheet.')
  if (fs === 'mfs') issues.push('Married filing separately: the standard deduction is $0 if your spouse itemizes.')
  if (ret.canBeClaimedAsDependent) issues.push('Someone else can claim you: the standard deduction is limited to earned income plus $450 (at least $1,350).')
  if (L['46'] > 1000 && L['35'] === 0) issues.push('A balance due over $1,000 may mean interest on underpaid estimated tax (Form OR-10).')

  return { lines: L, asc: { additions, subtractions, standard: standardCredits, refundable }, schA: A, itemize, exemptions: ex, wfhdc, kidsCredit: K, retirementCredit, issues, attach }
}
