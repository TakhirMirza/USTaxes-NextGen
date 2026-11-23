/**
 * West Virginia Form IT-140, full-year resident personal income tax return, tax year 2025.
 *
 * Source: 2025 West Virginia Personal Income Tax Forms & Instructions (IT-140, Schedule M, RECAP, FTC-1) and the 2025
 * tax table: federal AGI plus / minus Schedule M modifications in a “you” and a “spouse” column (U.S. interest; WV
 * police / fire, military and railroad retirement in full; WV teachers’ / PERS and federal retirement up to $2,000;
 * Social Security taxable federally — 100%, or 65% when federal AGI is over $50,000 / $100,000; the senior citizen or
 * disability deduction of up to $8,000 less lines 29–34; state refunds, WV 529, ABLE); the low-income earned income
 * exclusion; $2,000 exemptions ($500 when there are none); the tax table (rows taxed at the midpoint of the rate
 * schedule) below $100,000 and Rate Schedule I or II; the Family Tax Credit (FTC-1) and 50% of the federal child care
 * credit on RECAP; the refundable motor vehicle property tax adjustment credit. Whole dollars.
 */
import type { Owner, TaxReturnInput, WvRetirementKind } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n + 1e-9)
const pos = (n: number): number => Math.max(0, n)

const SCHEDULE_I: [number, number, number][] = [[0, 0, 0.0222], [10000, 222, 0.0296], [25000, 666, 0.0333], [40000, 1165.5, 0.0444], [60000, 2053.5, 0.0482]]
const SCHEDULE_II: [number, number, number][] = [[0, 0, 0.0222], [5000, 111, 0.0296], [12500, 333, 0.0333], [20000, 582.75, 0.0444], [30000, 1026.75, 0.0482]]

const schedule = (x: number, rows: [number, number, number][]): number => {
  let row = rows[0]
  for (const b of rows) if (x >= b[0]) row = b
  return row[1] + (x - row[0]) * row[2]
}

/** Line 8: the 2025 tax table (statuses 1, 2, 3, 5, under $100,000) or Rate Schedule I / II. */
export function wvTax(taxable: number, mfs: boolean): { tax: number; table: boolean } {
  const x = Math.max(0, Math.floor(taxable))
  if (mfs) return { tax: r(schedule(x, SCHEDULE_II)), table: false }
  if (x >= 100000) return { tax: r(schedule(x, SCHEDULE_I)), table: false }
  if (x < 25) return { tax: 0, table: true }
  const [start, width] = x < 100 ? [25, 25] : x < 25000 ? [100, 100] : x < 40000 ? [25000, 60] : [40000, 50]
  const lo = start + Math.floor((x - start) / width) * width
  return { tax: r(schedule(lo + width / 2, SCHEDULE_I)), table: true }
}

/** FTC-1 Family Tax Credit percentage (0–1) by family size and modified federal AGI. */
export function wvFamilyCreditPercent(size: number, modifiedAgi: number, mfs: boolean): number {
  if (size < 1) return 0
  const n = Math.min(8, size)
  const top = mfs ? 7825 + 2750 * (n - 1) : 15650 + 5500 * (n - 1)
  const step = mfs ? 150 : 300
  if (modifiedAgi <= top) return 1
  return Math.max(0, 10 - Math.ceil((modifiedAgi - top) / step)) / 10
}

export interface WvResult {
  /** Schedule E, one per state. */
  schE: { state: string; lines: Record<string, number> }[]
  lines: Record<string, number>
  /** Schedule M lines by column: 'A' (you) and 'B' (spouse). */
  m: { A: Record<string, number>; B: Record<string, number> }
  m33: Record<Owner, { a: number; b: number }>
  m34: Record<Owner, { a: number; b: number; c: number }>
  m47: Record<Owner, { year: string; c: number; d: number } | null>
  exemptions: { a: number; b: number; c: number; e: number }
  usedTable: boolean
  ftc: Record<string, number>
  recap: Record<string, number>
  issues: string[]
  attach: string[]
}

