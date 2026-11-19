/**
 * Arkansas Form AR1000F, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 AR1000F and the 2025 AR1000F/AR1000NR instructions: income built line by line from the federal return
 * (U.S. military pay and retirement, U.S. obligation interest and Social Security are exempt; 50% of net capital gain is
 * exempt (AR1000D); employer pensions and qualified IRA distributions get a $6,000 exemption per person, reduced by
 * military retirement); standard deduction $2,470 ($4,940 joint) or the low income tax tables; the 2025 regular tax
 * table (top rate 3.9%); personal tax credits of $29 per box and dependent; 20% of the federal child care credit
 * (AR2441); the additional tax credit for qualified individuals (net income up to $27,600); 10% of the federal
 * additional tax on early retirement distributions. Married filing separately on the same return (status 4) is not
 * computed: joint filers use status 2. Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { AR_LOW, AR_REGULAR } from './ar2025tables.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Tax from the 2025 regular income tax table. */
export function arRegularTax(net: number): number {
  const x = Math.max(0, Math.floor(net))
  if (x > 100000) return r(3809 + (x - 100000) * 0.039)
  if (x < 5100) return 0
  const i = x < 75001 ? Math.floor((x - 5100) / 100) : 699 + Math.floor((x - 75001) / 100)
  return AR_REGULAR[i]
}

/** Tax from a 2025 low income tax table, or null when the income is above the table. */
export function arLowTax(table: keyof typeof AR_LOW, agi: number): number | null {
  const x = Math.max(0, Math.floor(agi))
  for (const [top, tax] of AR_LOW[table]) if (x <= top) return tax
  return null
}

/** Additional tax credit for qualified individuals (per return; doubled for joint filers by the caller). */
export function arAdditionalCredit(net: number): number {
  if (net <= 26500) return 60
  return Math.max(0, 60 - 5 * Math.ceil((net - 26500) / 100))
}

export interface ArResult {
  lines: Record<string, number>
  /** Line 7A boxes. */
  boxes: Record<Owner, { self: boolean; over65: boolean; special: boolean; blind: boolean; deaf: boolean }>
  hohBox: boolean
  militaryPay: Record<Owner, number>
  militaryRetirement: Record<Owner, number>
  pension: Record<Owner, { gross: number; taxable: number; net: number }>
  table: 'low' | 'standard' | 'itemized'
  lowTable: keyof typeof AR_LOW | null
  issues: string[]
  attach: string[]
}

