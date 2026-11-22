/**
 * Vermont Form IN-111, full-year resident income tax return, tax year 2025, with Schedules IN-112 and IN-113 and the
 * 2026 Homestead Declaration / Property Tax Credit Claim (HS-122) with Schedule HI-144.
 *
 * Source: 2025 Vermont Income Tax Return Booklet (IN-111, IN-112, IN-113, HS-122, HI-144 instructions, rate schedules
 * and tax tables) and the Rev. 10/25 fill-in forms.
 *  - Federal AGI with IN-112 modifications: other states’ bond interest and bonus depreciation added; U.S. interest,
 *    capital gains exclusion, taxable state refunds, the medical deduction, the Social Security or public pension
 *    exemption (full under $55,000 / $70,000 joint AGI, phased out by $65,000 / $80,000), the military retirement
 *    exemption ($125,000–$175,000 phase-out), railroad retirement, exempt bond interest and student loan interest.
 *  - Standard deduction $7,650 / $15,300 / $11,450 plus $1,250 per federal 65+/blind box; $5,300 per exemption.
 *  - Tax from the table (taxable income under $75,000, middle of each $100 row) or the rate schedule; with AGI over
 *    $150,000, at least 3% of AGI less U.S. interest.
 *  - 5% charitable contribution credit (up to $1,000); 24% of the federal additional tax on retirement distributions.
 *  - Refundable credits (IN-112 Part II): 72% of the federal child care credit, $1,000 per child under 6 (phased out
 *    above $125,000), Vermont EITC 38% of the federal credit (100% with no qualifying children), veteran $250.
 *  - Child care contribution of 0.11% of self-employment earnings; use tax; voluntary contributions.
 * Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)
type FS = TaxReturnInput['filingStatus']

export const VT_STANDARD: Record<FS, number> = { single: 7650, mfj: 15300, mfs: 7650, hoh: 11450, qss: 15300 }
export const VT_ADDITIONAL = 1250
export const VT_EXEMPTION = 5300

/** Rate schedules: [over, base tax, rate]. The bases are the rounded amounts printed on the schedules. */
const SCHEDULE: Record<'s' | 'j' | 'm' | 'h', [number, number, number][]> = {
  s: [[0, 0, 0.0335], [49400, 1655, 0.066], [75000, 3345, 0.066], [119700, 6295, 0.076], [249700, 16175, 0.0875]],
  j: [[0, 0, 0.0335], [75000, 2513, 0.0335], [82500, 2764, 0.066], [199450, 10482, 0.076], [304000, 18428, 0.0875]],
  m: [[0, 0, 0.0335], [41250, 1382, 0.066], [75000, 3609, 0.066], [99725, 5241, 0.076], [152000, 9214, 0.0875]],
  h: [[0, 0, 0.0335], [66200, 2218, 0.066], [75000, 2799, 0.066], [171000, 9135, 0.076], [276850, 17179, 0.0875]]
}
const key = (fs: FS): 's' | 'j' | 'm' | 'h' => (fs === 'mfj' || fs === 'qss' ? 'j' : fs === 'mfs' ? 'm' : fs === 'hoh' ? 'h' : 's')
const schedule = (x: number, fs: FS): number => {
  const rows = SCHEDULE[key(fs)]
  for (let i = rows.length - 1; i >= 0; i--) if (x > rows[i][0] || i === 0) return rows[i][1] + (x - rows[i][0]) * rows[i][2]
  return 0
}
const digitsOf = (v: string): string => v.replace(/\D/g, '')
const half = (x: number): number => Math.floor(x + 0.5 + 1e-9)

/** Line 8 before the minimum tax: the tax table under $75,000 (middle of each $100 row), the schedule from $75,000. */
export function vtTax(taxable: number, fs: FS): number {
  const x = pos(Math.floor(taxable))
  if (x < 100) return 0
  if (x < 75000) return half(schedule(Math.floor(x / 100) * 100 + 50, fs))
  return half(schedule(x, fs))
}

/** Child tax credit per child for an AGI (IN-112 Part II, line 4 table). */
export function vtChildCreditPerChild(agi: number): number {
  if (agi <= 125000) return 1000
  return Math.max(0, 1000 - 20 * Math.ceil((agi - 125000) / 1000))
}

