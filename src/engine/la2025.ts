/**
 * Louisiana Form IT-540, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 IT-540 (IT-540-WEB-BC) and its 2025 instructions (Act 11 of 2024): federal AGI, or Louisiana AGI from
 * Schedule E (exempt income such as U.S. government interest, Louisiana and federal retirement benefits, the
 * $12,000 annual retirement income exemption at 65 and taxable Social Security); a $12,500 standard deduction
 * ($25,000 for filing statuses 2, 4 and 5); for federal itemizers, the federal medical deduction above the federal
 * standard deduction (lines 9A–9D); a flat 3% tax; the refundable child care credit (federal AGI of $25,000 or
 * less), the earned income credit (5% of the federal credit) and the nonrefundable child care credit (Schedule J).
 * Amounts are whole dollars.
 */
import type { LaRetirementCode, Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

export const LA_RATE = 0.03
export const LA_RETIREMENT_EXEMPTION = 12000
const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export interface LaExemptRow { code: string; description: string; amount: number }

export interface LaResult {
  lines: Record<string, number>
  /** Schedule E lines (1, 2A, 3, 4H, 5) and its exempt income rows. */
  schE: Record<string, number>
  exempt: LaExemptRow[]
  usesScheduleE: boolean
  /** Refundable child care worksheet (lines 3, 6, 8 rate) and Schedule J lines 1–3. */
  care: { line3: number; line6: number; rate: number; line9: number }
  schJ: Record<string, number>
  issues: string[]
  attach: string[]
}

/** Line 8 of the refundable child care credit worksheet. */
export function laRefundableCareRate(agi: number): number {
  if (agi <= 15000) return 0.35
  if (agi <= 17000) return 0.34
  if (agi <= 19000) return 0.33
  if (agi <= 21000) return 0.32
  if (agi <= 23000) return 0.31
  return 0.3
}

/** The 2025 nonrefundable child care credit before the tax limit (worksheet lines 1–2A). */
export function laNonrefundableCare(federalCredit: number, agi: number): number {
  if (agi <= 25000 || federalCredit <= 0) return 0
  if (agi <= 35000) return r(federalCredit * 0.3)
  const ten = r(federalCredit * 0.1)
  return agi > 60000 ? Math.min(25, ten) : ten
}

export function computeLouisiana(ret: TaxReturnInput, res: TaxReturnResult): LaResult {
  const d = ret.la
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const E: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const agi = r(f['11a'])

  // ── Schedule E ──
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const is65 = (o: Owner): boolean => person(o).age65OrOlder || person(o).age >= 65
  const codes: LaRetirementCode[] = ['02E', '03E', '04E', '05E']
  const coded = (o: Owner): number => codes.reduce((s, c) => s + r(pos(d.exemptRetirement[c][o])), 0)
  const retirementIncome = (o: Owner): number => r(pos(ret.retirement.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0)))
  const annual = owners.filter(is65).reduce((s, o) => s + Math.min(LA_RETIREMENT_EXEMPTION, pos(retirementIncome(o) - coded(o))), 0)
  const rows: LaExemptRow[] = []
  const add = (code: string, description: string, amount: number): void => { if (r(amount) > 0) rows.push({ code, description, amount: r(amount) }) }
  add('01', 'U.S. government obligations interest', pos(d.usObligationInterest))
  const descriptions: Record<LaRetirementCode, string> = { '02E': 'La. State Employees retirement', '03E': 'La. State Teachers retirement', '04E': 'Federal retirement benefits', '05E': d.otherRetirementSystem.trim() || 'Other exempt retirement' }
  for (const c of codes) add(c.slice(0, 2), descriptions[c], owners.reduce((s, o) => s + pos(d.exemptRetirement[c][o]), 0))
  add('06', 'Annual retirement income exemption (65+)', annual)
  add('07', 'Taxable Social Security', pos(f['6b']))
  add('09', 'START Savings Program contribution', pos(d.startContributions))
  add('10', 'Military pay exclusion', pos(d.militaryPay))
  add('17', 'Elementary and secondary school tuition', pos(d.schoolTuition))
  add('18', 'Home-schooled children expenses', pos(d.homeSchool))
  add('19', 'Quality public education expenses', pos(d.publicSchool))
  const oc = d.otherExempt.code.replace(/\D/g, '').slice(0, 2)
  if (oc && d.otherExempt.amount > 0) add(oc.padStart(2, '0'), d.otherExempt.description.trim() || 'Other exempt income', d.otherExempt.amount)
  E['1'] = agi
  E['2A'] = r(pos(d.otherStateBondInterest))
  E['3'] = pos(E['1'] + E['2A'])
  E['4H'] = rows.reduce((s, x) => s + x.amount, 0)
  E['5'] = pos(E['3'] - E['4H'])
  const usesScheduleE = rows.length > 0 || E['2A'] > 0

  // ── Income, deductions and tax ──
  L['7'] = usesScheduleE ? E['5'] : pos(agi)
  L['8'] = fs === 'single' || fs === 'mfs' ? 12500 : 25000
  if (res.deduction.used === 'itemized') {
    L['9A'] = r(res.deduction.itemized)
    L['9B'] = r(pos(res.scheduleA.medical))
    L['9C'] = fs === 'mfj' || fs === 'qss' ? 31500 : fs === 'hoh' ? 23625 : 15750
    L['9D'] = pos(L['9B'] - L['9C'])
  } else L['9A'] = L['9B'] = L['9C'] = L['9D'] = 0
  L['10'] = pos(L['7'] - L['8'] - L['9D'])
  L['11'] = r(L['10'] * LA_RATE)
  L['1A'] = r(pos(d.otherStateTax))
  L['1B'] = Math.min(r(pos(d.otherStateCredit)), L['11'])
  L['12'] = L['1B']
  L['13'] = pos(L['11'] - L['12'])

  // ── Refundable priority 2 credits ──
  const persons = res.form2441.qualifyingPersons
  const care = { line3: 0, line6: 0, rate: 0, line9: 0 }
  if (agi <= 25000 && persons > 0 && res.form2441.expensesUsed > 0) {
    care.line3 = Math.min(r(pos(ret.dependentCare.expenses - ret.dependentCare.employerBenefits)), persons >= 2 ? 6000 : 3000)
    care.line6 = Math.min(care.line3, r(res.form2441.expensesUsed))
    care.rate = laRefundableCareRate(agi)
    care.line9 = r(care.line6 * care.rate)
  }
  L['14'] = r(care.line9 * 0.5)
  L['14A'] = care.line3
  L['14B'] = care.line6
  L['15'] = 0
  L['16'] = r(pos(f['27a']) * 0.05)
  L['17'] = r(pos(d.otherRefundableCredits))
  L['18'] = L['14'] + L['15'] + L['16'] + L['17']
  L['19'] = pos(L['13'] - L['18'])
  L['20'] = pos(L['18'] - L['13'])

  // ── Schedule J: nonrefundable priority 3 credits ──
  const J: Record<string, number> = {}
  J['1'] = r(pos(res.schedule3.dependentCare))
  const care2025 = laNonrefundableCare(J['1'], agi)
  let room = L['19']
  J['3'] = Math.min(r(pos(d.childCareCarryforward)), room)
  room -= J['3']
  J['2'] = Math.min(care2025, room)
  room -= J['2']
  J['6'] = Math.min(r(pos(d.otherCredit.amount)), room)
  J['16'] = J['2'] + J['3'] + J['6']
  J['available'] = care2025
  J['carryToNext'] = care2025 - J['2'] + pos(r(pos(d.childCareCarryforward)) - J['3'])
  L['21'] = J['16']
  L['22'] = pos(L['19'] - L['21'])

  // ── Use tax, payments, refund ──
  L['23A'] = r(pos(d.useTax))
  L['23B'] = r(pos(d.roadUsageFee))
  L['24'] = L['22'] + L['23A'] + L['23B']
  L['25'] = L['20']
  L['26'] = r(pos(d.priority4Credits))
  const w2Tax = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + r(pos(d.w2[w.id]?.stateTax ?? 0)), 0)
  L['27'] = w2Tax + r(pos(d.withholding1099))
  L['28'] = r(pos(d.priorYearCredit))
  L['29'] = r(pos(d.estimatedPayments))
  L['30'] = r(pos(d.extensionPayment))
  L['31'] = L['25'] + L['26'] + L['27'] + L['28'] + L['29'] + L['30']
  L['32'] = pos(L['31'] - L['24'])
  L['33'] = 0
  L['34'] = L['32']
  L['35'] = 0
  L['36'] = L['34']
  L['37'] = Math.min(r(pos(d.creditForward)), L['36'])
  L['38'] = L['36'] - L['37']
  L['39'] = pos(L['24'] - L['31'])
  L['47'] = L['39']

  // ── Notes ──
  if (L['27'] > 0) attach.push('W-2s and 1099s showing Louisiana tax withheld')
  if (L['12'] > 0) attach.push('Form R-10606 and a copy of the other state’s return (Schedule C credit)')
  if (L['17'] > 0) attach.push('Schedule F and its credit forms (line 17)')
  if (L['26'] > 0) attach.push('Schedule I and its credit forms (line 26)')
  if (L['23B'] > 0) attach.push('Form R-19000A (electric and hybrid vehicle road usage fee)')
  if (d.schoolTuition + d.homeSchool + d.publicSchool > 0) attach.push('The School Expense Deduction Worksheet (Schedule E codes 17E–19E)')
  if (d.startContributions > 0) attach.push('START contribution records (code 09E)')
  if (L['14'] > 0) issues.push('Refundable child care credit: the worksheet lists each care provider; check the provider names and ID numbers on it.')
  if (rows.length > 7) issues.push('Schedule E has room for seven exempt income lines; the remaining amounts are combined on line 4G. Attach a list.')
  if (J['carryToNext'] > 0) issues.push(`${J['carryToNext'].toLocaleString('en-US')} of the nonrefundable child care credit carries forward to 2026; keep the worksheet.`)
  if (owners.some((o) => is65(o) && retirementIncome(o) > 0)) issues.push('The $12,000 retirement income exemption at 65 (code 06E) covers pensions, annuities and IRAs on Form 1040 lines 4b and 5b; enter exempt Louisiana or federal retirement under codes 02E–05E instead.')
  if (d.otherCredit.amount > 0 && !/^\d{3}$/.test(d.otherCredit.code.trim())) issues.push('Enter the three-digit Schedule J credit code for the other credit.')
  if (L['39'] > 1000 && L['29'] === 0) issues.push('A balance due may mean an underpayment penalty (Form R-210R).')

  return { lines: L, schE: E, exempt: rows, usesScheduleE, care, schJ: J, issues, attach }
}
