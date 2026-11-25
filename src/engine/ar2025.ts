/**
 * Arkansas Form AR1000F, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 AR1000F and the 2025 AR1000F/AR1000NR instructions: income built line by line from the federal return
 * (U.S. military pay and retirement, U.S. obligation interest and Social Security are exempt; 50% of net capital gain is
 * exempt (AR1000D, with the depreciation and PET adjustments and the $10,000,000 cap); employer pensions and qualified IRA distributions get a $6,000 exemption per person, reduced by
 * military retirement); AR1000ADJ adjustments (no deduction for half of self-employment tax or federal educator expenses);
 * standard deduction $2,470 ($4,940 joint), AR3 itemized deductions (medical over 10% of AGI, 2% miscellaneous, no
 * Arkansas income tax) or the low income tax tables; the 2025 regular tax
 * table (top rate 3.9%); personal tax credits of $29 per box and dependent; 20% of the federal child care credit
 * (AR2441, before the federal tax limit); AR1000TC credits (political contribution, other state, 20% of the federal
 * adoption credit, PKU, stillborn child, developmental disabilities, business incentives) with the additional tax credit for
 * qualified individuals (net income up to $27,600); 10% of the federal
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
  /** AR1000D (null without capital gains), AR1000ADJ column A, AR3, AR1000TC lines. */
  d: Record<string, number> | null
  adj: Record<string, number>
  ar3: Record<string, number>
  tc: Record<string, number>
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
  // ── AR1000D ──
  const sd = res.scheduleD
  let D: Record<string, number> | null = null
  {
    const ca = d.capitalAdjust
    let lt = r(sd.longTerm)
    const st = r(sd.shortTerm)
    if (lt === 0 && st === 0 && r(f['7a']) !== 0) lt = r(f['7a'])
    if (lt !== 0 || st !== 0 || ca.long || ca.shortLoss || ca.shortGain) {
      const x: Record<string, number> = {}
      x['1'] = lt
      x['2'] = r(ca.long)
      x['3'] = x['1'] + x['2']
      x['4'] = Math.min(0, st)
      x['5'] = r(ca.shortLoss)
      x['6'] = Math.min(0, x['4'] + x['5'])
      x['7a'] = x['3'] + x['6']
      x['7b'] = Math.min(x['7a'], 10000000)
      x['8'] = x['7b'] > 0 ? r(x['7b'] * 0.5) : x['7b']
      x['9'] = Math.max(0, st)
      x['10'] = r(ca.shortGain)
      x['11'] = x['9'] + x['10']
      x['12'] = Math.max(x['8'] + x['11'], fs === 'mfs' ? -1500 : -3000)
      D = x
    }
  }
  L['14'] = D?.['12'] ?? 0
  L['15'] = r(s1.otherGains)
  L['16'] = r(nonqualified)
  L['18A'] = pension.taxpayer.net
  L['18B'] = joint ? pension.spouse.net : 0
  L['19'] = r(s1.rentalIncome)
  L['20'] = 0
  L['21'] = r(pos(s1.unemployment))
  L['22'] = r(s1.otherIncome + s1.hsaTaxable + d.otherIncome)
  L['23'] = ['8', '10', '11', '12', '13', '14', '15', '16', '18A', '18B', '19', '20', '21', '22'].reduce((s, k) => s + L[k], 0)
  // ── AR1000ADJ (column A) ──
  const a = d.adj
  const fa = s1.adjustments
  const A: Record<string, number> = {}
  A['1'] = r(pos(a.borderCity)); A['2'] = r(pos(a.tuitionSavings)); A['3'] = r(pos(fa.iraDeduction ?? 0)); A['4'] = r(pos(a.msa))
  A['5'] = r(pos(fa.hsaDeduction ?? 0)); A['6'] = r(pos(fa.studentLoanInterest ?? 0)); A['7'] = r(pos(a.trust)); A['8'] = r(pos(a.moving))
  A['10'] = r(pos(a.keogh))
  A['9'] = Math.min(r(pos(ret.adjustments.selfEmployedHealthInsurance)), pos(r(s1.businessIncome) - A['10']))
  A['11'] = r(pos(a.forfeitedInterest)); A['12'] = r(pos(a.alimony)); A['13'] = r(pos(a.disability)); A['14'] = r(pos(a.organDonor))
  A['15'] = r(pos(a.militaryReserve)); A['16'] = r(pos(a.reforestation)); A['17'] = r(pos(a.teacher)); A['18'] = r(pos(a.able))
  A['19'] = Array.from({ length: 18 }, (_, i) => A[String(i + 1)]).reduce((s, n) => s + n, 0)
  L['24'] = A['19']
  L['25'] = L['23'] - L['24']

  // ── Deduction / table ──
  const standard = joint ? 4940 : 2470
  // ── AR3 (Arkansas lets you itemize whether or not you itemized federally; Arkansas income tax is not deductible) ──
  const it = ret.itemized
  const i3 = d.ar3
  const I: Record<string, number> = {}
  I['1'] = r(pos(it.medical)); I['2'] = L['25']; I['3'] = r(pos(L['25']) * 0.1); I['4'] = pos(I['1'] - I['3'])
  I['5'] = r(pos(it.realEstateTax)); I['6'] = r(pos(it.personalPropertyTax) + pos(i3.otherTaxes)); I['7'] = I['5'] + I['6']
  I['8'] = r(pos(it.mortgageInterest)); I['9'] = r(pos(i3.individualMortgage)); I['10'] = r(pos(i3.points)); I['11'] = r(pos(i3.investmentInterest))
  I['12'] = I['8'] + I['9'] + I['10'] + I['11']
  I['13'] = r(pos(it.charityCash)); I['14'] = r(pos(i3.artContributions)); I['15'] = r(pos(it.charityNonCash)); I['16'] = r(pos(i3.charityCarryover))
  I['17'] = I['13'] + I['14'] + I['15'] + I['16']
  I['18'] = r(pos(i3.casualty)); I['19'] = r(pos(i3.tuition))
  I['20'] = r(pos(i3.employeeExpenses)); I['21'] = r(pos(i3.otherExpenses)); I['22'] = I['20'] + I['21']
  I['23'] = L['25']; I['24'] = r(pos(L['25']) * 0.02); I['25'] = pos(I['22'] - I['24'])
  I['26'] = r(pos(i3.firefighter)); I['27'] = r(pos(i3.gambling)); I['28'] = r(pos(it.other)); I['29'] = I['26'] + I['27'] + I['28']
  I['30'] = ['4', '7', '12', '17', '18', '19', '25', '29'].reduce((s, k) => s + I[k], 0)
  const itemized = I['30']
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
  L['35'] = r(pos(res.form2441.credit) * 0.2)
  const additional = arAdditionalCredit(L['28']) * (joint ? 2 : 1)
  // ── AR1000TC ──
  const tc = d.tc
  const T: Record<string, number> = {}
  T['1'] = Math.min(r(pos(tc.political)), joint ? 100 : 50)
  T['2'] = r(pos(tc.otherState)); T['3'] = r(pos(tc.adoption) * 0.2); T['4'] = r(pos(tc.pku)); T['5'] = Math.max(0, Math.floor(tc.stillborn)) * 500
  T['6'] = additional
  T['7'] = tc.developmental.filter((x) => x.name.trim()).length * 500
  T['8'] = r(tc.business.reduce((s, b) => s + pos(b.amount), 0))
  T['9'] = ['1', '2', '3', '4', '5', '6', '7', '8'].reduce((s, k) => s + T[k], 0)
  L['36'] = T['9']
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
  if (D) attach.push('Federal Schedule D (with AR1000D)')
  if (A['5'] > 0) attach.push('Federal Form 8889 (HSA; AR1000ADJ line 5)')
  if (A['8'] > 0) attach.push('Form AR3903 (moving expenses)')
  if (A['13'] > 0) attach.push('Form AR1000DC (support for individuals with permanent disabilities)')
  if (A['14'] > 0) attach.push('Form AR1000OD (organ donor deduction)')
  if (A['17'] > 0) attach.push('Form AR1000CE (teachers’ classroom investment expense)')
  if (table === 'itemized') {
    if (I['11'] > 0) attach.push('Federal Form 4952 (investment interest; AR3 line 11)')
    if (I['18'] > 0) attach.push('Form AR4684 (casualty and theft losses)')
    if (I['19'] > 0) attach.push('Form AR1075 for each student (tuition deduction)')
    if (I['20'] > 0) attach.push('Form AR2106 (employee business expenses)')
    if (I['15'] >= 500) attach.push('Federal Form 8283 (noncash gifts of $500 or more)')
  }
  if (T['2'] > 0) attach.push('A signed copy of the return you filed with the other state (AR1000TC line 2)')
  if (T['3'] > 0) attach.push('Federal Form 8839 (adoption; AR1000TC line 3)')
  if (T['4'] > 0) attach.push('Form AR1113 (phenylketonuria disorder credit)')
  if (T['5'] > 0) attach.push('The certificate of birth resulting in stillbirth (AR1000TC line 5)')
  if (T['7'] > 0) attach.push('Form AR1000-DD for each individual, unless a valid one is already on file')
  if (T['8'] > 0) attach.push('The tax credit certificate(s) for each business incentive credit (AR1000TC line 8)')
  if (L['22'] !== 0) attach.push('AR-OI (other income and depreciation differences)')
  if (mine.length) attach.push('Your 1099-Rs')
  if (table === 'low') issues.push(`The low income tax table (${lowTable}) gives less tax than the standard deduction and regular table; line 27 is 0.`)
  if (fs === 'mfs') issues.push('Married filing separately: this return uses filing status 5 (separate returns). Filing status 4 (separately on the same return) may lower your tax if you both had income.')
  if (joint && ret.w2s.some((w) => w.owner === 'spouse' && w.wages > 0) && ret.w2s.some((w) => w.owner === 'taxpayer' && w.wages > 0)) issues.push('Married couples where both have income may pay less with filing status 4 (separately on the same return); that comparison is not made here.')
  if (mine.some((x) => early(x.code) && kind(x.id) !== 'military')) issues.push('Early distributions (code 1) do not qualify for the $6,000 exemption and are reported on line 16.')
  if (pos(fa.educatorExpenses ?? 0) > 0) issues.push('Arkansas does not allow the federal educator expense deduction; a qualifying teacher can claim the classroom investment expense on AR1000ADJ line 17 (Form AR1000CE).')
  if (pos(fa.deductibleHalfOfSeTax ?? 0) > 0) issues.push('Arkansas does not allow the deduction for one-half of self-employment tax; it is not on AR1000ADJ.')
  if (pos(tc.political) > (joint ? 100 : 50)) issues.push(`The political contribution credit is limited to $${joint ? 100 : 50}.`)
  if (tc.developmental.length > 6) issues.push('AR1000TC has room for six individuals with developmental disabilities; attach a list for the rest.')
  for (const o of ['taxpayer', 'spouse'] as Owner[]) if (tc.business.filter((b) => b.owner === o).length > 3) issues.push('AR1000TC has room for three business incentive credits each for the primary and the spouse.')
  if (L['37'] > L['33'] && L['33'] > 0) issues.push('Your credits are more than your tax; the unused part of nonrefundable credits is lost unless the credit allows a carryover.')
  if (L['51'] > 1000 && L['40'] === 0) issues.push('Tax due over $1,000 may mean an underpayment penalty (AR2210).')

  return { lines: L, d: D, adj: A, ar3: I, tc: T, boxes, hohBox, militaryPay, militaryRetirement, pension, table, lowTable, issues, attach }
}
