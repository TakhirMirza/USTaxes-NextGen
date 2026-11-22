/**
 * North Dakota Form ND-1, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form ND-1 (SFN 28702, 12-2025), the 2025 individual income tax booklet and the 2025 tax table.
 *  - Starts from federal taxable income (Form 1040 line 11 minus line 14; a negative amount is kept).
 *  - Additions: planned gift / endowment adjustment, Schedule ND-1SA additions.
 *  - Subtractions: U.S. interest; 40% of the net long-term capital gain; Native American reservation income;
 *    Railroad Retirement Board benefits; licensed peace officer retirement; military pay; College SAVE deposits
 *    (up to $5,000 / $10,000 joint); 40% of qualified dividends; military retirement; taxable Social Security;
 *    Schedule ND-1SA subtractions.
 *  - Tax: 0% / 1.95% / 2.5% with the zero bracket to $48,475 single, $80,975 joint, $40,475 separate, $64,950 head of
 *    household. Under $100,000 the tax table taxes the middle of each $50 row.
 *  - Credits: other state (Schedule ND-1CR), marriage penalty credit (up to $312), Schedule ND-1TC credits.
 * Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)
type FS = TaxReturnInput['filingStatus']

/** Rate schedule: zero bracket top, 1.95% bracket top and the tax at that top. */
const SCHEDULE: Record<'s' | 'j' | 'm' | 'h', [number, number, number]> = {
  s: [48475, 244825, 3828.83], j: [80975, 298075, 4233.45], m: [40475, 149025, 2116.73], h: [64950, 271450, 4026.75]
}
const key = (fs: FS): 's' | 'j' | 'm' | 'h' => (fs === 'mfj' || fs === 'qss' ? 'j' : fs === 'mfs' ? 'm' : fs === 'hoh' ? 'h' : 's')
/** Exact rate-schedule tax (cents). */
export function ndScheduleTax(x: number, k: 's' | 'j' | 'm' | 'h'): number {
  const [zero, mid, base] = SCHEDULE[k]
  if (x <= zero) return 0
  if (x <= mid) return (x - zero) * 0.0195
  return base + (x - mid) * 0.025
}
const half = (x: number): number => Math.floor(x + 0.5 + 1e-9)

/** Line 20: the tax table under $100,000 (middle of each $50 row), the rate schedule from $100,000. */
export function ndTax(taxable: number, fs: FS): number {
  const x = pos(Math.floor(taxable))
  if (x < 100000) return half(ndScheduleTax(Math.floor(x / 50) * 50 + 25, key(fs)))
  return half(ndScheduleTax(x, key(fs)))
}

export interface NdResult {
  lines: Record<string, number>
  /** Schedule ND-1SA lines. */
  sa: Record<string, number>
  /** Marriage penalty credit worksheet, or null when it doesn’t apply. */
  marriage: Record<string, number> | null
  /** Net long-term capital gain exclusion worksheet. */
  cg: Record<string, number>
  issues: string[]
  attach: string[]
}

