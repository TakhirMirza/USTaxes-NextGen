/**
 * Hawaii Form N-11, individual income tax return (resident), tax year 2025.
 *
 * Source: 2025 Form N-11 and its instructions: federal AGI plus Hawaii additions (COLA / ERS wage difference,
 * out-of-state bond interest) less Hawaii subtractions (qualifying employer-funded and government pensions, Social
 * Security, up to $8,636 of reserve / Guard pay, individual housing account, U.S. obligation interest); the standard
 * deduction ($4,400 / $8,800 / $6,424, dependents limited to the greater of $500 or earned income) or Hawaii itemized
 * deductions (Worksheets A-1 to A-4, no SALT cap, income taxes only under the AGI limits, the limitation above
 * $166,800 / $83,400); $1,144 per exemption ($7,000 for a blind, deaf or disabled taxpayer); the 2025 tax table
 * ($50 rows at the midpoint, under $100,000) or tax rate schedules, with the 7.25% capital gains alternative. Whole
 * dollars.
 */
import type { HiRetirementKind, Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n + 1e-9)
const pos = (n: number): number => Math.max(0, n)

type Sched = [number, number, number][]
const SCHEDULES: Record<'I' | 'II' | 'III', Sched> = {
  I: [[0, 0, 0.014], [9600, 134, 0.032], [14400, 288, 0.055], [19200, 552, 0.064], [24000, 859, 0.068], [36000, 1675, 0.072], [48000, 2539, 0.076], [125000, 8391, 0.079], [175000, 12341, 0.0825], [225000, 16466, 0.09], [275000, 20966, 0.1], [325000, 25966, 0.11]],
  II: [[0, 0, 0.014], [19200, 269, 0.032], [28800, 576, 0.055], [38400, 1104, 0.064], [48000, 1718, 0.068], [72000, 3350, 0.072], [96000, 5078, 0.076], [250000, 16782, 0.079], [350000, 24682, 0.0825], [450000, 32932, 0.09], [550000, 41932, 0.1], [650000, 51932, 0.11]],
  III: [[0, 0, 0.014], [14400, 202, 0.032], [21600, 432, 0.055], [28800, 828, 0.064], [36000, 1289, 0.068], [54000, 2513, 0.072], [72000, 3809, 0.076], [187500, 12587, 0.079], [262500, 18512, 0.0825], [337500, 24699, 0.09], [412500, 31449, 0.1], [487500, 38949, 0.11]]
}
const schedFor = (fs: TaxReturnInput['filingStatus']): Sched => SCHEDULES[fs === 'mfj' || fs === 'qss' ? 'II' : fs === 'hoh' ? 'III' : 'I']
const schedule = (x: number, s: Sched): number => {
  let row = s[0]
  for (const b of s) if (x > b[0]) row = b
  return row[1] + (x - row[0]) * row[2]
}

/** Line 27: the 2025 tax table ($50 rows taxed at the midpoint) under $100,000, the tax rate schedules above. */
export function hiTax(taxable: number, fs: TaxReturnInput['filingStatus']): number {
  const x = Math.max(0, Math.floor(taxable))
  const s = schedFor(fs)
  if (x >= 100000) return r(schedule(x, s))
  return r(schedule(Math.floor(x / 50) * 50 + 25, s))
}

/** Refundable food/excise tax credit per qualified exemption (HRS §235-55.85), by federal AGI. */
export function hiFoodCreditPer(agi: number, fs: TaxReturnInput['filingStatus']): number {
  const rows: [number, number][] = [[15000, 220], [20000, 200], [25000, 170], [30000, 140], [40000, 110], [50000, 90], [60000, 70]]
  const limit = fs === 'single' ? 40000 : 60000
  if (agi >= limit) return 0
  for (const [top, amt] of rows) if (agi < top) return amt
  return 0
}

/** Schedule X line 27: child and dependent care decimal by Hawaii AGI. */
export function hiCareDecimal(agi: number): number {
  if (agi <= 25000) return 0.25
  if (agi > 50000) return 0.15
  return 0.25 - 0.01 * Math.ceil((agi - 25000) / 5000)
}