export function computeArkansas(ret: TaxReturnInput, res: TaxReturnResult): ArResult {
  const d = ret.ar
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const s1 = res.schedule1

  // ── Retirement ──
  const kind = (id: string): ArRetirementKind => d.retirementKind[id] ?? 'standard'
  type ArRetirementKind = TaxReturnInput['ar']['retirementKind'][string]
  const mine = ret.retirement.filter((x) => owners.includes(x.owner))
  const early = (code: string): boolean => /1/.test(code) && !/[34]/.test(code)
  const militaryRetirement: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
  const pension: ArResult['pension'] = { taxpayer: { gross: 0, taxable: 0, net: 0 }, spouse: { gross: 0, taxable: 0, net: 0 } }
  let nonqualified = 0
  for (const x of mine) {
    const k = kind(x.id)
    if (k === 'military') militaryRetirement[x.owner] += pos(x.taxableAmount)
    else if (k === 'nonqualified' || early(x.code)) nonqualified += pos(x.taxableAmount)
    else { pension[x.owner].gross += pos(x.grossDistribution); pension[x.owner].taxable += pos(x.taxableAmount) }
  }
  for (const o of owners) {
    militaryRetirement[o] = r(militaryRetirement[o])
    const p = pension[o]
    p.gross = r(p.gross); p.taxable = r(p.taxable)
    p.net = pos(p.taxable - pos(6000 - militaryRetirement[o]))
  }

  // ── Income ──
  const militaryPay: Record<Owner, number> = { taxpayer: r(pos(d.militaryPay.taxpayer)), spouse: joint ? r(pos(d.militaryPay.spouse)) : 0 }
  const wages = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + pos(w.wages), 0)
  L['8'] = pos(r(wages) - militaryPay.taxpayer - militaryPay.spouse)
  L['10'] = pos(r(f['2b']) - r(pos(d.usObligationInterest)))
  L['11'] = r(pos(f['3b']))
  L['12'] = 0
  L['13'] = r(s1.businessIncome)
  const sd = res.scheduleD
  const net = r(f['7a'])
  L['14'] = net > 0 ? net - r(0.5 * Math.min(pos(sd.longTerm), net)) : net
  L['15'] = r(s1.otherGains)
  L['16'] = r(nonqualified)
  L['18A'] = pension.taxpayer.net
  L['18B'] = joint ? pension.spouse.net : 0
  L['19'] = r(s1.rentalIncome)
  L['20'] = 0
  L['21'] = r(pos(s1.unemployment))
  L['22'] = r(s1.otherIncome + s1.hsaTaxable + d.otherIncome)
  L['23'] = ['8', '10', '11', '12', '13', '14', '15', '16', '18A', '18B', '19', '20', '21', '22'].reduce((s, k) => s + L[k], 0)
  L['24'] = r(pos(s1.totalAdjustments)) + r(pos(d.extraAdjustments))
  L['25'] = L['23'] - L['24']

  // ── Deduction / table ──
  const standard = joint ? 4940 : 2470
  const it = ret.itemized
  const itemizedFederally = res.deduction.used === 'itemized'
  const itemized = itemizedFederally ? r(pos(res.scheduleA.medical) + pos(it.realEstateTax) + pos(it.personalPropertyTax) + pos(res.scheduleA.interest) + pos(res.scheduleA.charity)) : 0
  const usesExclusion = militaryPay.taxpayer + militaryPay.spouse + militaryRetirement.taxpayer + militaryRetirement.spouse > 0 || owners.some((o) => pension[o].taxable > pension[o].net)
  const deps = ret.dependents.length
  const lowTable: ArResult['lowTable'] = fs === 'single' ? 'single' : fs === 'hoh' || fs === 'qss' ? (deps >= 2 ? 'hoh2' : 'hoh01') : joint ? (deps >= 2 ? 'mfj2' : 'mfj01') : null
  const totalIncome = Math.max(L['25'], r(f['9']) + r(pos(f['2a'])) + r(pos(f['6a']) - pos(f['6b'])))
  const lowTax = lowTable && !usesExclusion && !(itemized > standard) && arLowTax(lowTable, totalIncome) !== null ? arLowTax(lowTable, L['25']) : null
  const regularDeduction = itemized > standard ? itemized : standard
  const regularTax = arRegularTax(pos(L['25'] - regularDeduction))
  let table: ArResult['table']
  if (lowTax !== null && lowTax <= regularTax) {
    table = 'low'
    L['27'] = 0
    L['28'] = L['25']
    L['29'] = lowTax
  } else {
    table = itemized > standard ? 'itemized' : 'standard'
    L['27'] = regularDeduction
    L['28'] = pos(L['25'] - L['27'])
    L['29'] = arRegularTax(L['28'])
  }
  L['30'] = L['29']
  L['31'] = 0
  L['32'] = r(pos(res.schedule2.earlyDistributionTax) * 0.1)
  L['33'] = L['30'] + L['31'] + L['32']

  // ── Personal tax credits (7A–7C) ──
  const boxes = {} as ArResult['boxes']
  for (const o of (['taxpayer', 'spouse'] as Owner[])) {
    const on = owners.includes(o)
    const p = person(o)
    const over65 = on && (p.age >= 65 || p.age65OrOlder)
    boxes[o] = { self: on, over65, special: over65 && pension[o].taxable === 0 && militaryRetirement[o] === 0, blind: on && p.blind, deaf: on && d.deaf[o] }
  }
  const hohBox = fs === 'hoh' || fs === 'qss'
  L['7Acount'] = Object.values(boxes).reduce((s, b) => s + [b.self, b.over65, b.special, b.blind, b.deaf].filter(Boolean).length, 0) + (hohBox ? 1 : 0)
  L['7A'] = L['7Acount'] * 29
  L['7Bcount'] = deps
  L['7B'] = deps * 29
  L['7C'] = L['7A'] + L['7B']
  L['34'] = L['7C']
  L['35'] = r(pos(res.schedule3.dependentCare) * 0.2)
  const additional = arAdditionalCredit(L['28']) * (joint ? 2 : 1)
  L['36'] = additional + r(pos(d.otherCredits))
  L['37'] = L['34'] + L['35'] + L['36']
  L['38'] = pos(L['33'] - L['37'])

  // ── Payments ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['39A'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0))
  L['39B'] = r(pos(d.withholding1099))
  L['40'] = r(pos(d.estimatedPayments))
  L['41'] = r(pos(d.extensionPayment))
  L['44'] = L['39A'] + L['39B'] + L['40'] + L['41']
  L['46'] = L['44']
  L['47'] = pos(L['46'] - L['38'])
  L['48'] = Math.min(L['47'], r(pos(d.creditForward)))
  L['49'] = Math.min(L['47'] - L['48'], r(pos(d.checkoff)))
  L['50'] = L['47'] - L['48'] - L['49']
  L['51'] = pos(L['38'] - L['46'])
  L['52C'] = L['51']

  // ── Notes ──
  if (L['10'] > 1500 || L['11'] > 1500) attach.push('AR4 (interest and dividend income)')
  if (L['14'] !== 0) attach.push('Federal Schedule D and AR1000D (capital gains; 50% of net gain is exempt) — AR1000D is not filled in here')
  if (L['24'] > 0) attach.push('AR1000ADJ (adjustments) — not filled in here')
  if (table === 'itemized') attach.push('AR3 (itemized deductions) — not filled in here')
  if (L['35'] > 0) attach.push('AR2441 (child care credit) — not filled in here')
  if (L['36'] > 0) attach.push(`AR1000TC (other credits; line 6, additional tax credit for qualified individuals ${additional ? `$${additional}` : ''}) — not filled in here`)
  if (L['22'] !== 0) attach.push('AR-OI (other income and depreciation differences)')
  if (mine.length) attach.push('Your 1099-Rs')
  if (table === 'low') issues.push(`The low income tax table (${lowTable}) gives less tax than the standard deduction and regular table; line 27 is 0.`)
  if (fs === 'mfs') issues.push('Married filing separately: this return uses filing status 5 (separate returns). Filing status 4 (separately on the same return) may lower your tax if you both had income.')
  if (joint && ret.w2s.some((w) => w.owner === 'spouse' && w.wages > 0) && ret.w2s.some((w) => w.owner === 'taxpayer' && w.wages > 0)) issues.push('Married couples where both have income may pay less with filing status 4 (separately on the same return); that comparison is not made here.')
  if (mine.some((x) => early(x.code) && kind(x.id) !== 'military')) issues.push('Early distributions (code 1) do not qualify for the $6,000 exemption and are reported on line 16.')
  if (ret.dependents.length > 6) issues.push('More than six dependents: attach a schedule.')
  if (L['51'] > 1000 && L['40'] === 0) issues.push('Tax due over $1,000 may mean an underpayment penalty (AR2210).')

  return { lines: L, boxes, hohBox, militaryPay, militaryRetirement, pension, table, lowTable, issues, attach }
}