/** Phase-out factor rounded to two places, at most 1. */
const factor = (top: number, agi: number, width: number): number => Math.min(1, Math.round(pos(top - agi) / width * 100) / 100)

export interface VtResult {
  lines: Record<string, number>
  /** IN-112 Part I and Part II. */
  p1: Record<string, number>
  p2: Record<string, number>
  /** Children listed for the child tax credit. */
  ctcChildren: string[]
  retirementChoice: 'ss' | 'pension' | null
  /** IN-153, IN-117 (null without another state), IN-119 Parts I and II, RCC-146 lines (null without a claim). */
  in153: Record<string, number>
  in117: Record<string, number> | null
  in119: { p1: Record<string, number>; p2: Record<string, number> }
  rcc: Record<string, number> | null
  /** IN-113 Part II (exempt military pay), or null. */
  in113: Record<string, number> | null
  /** Line 15 as a fraction (1 = 100%). */
  adjustment: number
  /** Schedule HI-144 columns 1 and 3, and the household income (line z). */
  hi144: { c1: Record<string, number>; c3: Record<string, number>; z: number } | null
  issues: string[]
  attach: string[]
}

export function vtUseTaxEstimate(agi: number): number {
  if (agi <= 20000) return 0
  if (agi > 100000) return r(Math.min(150, agi * 0.0005))
  return 10 + 5 * Math.floor((Math.ceil(agi) - 20001) / 10000)
}

