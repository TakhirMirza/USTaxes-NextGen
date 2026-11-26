/**
 * North Carolina Form D-400, full-year resident income tax return, tax year 2025.
 *
 * Source: 2025 D-401 instructions (flat 4.25%, NC standard deduction chart, child deduction table, NC
 * itemized deductions with the $20,000 cap on mortgage interest plus real estate taxes) and D-400
 * Schedule S (additions, including 85% of federal bonus depreciation, and deductions: state refunds, U.S.
 * obligation interest, taxable Social Security, Bailey and uniformed services retirement). Amounts are
 * whole dollars.
 */
import type { TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { vaBonusAddition } from './va2025.ts'

/** Schedule S lines an "other addition" or "other deduction" item can go on (label → line). Schedule S has no catch-all line. */
export const NC_ADDITION_LINES: [label: string, line: string][] = [
  ['Line 2: Deferred gains reinvested into an Opportunity Fund', '2'],
  ['Line 4: IRC section 179 expense', '4'],
  ['Line 5: S corporation built-in gains tax', '5'],
  ['Line 6: Federal basis over state basis for property disposed of', '6'],
  ['Line 7: Federal net operating loss deduction', '7'],
  ['Line 8: State, local or foreign income tax deducted by an S corporation or partnership', '8'],
  ['Line 9: 529 plan withdrawals not used for permissible purposes', '9'],
  ['Line 10: Discharge of qualified principal residence indebtedness', '10'],
  ['Line 11: Qualified education loan payments paid by employer', '11'],
  ['Line 12: Expenses allocable to exempt or excluded income', '12'],
  ['Line 13: Discharge of certain student loan debt', '13'],
  ['Line 14: Taxed pass-through entity loss', '14']
]
export const NC_DEDUCTION_LINES: [label: string, line: string][] = [
  ['Line 22: Bonus asset basis', '22'],
  ['Line 25: Recognized IRC section 1400Z-2 gain', '25'],
  ['Line 26: Gain from disposition of exempt N.C. obligations', '26'],
  ['Line 27: Exempt income of a federally recognized Indian tribe member', '27'],
  ['Line 28: State basis over federal basis for property disposed of', '28'],
  ['Line 29: Business expenses reduced or not allowed due to federal credits', '29'],
  ['Line 30: Personal Education Student Account deposits', '30'],
  ['Line 31: State emergency response and disaster relief reserve', '31'],
  ['Line 32: Certain economic incentive payments', '32'],
  ['Line 33: Certain N.C. grant payments', '33'],
  ['Line 34: Certain net operating loss carrybacks', '34'],
  ['Line 35: Excess net operating loss carryforward', '35'],
  ['Line 36: Excess business loss', '36'],
  ['Line 37: Business interest limitation', '37'],
  ['Line 39: N.C. net operating loss', '39']
]

export const NC_RATE = 0.0425
export const NC_STANDARD_DEDUCTION = { single: 12750, mfs: 12750, mfj: 25500, qss: 25500, hoh: 19125 } as const
export const NC_MORTGAGE_TAX_CAP = 20000
export const NC_BONUS_ADDBACK = 0.85
/** Child deduction table: AGI ceilings for $3,000 → $500 per child (then $0). */
const CHILD_CEILINGS = { joint: [40000, 60000, 80000, 100000, 120000, 140000], hoh: [30000, 45000, 60000, 75000, 90000, 105000], single: [20000, 30000, 40000, 50000, 60000, 70000] }

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export function ncChildDeductionPer(fs: TaxReturnInput['filingStatus'], fagi: number): number {
  const c = fs === 'mfj' || fs === 'qss' ? CHILD_CEILINGS.joint : fs === 'hoh' ? CHILD_CEILINGS.hoh : CHILD_CEILINGS.single
  const i = c.findIndex((lim) => fagi <= lim)
  return i < 0 ? 0 : 3000 - i * 500
}

export interface NcResult {
  lines: Record<string, number>
  scheduleS: { additions: Record<string, number>; deductions: Record<string, number> }
  deduction: { method: 'standard' | 'itemized'; standard: number; itemized: number; mortgageAndTaxes: number }
  childDeduction: { children: number; perChild: number }
  issues: string[]
  attach: string[]
}

export function computeNorthCarolina(ret: TaxReturnInput, res: TaxReturnResult): NcResult {
  const d = ret.nc
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])

  L['6'] = fagi
  const bonus = r(vaBonusAddition(ret) * NC_BONUS_ADDBACK)
  const additions: Record<string, number> = { '1': r(pos(d.otherStateBondInterest)), '3': bonus, other: r(pos(d.otherAdditions)) }
  additions['16'] = additions['1'] + additions['3'] + additions.other
  L['7'] = additions['16']
  L['8'] = L['6'] + L['7']
  const deductions: Record<string, number> = {
    '17': r(pos(d.stateRefundInFagi)), '18': r(pos(d.usObligationInterest)), '19': r(f['6b']),
    '20': r(pos(d.baileyRetirement)), '21': r(pos(d.militaryRetirement)), other: r(pos(d.otherDeductions))
  }
  deductions['41'] = deductions['17'] + deductions['18'] + deductions['19'] + deductions['20'] + deductions['21'] + deductions.other
  L['9'] = deductions['41']

  // Child deduction: children allowed the federal child tax credit.
  const children = res.schedule8812.qualifyingChildren
  const perChild = ncChildDeductionPer(fs, fagi)
  L['10a'] = children
  L['10b'] = children * perChild

  // NC standard or itemized deduction.
  const it = ret.itemized
  const standard = fs === 'mfs' && d.spouseItemizes ? 0 : NC_STANDARD_DEDUCTION[fs]
  const mortgageAndTaxes = Math.min(NC_MORTGAGE_TAX_CAP, r(pos(it.mortgageInterest) + pos(it.realEstateTax)))
  const itemized = mortgageAndTaxes + r(res.scheduleA.charity) + r(res.scheduleA.medical)
  const method: 'standard' | 'itemized' = itemized > standard ? 'itemized' : 'standard'
  L['11'] = method === 'itemized' ? itemized : standard
  L['12a'] = L['9'] + L['10b'] + L['11']
  L['12b'] = L['8'] - L['12a']
  L['14'] = pos(L['12b'])
  L['15'] = r(L['14'] * NC_RATE)
  L['16'] = Math.min(r(pos(d.taxCredits)), L['15'])
  L['17'] = L['15'] - L['16']
  L['18'] = r(pos(d.useTax))
  L['19'] = L['17'] + L['18']
  L['20a'] = r(pos(d.withholding.taxpayer))
  L['20b'] = joint ? r(pos(d.withholding.spouse)) : 0
  L['21a'] = r(pos(d.estimatedPayments))
  L['21b'] = 0
  L['21c'] = r(pos(d.extensionPayment))
  L['21d'] = 0
  L['23'] = L['20a'] + L['20b'] + L['21a'] + L['21b'] + L['21c'] + L['21d']
  L['22'] = 0
  L['24'] = 0
  L['25'] = L['23'] + L['22'] - L['24']
  L['26a'] = pos(L['19'] - L['25'])
  L['26d'] = 0
  L['26e'] = 0
  L['27'] = L['26a'] + L['26d'] + L['26e']
  L['28'] = pos(L['25'] - L['19'])
  L['29'] = Math.min(r(pos(d.creditForward)), L['28'])
  L['30'] = Math.min(r(pos(d.contributions)), L['28'] - L['29'])
  L['31'] = 0
  L['32'] = 0
  L['33'] = L['29'] + L['30'] + L['31'] + L['32']
  L['34'] = L['28'] - L['33']

  if (L['7'] > 0 || L['9'] > 0) attach.push('Form D-400 Schedule S, supplemental schedule')
  if (method === 'itemized') attach.push('Form D-400 Schedule A, NC itemized deductions')
  if (L['16'] > 0) attach.push('Form D-400TC, individual tax credits')
  if (bonus > 0) issues.push(`North Carolina adds back 85% of federal bonus depreciation (${bonus.toLocaleString('en-US')}); you deduct 20% of it in each of the next five years.`)
  if (deductions['19'] > 0) issues.push('North Carolina does not tax Social Security; the taxable part is deducted on Schedule S.')
  if (r(f['4b'] + f['5b']) > 0 && deductions['20'] === 0) issues.push('Most private pensions and IRA distributions are taxed in North Carolina. Government pensions vested by August 12, 1989 (Bailey) are not — enter them if you have them.')
  if (method === 'itemized') issues.push(`NC itemized deductions (${itemized.toLocaleString('en-US')}): mortgage interest plus real estate taxes are capped at $20,000; state income tax is not deductible.`)
  if (children > 0 && perChild === 0) issues.push('Your federal AGI is too high for the NC child deduction.')
  if (L['18'] === 0 && !d.noUseTaxDue) issues.push('Line 18: enter the consumer use tax you owe, or certify that none is due.')
  if (L['27'] > 1000 && L['21a'] === 0) issues.push('If you owe more than $1,000, North Carolina may charge interest for underpaying estimated tax (Form D-422).')

  return {
    lines: L, scheduleS: { additions, deductions },
    deduction: { method, standard, itemized, mortgageAndTaxes },
    childDeduction: { children, perChild },
    issues, attach
  }
}