const STANDARD: Record<TaxReturnInput['filingStatus'], number> = { single: 4400, mfj: 8800, mfs: 4400, hoh: 6424, qss: 8800 }

export interface HiResult {
  lines: Record<string, number>
  /** Schedule X lines. */
  x: Record<string, number>
  exemptions: { a: number; b: number; c: number; d: number; e: number }
  itemize: boolean
  capitalGains: boolean
  dependentBox: boolean
  issues: string[]
  attach: string[]
}

export function computeHawaii(ret: TaxReturnInput, res: TaxReturnResult): HiResult {
  const d = ret.hi
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const dependent = ret.canBeClaimedAsDependent
  const old = (p: TaxReturnInput['taxpayer']): boolean => p.age >= 65 || p.age65OrOlder

  // ── Exemptions (6a–6e) ──
  const ex = {
    a: dependent ? 0 : 1 + (old(ret.taxpayer) ? 1 : 0),
    b: joint ? 1 + (old(ret.spouse) ? 1 : 0) : 0,
    c: ret.dependents.filter((x) => x.childRelationship && x.monthsLivedWithYou > 6).length,
    d: 0,
    e: 0
  }
  ex.d = ret.dependents.length - ex.c
  ex.e = ex.a + ex.b + ex.c + ex.d

  // ── Hawaii AGI ──
  L['7'] = r(f['11a'])
  L['8'] = r(d.wageDifference)
  L['9'] = r(pos(d.otherStateBondInterest))
  L['10'] = r(d.otherAdditions)
  L['11'] = L['8'] + L['9'] + L['10']
  L['12'] = L['7'] + L['11']
  const kind = (id: string): HiRetirementKind => d.retirementKind[id] ?? 'standard'
  const mine = ret.retirement.filter((x) => owners.includes(x.owner))
  L['13'] = r(mine.filter((x) => kind(x.id) === 'employer' && !/[1]/.test(x.code)).reduce((s, x) => s + pos(x.taxableAmount), 0))
  L['14'] = r(pos(f['6b']))
  L['15'] = Math.min(8636, r(pos(d.guardPay)))
  L['16'] = r(pos(d.housingAccount))
  L['17'] = 0
  L['18'] = r(pos(d.usObligationInterest) + pos(d.otherSubtractions))
  L['19'] = ['13', '14', '15', '16', '17', '18'].reduce((s, k) => s + L[k], 0)
  L['20'] = L['12'] - L['19']

  // ── Deductions ──
  const it = ret.itemized
  const agiLimit = fs === 'single' || fs === 'mfs' ? 100000 : fs === 'hoh' ? 150000 : 200000
  L['21a'] = r(pos(pos(it.medical) - pos(L['20']) * 0.075))
  L['21b'] = r((L['7'] < agiLimit ? pos(it.stateLocalIncomeOrSalesTax) : 0) + pos(it.realEstateTax) + pos(it.personalPropertyTax))
  L['21c'] = r(pos(res.scheduleA.interest))
  L['21d'] = r(pos(res.scheduleA.charity))
  L['21e'] = 0
  L['21f'] = 0
  let total = L['21a'] + L['21b'] + L['21c'] + L['21d'] + L['21e'] + L['21f']
  const limitAt = fs === 'mfs' ? 83400 : 166800
  if (L['20'] > limitAt && total > 0) {
    const protectedAmt = L['21a'] + L['21e']
    const room = pos(total - protectedAmt) * 0.8
    total -= Math.min(room, (L['20'] - limitAt) * 0.03)
    total = r(total)
  }
  const earned = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + pos(w.wages), 0) + res.scheduleC.filter((b) => owners.includes(b.owner)).reduce((s, b) => s + pos(b.netProfit), 0)
  const standard = dependent ? Math.min(STANDARD[fs], Math.max(500, r(earned))) : STANDARD[fs]
  const itemize = total > standard
  L['22'] = itemize ? total : 0
  L['23'] = itemize ? 0 : standard
  if (!itemize) for (const k of ['21a', '21b', '21c', '21d', '21e', '21f']) L[k] = 0
  L['24'] = L['20'] - (itemize ? L['22'] : L['23'])

  // ── Exemptions and tax ──
  const disabledOwners = owners.filter((o) => d.disabled[o])
  if (disabledOwners.length) {
    const others = owners.filter((o) => !d.disabled[o]).reduce((s, o) => s + 1 + (old(person(o)) ? 1 : 0), 0)
    L['25'] = 7000 * disabledOwners.length + 1144 * others
  } else {
    L['25'] = 1144 * ex.e
  }
  L['26'] = pos(L['24'] - L['25'])
  const regular = hiTax(L['26'], fs)
  const ncg = Math.min(L['26'], pos(Math.min(r(f['7a']), r(res.scheduleD.longTerm))))
  let capitalGains = false
  L['27'] = regular
  if (ncg > 0) {
    const alt = hiTax(L['26'] - ncg, fs) + r(ncg * 0.0725)
    if (alt < regular) { L['27'] = alt; L['27a'] = ncg; capitalGains = true }
  }

  // ── Credits ──
  // Line 28: refundable food/excise tax credit (Form N-311): taxpayer, spouse and dependents, no extra 65-or-older exemptions.
  const foodExemptions = dependent ? 0 : (joint ? 2 : 1) + ret.dependents.length
  L['28ex'] = foodExemptions
  L['28'] = foodExemptions * hiFoodCreditPer(L['7'], fs)
  // Line 29: credit for low-income household renters (Schedule X Part I).
  const X: Record<string, number> = {}
  X['5'] = r(pos(d.rentPaid))
  X['6'] = r(pos(d.rentExclusions))
  X['7'] = X['5'] - X['6']
  X['8'] = (joint ? 2 : 1) + ret.dependents.length
  X['9'] = old(ret.taxpayer) ? 1 : 0
  X['10'] = joint && old(ret.spouse) ? 1 : 0
  X['11'] = X['8'] + X['9'] + X['10']
  X['12'] = !dependent && L['20'] < 30000 && X['7'] > 1000 ? 50 * X['11'] : 0
  L['29'] = X['12']
  // Line 30: credit for child and dependent care expenses (Schedule X Part II, Section C).
  const persons = res.form2441.qualifyingPersons
  const earnedOf = (o: Owner): number => r(ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + pos(w.wages), 0) + res.scheduleC.filter((b) => b.owner === o).reduce((s, b) => s + pos(b.netProfit), 0))
  const cap = persons >= 2 ? 20000 : 10000
  const expenses = r(pos(ret.dependentCare.expenses))
  const benefits = r(pos(ret.dependentCare.employerBenefits))
  const eT = earnedOf('taxpayer')
  const eS = joint ? earnedOf('spouse') : eT
  if (persons > 0 && benefits > 0) {
    // Section B: dependent care benefits (no amounts from a sole proprietorship or partnership).
    X['B2'] = benefits; X['B5'] = benefits; X['B6'] = expenses
    X['B7'] = Math.min(X['B5'], X['B6']); X['B8'] = eT; X['B9'] = eS
    X['B10'] = Math.min(X['B7'], X['B8'], X['B9']); X['B11'] = fs === 'mfs' ? 2500 : 5000
    X['B12'] = 0; X['B13'] = X['B5'] - X['B12']; X['B14'] = 0
    X['B15'] = Math.min(X['B10'], X['B11']); X['B16'] = pos(X['B13'] - X['B15'])
    X['B17'] = cap; X['B18'] = X['B14'] + X['B15']; X['B19'] = pos(X['B17'] - X['B18'])
    X['B20'] = pos(expenses - X['B18'])
  }
  X['21'] = persons > 0 ? ('B20' in X ? X['B20'] : expenses) : 0
  X['22'] = persons > 0 ? ('B19' in X ? Math.min(X['B19'], X['B20']) : Math.min(expenses, cap)) : 0
  X['23'] = eT
  X['24'] = eS
  X['25'] = pos(Math.min(X['22'], X['23'], X['24']))
  X['26'] = L['20']
  X['27'] = hiCareDecimal(L['20'])
  X['28'] = fs === 'mfs' ? 0 : r(X['25'] * X['27'])
  L['30'] = X['28']
  L['31'] = 25 * pos(Math.floor(d.carSeats))
  // Line 32: Schedule CR line 11: the refundable earned income tax credit (40% of federal, Form N-356) plus other refundable credits.
  L['eitc'] = r(pos(f['27a']) * 0.4)
  L['32'] = L['eitc'] + r(pos(d.refundableCredits))
  L['33'] = L['28'] + L['29'] + L['30'] + L['31'] + L['32']
  L['34'] = L['27'] - L['33']
  L['35'] = Math.min(pos(L['34']), r(pos(d.nonrefundableCredits)))
  L['36'] = L['34'] - L['35']

  // ── Payments ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['37'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0) + pos(d.withholdingOther))
  L['38'] = r(pos(d.estimatedPayments))
  L['39'] = r(pos(d.priorYearApplied))
  L['40'] = r(pos(d.extensionPayment))
  L['41'] = L['37'] + L['38'] + L['39'] + L['40']
  L['42'] = pos(L['41'] - L['36'])
  const give = (m: Record<Owner, boolean>, amt: number): number => owners.filter((o) => m[o]).length * amt
  L['44'] = L['42'] > 0 ? give(d.schools, 2) + give(d.libraries, 5) + give(d.violence, 5) : 0
  if (L['44'] > L['42']) L['44'] = 0
  L['45'] = L['42'] - L['44']
  L['46'] = Math.min(L['45'], r(pos(d.creditForward)))
  L['47a'] = L['45'] - L['46']
  L['48'] = pos(L['36'] - L['41'])
  L['49'] = L['48']

  // ── Notes ──
  attach.push('Your W-2s and 1099-Gs / N-2s showing Hawaii tax withheld')
  if (L['28'] > 0) attach.push('Form N-311 (refundable food/excise tax credit)')
  if (L['29'] + L['30'] > 0) attach.push('Schedule X, both pages (renters / child and dependent care credits)')
  if (L['30'] > 0) issues.push('Schedule X Part II: list each care provider (name, address, SSN or FEIN, Hawaii tax ID, amount) and each child’s grade.')
  if (L['29'] > 0) issues.push('Schedule X Part I line 4: list each rental unit, the months you lived there and the owner.')
  if (L['31'] > 0) attach.push('A copy of the child passenger restraint invoice')
  if (L['eitc'] > 0) attach.push('Form N-356 (earned income tax credit, 40% of your federal credit)')
  if (L['32'] + L['35'] > 0) attach.push('Schedule CR (tax credits)')
  if (L['32'] - L['eitc'] > 0 || L['35'] > 0) attach.push('The forms for each other credit on Schedule CR')
  if (L['32'] - L['eitc'] > 0 || L['35'] > 0) issues.push('Fill in the other credit lines on Schedule CR yourself; only the earned income tax credit (line 8) and the totals are entered.')
  if (disabledOwners.length) attach.push('Form N-172 (physician’s certification) if not filed before')
  if (capitalGains) attach.push('The Capital Gains Tax Worksheet (keep with your records)')
  if (mine.some((x) => x.taxableAmount > 0) && Object.keys(d.retirementKind).length === 0) issues.push('Mark employer-funded and government pensions among your 1099-Rs: Hawaii does not tax them (line 13). IRA and 401(k) distributions from your own contributions are taxed.')
  if (L['34'] < 0) issues.push('Your refundable credits are more than your tax: the difference is refunded (line 34 is negative).')
  if (disabledOwners.length && ret.dependents.length) issues.push('With the $7,000 disability exemption you cannot also claim exemptions for dependents.')
  if (res.scheduleC.length || ret.rentals.length) issues.push('Lines 51–52: enter your Hawaii gross receipts or rents and your Hawaii Tax I.D. (GE) number for each business or rental yourself.')
  if (ret.dependents.length > 6) issues.push('More than six dependents: attach a list.')
  if (L['48'] > 0 && L['38'] === 0 && L['48'] > L['36'] * 0.1) issues.push('A balance due may mean an estimated tax penalty (Form N-210).')
  issues.push('Hawaii’s fill-in N-11 prints a 2D barcode only from its own PDF viewer; this copy leaves that area blank. You can also file online at hitax.hawaii.gov.')

  return { lines: L, x: X, exemptions: ex, itemize, capitalGains, dependentBox: dependent, issues, attach }
}