export function computeVermont(ret: TaxReturnInput, res: TaxReturnResult): VtResult {
  const d = ret.vt
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const L: Record<string, number> = {}
  const P1: Record<string, number> = {}
  const P2: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const agi = r(f['11a'])
  L['1'] = agi

  // ── IN-112 Part I ──
  P1['1'] = r(pos(f['2a']))
  P1['2'] = Math.min(P1['1'], r(pos(d.vtObligationInterest)))
  P1['3'] = P1['1'] - P1['2']
  P1['4'] = r(pos(d.bonusDepreciation))
  P1['6'] = P1['3'] + P1['4']
  P1['7'] = r(pos(d.usObligationInterest))
  // ── Schedule IN-153: capital gains exclusion ──
  const sd = res.scheduleD
  const G: Record<string, number> = {}
  G['1'] = r(pos(Math.min(sd.longTerm, sd.net)))
  G['2a'] = 0
  G['2b'] = r(pos(res.scheduleD19))
  G['3'] = G['2a'] + G['2b']
  G['4'] = pos(G['1'] - G['3'])
  G['7'] = 0
  G['8'] = pos(G['4'] - G['7'])
  G['9'] = Math.min(G['8'], 5000)
  if (d.capitalGainsMethod === 'percentage' && G['4'] > 0) {
    G['10'] = G['4']
    G['11'] = r(pos(d.cg.shortHeld))
    G['12'] = pos(G['10'] - G['11'])
    G['13a'] = r(pos(d.cg.homes))
    G['13b'] = r(pos(d.cg.personalProperty))
    G['13c'] = r(pos(d.cg.publicSecurities))
    G['14'] = G['13a'] + G['13b'] + G['13c']
    G['15'] = pos(G['12'] - G['14'])
    G['16'] = G['7']
    G['17'] = pos(G['15'] - G['16'])
    G['18'] = Math.min(r(G['17'] * 0.4), 350000)
  } else G['18'] = 0
  G['19'] = Math.max(G['9'], G['18'])
  G['fti'] = r(pos(f['15']))
  G['20'] = r(G['fti'] * 0.4)
  G['21'] = Math.min(G['19'], G['20'])
  P1['8'] = G['21']
  P1['9'] = r(pos(d.priorBonusDepreciation))
  P1['10'] = r(pos(d.taxableRefunds))
  // Medical deduction worksheet: federal Schedule A line 4 less Vermont line 6.
  const medicalA = r(pos(ret.itemized.medical - pos(agi) * 0.075))
  const people = owners.map(person)
  const boxes = sum(people.map((p) => ((p.age >= 65 || p.age65OrOlder) ? 1 : 0) + (p.blind ? 1 : 0)))
  L['4'] = VT_STANDARD[fs] + VT_ADDITIONAL * boxes
  L['5a'] = ret.canBeClaimedAsDependent ? 0 : 1
  L['5b'] = joint ? 1 : 0
  L['5c'] = ret.dependents.length
  L['5d'] = L['5a'] + L['5b'] + L['5c']
  L['5e'] = VT_EXEMPTION * L['5d']
  L['6'] = L['4'] + L['5e']
  P1['11'] = pos(pos(medicalA - r(pos(d.medicalNonAllowable))) - L['6'])
  // Retirement income exemption: Social Security or a public pension not covered by Social Security (up to $10,000).
  const full = joint ? 70000 : 55000
  const top = joint ? 80000 : 65000
  const share = agi < full ? 1 : agi < top ? factor(top, agi, 10000) : 0
  const ssExempt = r(pos(f['6b']) * share)
  const pensionExempt = r(Math.min(10000, pos(d.publicPension)) * share)
  let retirementChoice: VtResult['retirementChoice'] = null
  if (share > 0 && (ssExempt > 0 || pensionExempt > 0)) {
    retirementChoice = d.retirementChoice === 'ss' ? 'ss' : d.retirementChoice === 'pension' ? 'pension' : pensionExempt > ssExempt ? 'pension' : 'ss'
  }
  P1['12'] = retirementChoice === 'ss' ? ssExempt : retirementChoice === 'pension' ? pensionExempt : 0
  P1['13'] = agi <= 125000 ? r(pos(d.militaryRetirement)) : agi < 175000 ? r(pos(d.militaryRetirement) * factor(175000, agi, 50000)) : 0
  P1['14'] = r(pos(d.railroadRetirement))
  P1['15'] = r(pos(d.bondInterest))
  P1['16a'] = r(pos(d.studentLoanInterest))
  P1['16b'] = P1['16a'] > 0 ? r(pos(res.schedule1.adjustments.studentLoanInterest ?? 0)) : 0
  P1['16c'] = agi > (joint ? 200000 : 120000) ? 0 : pos(P1['16a'] - P1['16b'])
  P1['18'] = ['7', '8', '9', '10', '11', '12', '13', '14', '15', '16c'].reduce((s, k) => s + (P1[k] ?? 0), 0)
  P1['19'] = P1['6'] - P1['18']

  // ── IN-111 page 1 ──
  L['2'] = P1['19']
  L['3'] = L['1'] + L['2']
  L['7'] = pos(L['3'] - L['6'])
  const tableTax = vtTax(L['7'], fs)
  L['8'] = agi > 150000 ? Math.max(tableTax, r(0.03 * pos(agi - P1['7']))) : tableTax
  // ── Schedule IN-119 Part I ──
  const q = d.in119
  const A: Record<string, number> = {}
  A['1'] = r(pos(res.schedule2.earlyDistributionTax) + pos(res.schedule2.hsaAdditionalTax))
  A['2'] = r(pos(q.itcRecapture))
  A['3'] = r(pos(q.lumpSumTax))
  A['4'] = A['1'] + A['2'] + A['3']
  A['5'] = r(A['4'] * 0.24)
  A['6'] = r(pos(q.vtRecapture))
  A['7'] = A['5'] + A['6']
  A['8'] = r(pos(q.elderlyCredit))
  A['9'] = r(pos(q.vtInvestmentCredit))
  A['10'] = r(pos(q.farmAveraging))
  A['11'] = A['8'] + A['9'] + A['10']
  A['12'] = r(A['11'] * 0.24)
  A['13'] = r(pos(q.solarCarryforward))
  A['14'] = A['12'] + A['13']
  A['15'] = A['7'] - A['14']
  L['9'] = A['15']
  L['10'] = pos(L['8'] + L['9'])
  L['11'] = r(pos(ret.itemized.charityCash) + pos(ret.itemized.charityNonCash))
  L['12'] = r(Math.min(L['11'], 20000) * 0.05)
  L['13'] = Math.min(L['12'], 1000)
  L['14'] = pos(L['10'] - L['13'])
  // IN-113 Part II: exempt military pay.
  let in113: VtResult['in113'] = null
  let adjustment = 1
  if (pos(d.militaryPay) > 0) {
    const t: Record<string, number> = {}
    t['30'] = agi
    t['31'] = 0
    t['32'] = r(pos(d.militaryPay))
    t['33'] = t['31'] + t['32']
    t['34'] = t['30'] - t['33']
    adjustment = t['34'] <= 0 ? 0 : t['30'] <= 0 ? 1 : Math.round(t['34'] / t['30'] * 1e6) / 1e6
    t['35'] = adjustment
    in113 = t
  }
  L['15'] = adjustment
  L['16'] = r(L['14'] * adjustment)

  // ── Page 2 ──
  // ── Schedule IN-117 ──
  let in117: Record<string, number> | null = null
  const os = d.otherState
  if (pos(os.tax) > 0 && pos(os.income) > 0) {
    const K: Record<string, number> = {}
    K['2'] = Math.min(r(pos(os.income)), pos(agi))
    K['3'] = r(pos(os.bonusAdded))
    K['4'] = r(pos(os.muniInterest))
    K['5'] = K['2'] + K['3'] + K['4']
    K['6'] = r(pos(os.bonusSubtracted))
    K['7'] = r(pos(os.usInterest))
    K['8'] = K['6'] + K['7']
    K['9'] = K['5'] - K['8']
    K['10'] = pos(agi)
    K['11'] = P1['3']
    K['12'] = P1['4']
    K['13'] = K['10'] + K['11'] + K['12']
    K['14'] = P1['7']
    K['15'] = P1['9']
    K['16'] = K['14'] + K['15']
    K['17'] = K['13'] - K['16']
    K['18'] = L['14']
    K['19'] = K['17'] > 0 ? Math.min(K['18'], r(pos(K['9']) / K['17'] * K['18'])) : 0
    K['20'] = r(pos(os.tax))
    K['21'] = Math.min(K['19'], K['20'])
    in117 = K
  }
  L['17'] = in117?.['21'] ?? 0
  // ── Schedule IN-119 Part II ──
  const B: Record<string, number> = {}
  B['1a'] = r(pos(q.higherEdContribution))
  B['1b'] = r(B['1a'] * 0.1)
  for (const k of ['2', '3', '4', '5', '6', '7', '8']) {
    const c = q.credits[k]
    B[`${k}a`] = r(pos(c?.earned ?? 0))
    B[`${k}b`] = r(pos(c?.carry ?? 0))
    B[`${k}c`] = B[`${k}a`] + B[`${k}b`]
  }
  B['9'] = B['1b'] + ['2', '3', '4', '5', '6', '7', '8'].reduce((t, k) => t + B[`${k}c`], 0)
  L['18'] = B['9']
  L['19'] = L['17'] + L['18']
  L['20'] = pos(L['16'] - L['19'])
  const seEarnings = sum(res.scheduleSE.filter((x) => owners.includes(x.owner)).map((x) => pos(x.netEarnings)))
  L['21'] = r(pos(seEarnings - pos(d.seOutsideVt)) * 0.0011)
  L['22'] = d.useTax.mode === 'estimate' ? vtUseTaxEstimate(agi) : d.useTax.mode === 'amount' ? r(pos(d.useTax.amount)) : 0
  L['23'] = L['20'] + L['21'] + L['22']
  for (const k of ['24a', '24b', '24c', '24d']) L[k] = r(pos(d.contributions[k] ?? 0))
  L['24e'] = L['24a'] + L['24b'] + L['24c'] + L['24d']
  L['25'] = L['23'] + L['24e']

  // ── IN-112 Part II ──
  P2['1'] = r(pos(res.form2441.credit))
  P2['2'] = r(P2['1'] * 0.72)
  const young = ret.dependents.filter((x) => x.childRelationship && x.age <= 6 && x.monthsLivedWithYou > 6)
  P2['3'] = young.length
  P2['4'] = P2['3'] * vtChildCreditPerChild(agi)
  P2['5'] = res.eic.qualifyingChildren
  P2['6'] = r(pos(f['27a']))
  P2['7'] = P2['6'] > 0 ? (P2['5'] > 0 ? r(P2['6'] * 0.38) : P2['6']) : 0
  if (d.veteran) {
    P2['8'] = agi
    P2['9'] = agi <= 25000 ? 0 : agi - 25000
    P2['10'] = Math.floor(P2['9'] / 100)
    P2['11'] = P2['10'] * 5
    P2['12'] = P2['9'] === 0 ? 250 : pos(250 - P2['11'])
  } else P2['12'] = 0
  P2['13'] = P2['2'] + P2['4'] + P2['7'] + P2['12']

  // ── Payments ──
  L['26a'] = r(sum(ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => pos(d.w2[w.id]?.stateTax ?? 0)))
    + sum(ret.retirement.filter((x) => owners.includes(x.owner)).map((x) => pos(d.r1099[x.id]?.stateTax ?? 0))))
  L['26b'] = r(pos(d.estimatedPayments))
  L['26c'] = P2['13']
  L['26d'] = r(pos(d.realEstateWithholding))
  L['26e'] = 0
  L['26f'] = L['26a'] + L['26b'] + L['26c'] + L['26d'] + L['26e']
  L['27'] = pos(L['26f'] - L['25'])
  L['28a'] = Math.min(r(pos(d.creditForward)), L['27'])
  L['28b'] = Math.min(r(pos(d.propertyTaxCredit)), L['27'] - L['28a'])
  L['29'] = L['27'] - L['28a'] - L['28b']
  L['30'] = pos(L['25'] - L['26f'])
  L['31'] = 0
  L['32'] = L['30'] + L['31']

  // ── Schedule HI-144 ──
  let hi144: VtResult['hi144'] = null
  const h = d.homestead
  if (h.file && h.claimCredit) {
    const c1: Record<string, number> = {}
    const c3: Record<string, number> = {}
    const usInt = Math.min(P1['7'], r(pos(f['2b'])))
    c1.a = r(pos(h.publicAssistance))
    c1.b = r(sum(ret.socialSecurity.filter((x) => owners.includes(x.owner)).map((x) => pos(x.netBenefits))) + pos(h.otherBenefits))
    c1.c = r(pos(res.schedule1.unemployment) + pos(h.workersComp))
    c1.d = r(sum(ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => pos(w.wages))))
    c1.e = r(pos(f['2b']) + pos(f['3b'])) - usInt
    c1.f = r(pos(f['2a'])) + usInt
    c1.g = r(pos(h.alimony))
    c1.h = r(pos(h.childSupportAndGifts))
    c1.i = r(pos(sum(res.scheduleC.filter((x) => owners.includes(x.owner)).map((x) => x.netProfit))))
    c1.j = r(pos(f['7a']))
    c1.k = r(pos(f['4b']) + pos(f['5b']))
    c1.l = r(sum(res.scheduleE.properties.map((p) => pos(p.net))))
    c1.m = r(pos(h.passThroughIncome))
    c1.n = r(pos(res.schedule1.otherIncome) + pos(res.schedule1.otherGains) + pos(d.taxableRefunds) + pos(h.otherIncome))
    c1.o = sum('abcdefghijklmn'.split('').map((k) => c1[k]))
    c1.p = r(sum(ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => pos(w.socialSecurityWithheld) + pos(w.medicareWithheld)))
      + sum(res.scheduleSE.filter((x) => owners.includes(x.owner)).map((x) => pos(x.total))))
    c1.q = r(pos(h.childSupportPaid))
    c1.r1 = 0
    c1.r2 = r(pos(h.alimonyPaid))
    c1.r3 = r(pos(res.schedule1.adjustments.selfEmployedHealthInsurance ?? 0))
    c1.r4 = r(pos(res.schedule1.adjustments.hsaDeduction ?? 0))
    c1.s = c1.p + c1.q + c1.r1 + c1.r2 + c1.r3 + c1.r4
    c1.t = pos(c1.o - c1.s)
    c3.n = r(pos(h.otherPeopleIncome))
    c3.o = c3.n
    c3.t = c3.o
    const u = c1.t + c3.t
    // Lines v–y: interest and dividends over $10,000 (claimants born on or after Jan. 1, 1961).
    const under65 = owners.some((o) => person(o).age > 0 && person(o).age < 65 && !person(o).age65OrOlder)
    c1.v = under65 ? c1.e + c1.f : 0
    c1.u = u
    c1.w = c1.v
    c1.y = pos(c1.w - 10000)
    hi144 = { c1, c3, z: u + c1.y }
    if (hi144.z > 115400) issues.push(`Household income of $${hi144.z.toLocaleString('en-US')} is over $115,400, so no property tax credit is allowed; the homestead declaration still has to be filed.`)
  }

  // ── RCC-146 lines 10–14 ──
  let rcc: Record<string, number> | null = null
  if (d.renter.claim) {
    rcc = {}
    rcc['8'] = L['5d']
    rcc['10'] = r(f['9'])
    rcc['11'] = r(pos(f['6a'] - f['6b']) * 0.75)
    rcc['12'] = r(pos(f['2a']))
    rcc['13'] = r(pos(-f['7a']) + pos(-res.scheduleC.reduce((t, x) => t + x.netProfit, 0)) + pos(-res.schedule1.otherGains) + pos(-res.schedule1.rentalIncome))
    rcc['14'] = rcc['10'] + rcc['11'] + rcc['12'] + rcc['13']
  }

  // ── Notes ──
  attach.push('A complete copy of your federal Form 1040 with all schedules')
  if (L['26a'] > 0) attach.push('State copies of W-2s and 1099s showing Vermont tax withheld')
  if (L['17'] > 0) attach.push(`A copy of your ${os.state.trim() || 'other state'} return (Schedule IN-117)`)
  if (B['9'] > 0) attach.push('Credit certificates and approval letters for the IN-119 Part II credits')
  if (L['26d'] > 0) attach.push('Form RW-171 Schedule A')
  if (P2['1'] > 0) attach.push('Federal Form 2441')
  if (d.veteran) attach.push('Your discharge record (DD-214), if asked')
  if (in113 && d.militaryPay > 0) attach.push('A copy of your active-duty orders (exempt military pay)')
  if (!/^\d{3}$/.test(d.schoolCode.trim())) issues.push('Enter your 3-digit Vermont school district code (required; see the list in the instructions).')
  if (P1['8'] > 0 && d.capitalGainsMethod === 'flat') issues.push(`Capital gains exclusion: the flat exclusion of ${'$'}${P1['8'].toLocaleString('en-US')} is used. Gains on business assets held more than three years (not homes, publicly traded securities or depreciable personal property) may qualify for 40% instead (IN-153 Part II).`)
  if (pos(os.tax) > 0 && !(pos(os.income) > 0)) issues.push('Schedule IN-117 needs the income taxed by the other state (line 2).')
  if (B['1b'] > 0) issues.push('The higher education investment credit is 10% of contributions up to $2,500 per beneficiary; check the IN-119 instructions for the limit.')
  if (d.renter.claim && !/^\d{11}$/.test(digitsOf(d.renter.span))) issues.push('RCC-146 needs the 11-digit SPAN of your rental unit (tax.vermont.gov/span-finder).')
  if (d.renter.claim && d.renter.monthsRented < 6) issues.push('The renter credit requires renting in Vermont for at least six months of 2025.')
  if (retirementChoice) issues.push(`Retirement income exemption: ${retirementChoice === 'ss' ? 'taxable Social Security' : 'the public pension'} is exempted${share < 1 ? ` at ${Math.round(share * 100)}% (AGI between ${'$'}${full.toLocaleString('en-US')} and ${'$'}${top.toLocaleString('en-US')})` : ''}; only one can be chosen.`)
  if (agi > 150000 && L['8'] > tableTax) issues.push('Vermont’s minimum tax applies: 3% of AGI (less U.S. interest) is more than the tax from the rate schedule.')
  if (A['1'] > 0) issues.push('Line 9 includes 24% of the federal additional tax on early retirement or HSA distributions (Schedule IN-119).')
  if (L['32'] > 500) issues.push('Tax due after withholding is $500 or more: you may owe interest and penalty for underpaid estimates (Worksheet IN-152, not prepared here).')
  if (d.useTax.mode === 'none') issues.push('Line 22: you certify that no use tax is due on internet, mail-order or out-of-state purchases.')
  if (h.file && !h.span.replace(/\D/g, '').match(/^\d{11}$/)) issues.push('HS-122 needs the 11-digit SPAN from your property tax bill.')
  return { lines: L, p1: P1, p2: P2, in153: G, in117, in119: { p1: A, p2: B }, rcc, ctcChildren: young.map((x) => x.id), retirementChoice, in113, adjustment, hi144, issues, attach }
}