export function computeWestVirginia(ret: TaxReturnInput, res: TaxReturnResult): WvResult {
  const d = ret.wv
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const mfs = fs === 'mfs'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const col = (o: Owner): 'A' | 'B' => (joint && o === 'spouse' ? 'B' : 'A')
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const agi = r(f['11a'])

  // ── Exemptions ──
  const ex = { a: ret.canBeClaimedAsDependent ? 0 : 1, b: joint ? 1 : 0, c: ret.dependents.length, e: 0 }
  ex.e = ex.a + ex.b + ex.c

  // ── Schedule M ──
  const M = { A: {} as Record<string, number>, B: {} as Record<string, number> }
  const lines = ['29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48']
  for (const c of ['A', 'B'] as const) for (const k of lines) M[c][k] = 0
  M.A['29'] = r(pos(d.usObligationInterest))
  const kind = (id: string): WvRetirementKind => d.retirementKind[id] ?? 'standard'
  const ret1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const sumKind = (o: Owner, k: WvRetirementKind): number => r(ret1099.filter((x) => x.owner === o && kind(x.id) === k).reduce((s, x) => s + pos(x.taxableAmount), 0))
  const m33 = {} as WvResult['m33']
  const m34 = {} as WvResult['m34']
  const ssForms = ret.socialSecurity.filter((x) => owners.includes(x.owner))
  const ssTotal = ssForms.reduce((s, x) => s + pos(x.netBenefits), 0)
  const taxableSs = r(pos(f['6b']))
  const ssFactor = agi > (joint ? 100000 : 50000) ? 0.65 : 1
  for (const o of owners) {
    const c = col(o)
    M[c]['31'] += sumKind(o, 'police')
    M[c]['32'] += sumKind(o, 'military')
    M[c]['40'] += sumKind(o, 'railroad')
    m33[o] = { a: sumKind(o, 'wvPublic'), b: sumKind(o, 'federal') }
    M[c]['33'] += Math.min(2000, m33[o].a + m33[o].b)
    const mine = ssForms.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.netBenefits), 0)
    const share = ssTotal > 0 ? mine / ssTotal : 0
    const a = r(mine)
    const cc = r(taxableSs * share)
    m34[o] = { a, b: a - cc, c: cc }
    M[c]['34'] += r(cc * ssFactor)
  }
  M.A['38'] = r(pos(d.stateRefundInFagi))
  M.A['39'] = r(pos(d.wv529))
  M.A['43'] = r(pos(d.able))

  // Line 47: senior citizen (65 or older) or disability deduction.
  const m47 = { taxpayer: null, spouse: null } as WvResult['m47']
  const income = (o: Owner): number => {
    if (!joint) return agi
    const wages = ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + pos(w.wages), 0)
    const pensions = ret1099.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0)
    const other = pos(agi - ret.w2s.reduce((s, w) => s + pos(w.wages), 0) - ret1099.reduce((s, x) => s + pos(x.taxableAmount), 0) - taxableSs)
    return wages + pensions + m34[o].c + other / 2
  }
  for (const o of owners) {
    const p = person(o)
    if (!(p.age >= 65 || p.age65OrOlder || d.disabled[o])) continue
    const c = col(o)
    const excluded = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'].reduce((s, k) => s + M[c][k], 0)
    const cc = Math.min(8000, r(pos(income(o) - excluded)))
    const dd = ['29', '30', '31', '32', '33', '34'].reduce((s, k) => s + M[c][k], 0)
    m47[o] = { year: d.birthYear[o].trim(), c: cc, d: dd }
    M[c]['47'] = pos(cc - dd)
  }
  for (const c of ['A', 'B'] as const) M[c]['49'] = lines.reduce((s, k) => s + M[c][k], 0)
  const additions: Record<string, number> = { '52': r(pos(d.otherStateBondInterest)) }
  additions['59'] = additions['52']

  // ── IT-140 ──
  L['1'] = agi
  L['2'] = additions['59']
  L['3'] = M.A['49'] + M.B['49']
  L['4'] = L['1'] + L['2'] - L['3']
  const earned = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + pos(w.wages), 0) + res.scheduleC.filter((b) => owners.includes(b.owner)).reduce((s, b) => s + pos(b.netProfit), 0)
  const lowCap = mfs ? 5000 : 10000
  L['5'] = agi <= lowCap ? r(Math.min(pos(agi), earned, lowCap)) : 0
  L['6'] = ex.e > 0 ? ex.e * 2000 : 500
  L['7'] = pos(L['4'] - L['5'] - L['6'])
  const tax = wvTax(L['7'], mfs)
  L['8'] = tax.tax

  // ── RECAP and FTC-1 ──
  const ftc: Record<string, number> = { '1': agi, '2': L['2'], '3': r(pos(f['2a'])) }
  ftc['4'] = ftc['1'] + ftc['2'] + ftc['3']
  ftc['5'] = ex.a + ex.b + ex.c
  ftc['6'] = res.schedule2.amt > 0 ? 0 : wvFamilyCreditPercent(ftc['5'], ftc['4'], mfs)
  ftc['7'] = L['8']
  ftc['8'] = r(ftc['7'] * ftc['6'])
  const recap: Record<string, number> = {}
  recap['2'] = ftc['8']
  recap['18'] = r(pos(res.schedule3.dependentCare) * 0.5)
  recap['other'] = r(pos(d.otherCredits))
  // ── Schedule E, one per state; line 9 also leaves room for the credits already taken ──
  let used = 0
  const schE = d.otherStates.filter((o) => o.state.trim() && pos(o.tax) > 0 && pos(o.income) > 0).map((o) => {
    const e: Record<string, number> = {}
    e['1'] = r(pos(o.tax)); e['2'] = L['8']; e['3'] = r(pos(o.income)); e['4'] = L['4']
    e['5'] = e['4'] > 0 ? r(e['2'] * e['3'] / e['4']) : 0
    e['6'] = pos(L['7'] - e['3'])
    e['7'] = wvTax(e['6'], mfs).tax
    e['8'] = pos(e['2'] - e['7'])
    e['9'] = pos(e['2'] - (recap['2'] + recap['18'] + recap['other']) - used)
    e['10'] = Math.min(e['1'], e['2'], e['5'], e['8'], e['9'])
    used += e['10']
    return { state: o.state.trim().toUpperCase().slice(0, 2), lines: e }
  })
  recap['1'] = used
  recap['total'] = recap['1'] + recap['2'] + recap['18'] + recap['other']
  L['9'] = Math.min(L['8'], recap['total'])
  L['10'] = pos(L['8'] - L['9'])
  L['13'] = r(pos(d.useTax))
  L['14'] = L['10'] + L['13']

  // ── Payments ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['15'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0) + pos(d.withholdingOther))
  L['16'] = r(pos(d.estimatedPayments))
  L['21A'] = r(pos(d.motorVehicleCredit))
  L['21'] = L['21A']
  L['23'] = L['15'] + L['16'] + L['21']
  L['24'] = pos(L['14'] - L['23'])
  L['25'] = pos(L['23'] - L['14'])
  L['26A'] = r(pos(d.donations.A))
  L['26B'] = r(pos(d.donations.B))
  L['26C'] = r(pos(d.donations.C))
  L['26'] = Math.min(L['25'], L['26A'] + L['26B'] + L['26C'])
  L['27'] = Math.min(L['25'] - L['26'], r(pos(d.creditForward)))
  L['28'] = L['25'] - L['26'] - L['27']

  // ── Notes ──
  attach.push('Your W-2s and 1099s (original withholding documents)')
  if (L['2'] + L['3'] > 0) attach.push('Schedule M')
  if (recap['total'] > 0) attach.push('Tax Credit Recap Schedule (RECAP)')
  if (recap['2'] > 0) attach.push('Schedule FTC-1 (Family Tax Credit)')
  if (recap['18'] > 0) attach.push('Federal Form 2441 (required for the child care credit)')
  if (schE.length) attach.push('Keep each other state’s return (or the information and withholding statements) in your files (Schedule E)')
  if (L['21A'] > 0) attach.push('Your vehicle personal property tax receipts (motor vehicle property tax adjustment credit)')
  if (owners.some((o) => d.disabled[o])) attach.push('Schedule H (physician’s certification of disability)')
  if (L['5'] > 0) issues.push('Federal AGI is $10,000 or less: the low-income earned income exclusion applies (line 5).')
  if (ssFactor < 1 && taxableSs > 0) issues.push('Federal AGI is over the limit, so 65% of your federally taxable Social Security is subtracted (line 34).')
  if (ret1099.some((x) => x.taxableAmount > 0) && Object.keys(d.retirementKind).length === 0) issues.push('Mark military, railroad, WV police / fire, WV teachers’ / PERS or federal retirement among your 1099-Rs: each is fully or partly exempt in West Virginia.')
  if (owners.some((o) => m47[o] && !m47[o]!.year)) issues.push('Schedule M line 47: enter the year of birth for the senior citizen deduction.')
  if (ret.dependents.some((x) => !(d.dependentBirthDate[x.id] ?? '').trim())) issues.push('Enter each dependent’s date of birth; the IT-140 asks for it.')
  if (ret.dependents.length > 4) issues.push('More than four dependents: list the rest on Schedule DP.')
  if (L['24'] > 600 && L['16'] === 0) issues.push('A balance due over $600 may mean an underpayment penalty (Form IT-210).')

  return { schE, lines: L, m: M, m33, m34, m47, exemptions: ex, usedTable: tax.table, ftc, recap, issues, attach }
}