export function computeNorthDakota(ret: TaxReturnInput, res: TaxReturnResult): NdResult {
  const d = ret.nd
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []

  L['1a'] = r(f['11a'])
  L['1b'] = r(f['11a'] - f['14'])
  L['2'] = r(pos(d.plannedGift))
  // ── Schedule ND-1SA ──
  const S: Record<string, number> = {}
  const a = d.sa
  S['1'] = r(pos(a.lumpSum))
  S['2'] = r(pos(a.sCorpLoss))
  S['3'] = S['1'] + S['2']
  S['4'] = r(pos(a.renaissance))
  S['5'] = r(pos(a.newBusiness))
  S['6'] = Math.min(10000, r(pos(a.organDonor)))
  S['7'] = r(pos(a.workforce))
  S['8a'] = 5241 * Math.max(0, Math.round(a.stillborn))
  S['9'] = r(pos(a.collegeReimbursement))
  S['10'] = r(pos(a.sCorpIncome))
  S['11'] = S['4'] + S['5'] + S['6'] + S['7'] + S['8a'] + S['9'] + S['10']
  L['3'] = S['3']
  L['4a'] = L['2'] + L['3']
  L['4b'] = L['1b'] + L['4a']
  L['5'] = r(pos(d.usObligationInterest))
  // Net long-term capital gain exclusion worksheet.
  const sd = res.scheduleD
  const cg: Record<string, number> = {}
  cg['1'] = r(sd.longTerm)
  cg['2'] = r(sd.net)
  cg['3'] = cg['1'] > 0 && cg['2'] > 0 ? Math.min(cg['1'], cg['2']) : 0
  cg['5'] = cg['3']
  cg['6'] = Math.min(cg['5'], r(pos(d.gainInOtherLines)))
  cg['7'] = cg['5'] - cg['6']
  cg['8'] = r(cg['7'] * 0.4)
  L['6'] = cg['8']
  L['7'] = r(pos(d.nativeAmerican))
  const railroad = sum(owners.map((o) => pos(d.railroad[o] ?? 0)))
  L['8'] = r(railroad)
  L['9'] = r(pos(d.peaceOfficer))
  L['10'] = 0
  L['11'] = r(pos(d.militaryPay))
  L['12'] = Math.min(r(pos(d.collegeSave)), joint ? 10000 : 5000)
  L['13'] = r(pos(f['3a']) * 0.4)
  L['14'] = r(pos(d.militaryRetirement))
  L['15'] = r(pos(f['6b'] - pos(d.rrbTier1InSs)))
  L['16'] = S['11']
  L['17'] = ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'].reduce((s, k) => s + L[k], 0)
  L['18'] = pos(L['4b'] - L['17'])
  L['19'] = L['18']
  L['20'] = ndTax(L['19'], fs)

  // ── Credits ──
  L['21'] = r(pos(d.otherStateCredit))
  let marriage: NdResult['marriage'] = null
  if (joint && L['18'] > 81036) {
    const wagesBy = (o: Owner): number => sum(ret.w2s.filter((w) => w.owner === o).map((w) => w.wages))
    const seBy = (o: Owner): number => sum(res.scheduleC.filter((x) => x.owner === o).map((x) => x.netProfit)) - sum(res.scheduleSE.filter((x) => x.owner === o).map((x) => x.total / 2))
    const retBy = (o: Owner): number => sum(ret.retirement.filter((x) => x.owner === o).map((x) => pos(x.taxableAmount)))
    // Social Security is taken out again on line 15, so it never counts; railroad benefits (line 8) are taken out too.
    const q = (o: Owner): number => r(pos(wagesBy(o) + seBy(o) + retBy(o) - pos(d.railroad[o] ?? 0)))
    const m: Record<string, number> = {}
    m['1'] = L['18']
    m['3a'] = q('taxpayer')
    m['3b'] = q('spouse')
    m['4'] = Math.min(m['3a'], m['3b'])
    if (m['4'] > 47550) {
      m['5'] = 15750
      m['6'] = m['4'] - m['5']
      m['7'] = half(ndScheduleTax(m['6'], 's'))
      m['8'] = m['1'] - m['6']
      m['9'] = half(ndScheduleTax(m['8'], 's'))
      m['10'] = half(ndScheduleTax(m['1'], 'j'))
      m['11'] = m['7'] + m['9']
      m['12'] = pos(m['10'] - m['11'])
      m['13'] = 312
      m['14'] = Math.min(m['12'], 312)
      marriage = m
    }
  }
  L['22'] = marriage?.['14'] ?? 0
  L['23'] = r(pos(d.otherCredits))
  L['24'] = L['21'] + L['22'] + L['23']
  L['25'] = pos(L['20'] - L['24'])

  // ── Payments ──
  L['26'] = r(sum(ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => pos(d.w2[w.id]?.stateTax ?? 0)))
    + sum(ret.retirement.filter((x) => owners.includes(x.owner)).map((x) => pos(d.r1099[x.id]?.stateTax ?? 0))) + pos(d.otherWithholding))
  L['27'] = r(pos(d.estimatedPayments))
  L['28'] = L['26'] + L['27']
  const over = L['28'] - L['25']
  L['29'] = over >= 5 ? over : 0
  L['30'] = Math.min(r(pos(d.creditForward)), L['29'])
  const fund = (k: string): number => r(pos(d.contributions[k] ?? 0))
  const funds = fund('veterans') + fund('wildlife') + fund('trees')
  if (L['29'] > 0) {
    L['31v'] = fund('veterans'); L['31w'] = fund('wildlife'); L['31t'] = fund('trees')
    L['31'] = Math.min(funds, L['29'] - L['30'])
    const refund = L['29'] - L['30'] - L['31']
    L['32'] = refund >= 5 ? refund : 0
    L['33'] = 0; L['35'] = 0; L['36'] = 0
  } else {
    L['31'] = 0; L['32'] = 0
    const due = L['25'] - L['28']
    L['33'] = due >= 5 ? due : 0
    L['35v'] = fund('veterans'); L['35w'] = fund('wildlife'); L['35t'] = fund('trees')
    L['35'] = funds
    L['36'] = L['33'] + L['35']
  }

  // ── Notes ──
  attach.push('A complete copy of your 2025 federal return')
  if (L['26'] > 0) attach.push('W-2s, 1099s and North Dakota Schedules K-1 showing North Dakota withholding')
  if (S['4'] + S['5'] > 0) attach.push('Property Tax Clearance Record from each county where you own 50% or more of real property')
  if (S['4'] > 0) attach.push('Schedule RZ (renaissance zone)')
  if (S['7'] > 0 || S['9'] > 0) attach.push('Your employer’s statement (workforce recruitment / college expense reimbursement)')
  if (S['6'] > 0) issues.push('The organ donor deduction is limited to $10,000 of qualified expenses.')
  if (S['8a'] > 0 && !/^\d{11}$/.test(a.stillbornCertificate.replace(/\D/g, ''))) issues.push('Enter the 11-digit certificate number from the Certification of Fetal Death (ND-1SA line 8b).')
  if ((S['4'] + S['5'] > 0) && a.ownsNdRealProperty && !a.counties.trim()) issues.push('ND-1SA: list each North Dakota county where you or your spouse own 50% or more of real property.')
  if (L['21'] > 0) attach.push('Schedule ND-1CR and a copy of the other state’s return')
  if (L['23'] > 0) attach.push('Schedule ND-1TC (tax credits)')
  if (L['2'] > 0) attach.push('Schedule ND-1PG / ND-1QEC (planned gift or endowment credit)')
  if (L['11'] + L['14'] > 0) attach.push('W-2s / 1099-Rs showing the military pay or retirement')
  if (L['9'] > 0) attach.push('Form 1099-R and the peace officer service documentation')
  if (!/^\d{5}$/.test(d.schoolCode.replace(/\D/g, ''))) issues.push('Enter your 5-digit school district code (Item B; list on page 19 of the instructions).')
  if (!d.incomeSourceCode) issues.push('Choose the income source code (Item C) for where most of your North Dakota income came from.')
  if (L['13'] > 0) issues.push('Line 13 excludes 40% of your qualified dividends.')
  if (L['6'] > 0) issues.push('Line 6 excludes 40% of your net long-term capital gain.')
  if (marriage && L['22'] > 0) issues.push(`Marriage penalty credit: ${'$'}${L['22']} (both spouses had qualified income over $47,550).`)
  return { lines: L, sa: S, marriage, cg, issues, attach }
}
