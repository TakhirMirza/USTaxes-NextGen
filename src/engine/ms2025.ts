/**
 * Mississippi Form 80-105, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form 80-105, Forms 80-107 and 80-108, and the 2025 Form 80-100 instructions: income built line by line in
 * a taxpayer and a spouse column (Social Security, Railroad Retirement and retirement income are exempt in total; early
 * distributions are taxable; U.S. obligation interest is not taxed, other states’ municipal bond interest is);
 * Mississippi adjustments (IRA, SEP, early-withdrawal penalty, National Guard pay up to $15,000, MPACT / MACS, SE health
 * insurance, HSA, half of SE tax, ABLE); the standard deduction ($2,300 / $4,600 / $3,400) or Mississippi itemized
 * deductions (no state income taxes, no SALT cap); exemptions ($6,000 / $12,000 / $8,000 plus $1,500 per dependent and
 * per 65-or-older or blind box); tax of 0% on the first $10,000 of each column and 4.4% above. On a joint (combined)
 * return the deductions and exemptions may be divided between the columns; they are divided to keep each column’s
 * taxable income as low as possible above $10,000. Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const MS_RATE = 0.044
export const MS_ZERO_BAND = 10000
const EXEMPTION: Record<TaxReturnInput['filingStatus'], number> = { single: 6000, mfj: 12000, mfs: 6000, hoh: 8000, qss: 8000 }
const STANDARD: Record<TaxReturnInput['filingStatus'], number> = { single: 2300, mfj: 4600, mfs: 2300, hoh: 3400, qss: 3400 }

/** Tax on one column’s taxable income. */
export const msTax = (taxable: number): number => r(pos(taxable - MS_ZERO_BAND) * MS_RATE)

export interface MsResult {
  /** Form 80-160 (null without the credit) and Form 80-401 rows. */
  f160: { cols: Record<string, number>[]; total4: number; a6: number; a7: number; b7: number; line10: number; line11: number; line12: number } | null
  f401: { code: string; B: number; C: number; D: number; E: number; F: number; G: number }[]
  /** Lines with A / B columns are keyed '13A', '13B', … ; single-column lines by number. */
  lines: Record<string, number>
  itemized: Record<string, number> | null
  interest: Record<string, number>
  dependentsTotal: number
  boxes: { taxpayer65: boolean; taxpayerBlind: boolean; spouse65: boolean; spouseBlind: boolean }
  statements: { kind: 'w2'; payerId: string; name: string; ssn: string; wages: number; tax: number; employer: string }[]
  issues: string[]
  attach: string[]
}

export function computeMississippi(ret: TaxReturnInput, res: TaxReturnResult): MsResult {
  const d = ret.ms
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const col = (o: Owner): 'A' | 'B' => (joint && o === 'spouse' ? 'B' : 'A')
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const set = (line: string, A: number, B = 0): void => { L[`${line}A`] = r(A); L[`${line}B`] = joint ? r(B) : 0 }
  const byOwner = (vals: { owner: Owner; amount: number }[]): [number, number] => {
    let A = 0, B = 0
    for (const v of vals) { if (col(v.owner) === 'A') A += v.amount; else B += v.amount }
    return [A, B]
  }

  // ── Income (page 2) ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  set('38', ...byOwner(w2s.map((w) => ({ owner: w.owner, amount: pos(d.w2[w.id]?.stateIncome ?? w.wages) }))))
  set('39', ...byOwner(res.scheduleC.filter((b) => owners.includes(b.owner)).map((b) => ({ owner: b.owner, amount: b.netProfit }))))
  set('40', r(f['7a']))
  set('41', r(res.schedule1.rentalIncome))
  set('42', 0)
  const interest: Record<string, number> = {}
  interest['1'] = r(pos(f['2b'])) + r(pos(d.otherStateBondInterest))
  interest['2'] = Math.min(interest['1'], r(pos(d.usObligationInterest)))
  interest['3'] = interest['1'] - interest['2']
  interest['4'] = r(pos(f['3b']))
  interest['5'] = 0
  interest['6'] = interest['4']
  set('43', interest['3'])
  set('44', interest['6'])
  set('45', 0)
  const early = ret.retirement.filter((x) => owners.includes(x.owner) && /1/.test(x.code) && !/[34]/.test(x.code))
  set('46', ...byOwner(early.map((x) => ({ owner: x.owner, amount: pos(x.taxableAmount) }))))
  set('47', r(pos(res.schedule1.unemployment)))
  set('48', r(res.schedule1.otherIncome))
  for (const c of ['A', 'B'] as const) L[`49${c}`] = ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'].reduce((s, k) => s + L[`${k}${c}`], 0)

  // ── Adjustments ──
  const adj = res.schedule1.adjustments
  set('50', pos(adj.iraDeduction ?? 0))
  set('51', 0)
  set('52', 0)
  set('53', 0)
  set('54', 0)
  set('55', Math.min(15000, pos(d.guardPay.taxpayer)), Math.min(15000, pos(d.guardPay.spouse)))
  set('56', pos(d.mpact))
  set('57', pos(d.macs))
  set('58', pos(adj.selfEmployedHealthInsurance ?? 0))
  set('59', pos(adj.hsaDeduction ?? 0))
  set('60', 0)
  set('61', ...byOwner(res.scheduleSE.filter((x) => owners.includes(x.owner)).map((x) => ({ owner: x.owner, amount: x.total / 2 }))))
  set('62', 0)
  set('63', 0)
  set('64', pos(d.able))
  for (const c of ['A', 'B'] as const) {
    L[`65${c}`] = Array.from({ length: 15 }, (_, i) => String(50 + i)).reduce((s, k) => s + L[`${k}${c}`], 0)
    L[`66${c}`] = L[`49${c}`] - L[`65${c}`]
    L[`13${c}`] = L[`66${c}`]
  }

  // ── Deductions and exemptions ──
  const it = ret.itemized
  const ia: Record<string, number> = {}
  ia['1'] = r(f['11a'])
  ia['2c'] = r(pos(res.scheduleA.medical))
  ia['3a'] = r(pos(it.stateLocalIncomeOrSalesTax) + pos(it.realEstateTax) + pos(it.personalPropertyTax))
  ia['3b'] = r(pos(it.stateLocalIncomeOrSalesTax))
  ia['3c'] = ia['3a'] - ia['3b']
  ia['4'] = r(pos(res.scheduleA.interest))
  ia['5'] = r(pos(res.scheduleA.charity))
  ia['7a'] = r(pos(it.other))
  ia['7c'] = ia['7a']
  ia['8'] = ia['2c'] + ia['3c'] + ia['4'] + ia['5'] + ia['7c']
  const standard = STANDARD[fs]
  const itemize = ia['8'] > standard
  const deduction = itemize ? ia['8'] : standard
  const old = (p: TaxReturnInput['taxpayer']): boolean => p.age >= 65 || p.age65OrOlder
  const boxes = { taxpayer65: old(ret.taxpayer), taxpayerBlind: ret.taxpayer.blind, spouse65: joint && old(ret.spouse), spouseBlind: joint && ret.spouse.blind }
  const dependentsTotal = ret.dependents.length + Object.values(boxes).filter(Boolean).length
  L['7'] = ret.dependents.length
  L['9'] = dependentsTotal
  L['10'] = dependentsTotal * 1500
  L['11'] = EXEMPTION[fs]
  L['12'] = L['10'] + L['11']
  const total = deduction + L['12']
  // Divide deductions and exemptions between the columns so each column keeps as much as possible of its $10,000 0% band.
  let dA = total
  let dB = 0
  if (joint) {
    const overA = pos(L['13A'] - MS_ZERO_BAND)
    const overB = pos(L['13B'] - MS_ZERO_BAND)
    dA = Math.min(total, overA)
    dB = Math.min(total - dA, overB)
    const rest = total - dA - dB
    if (L['13A'] >= L['13B']) dA += rest; else dB += rest
  }
  // Report the split as deduction first, then exemptions, in each column.
  const dedA = Math.min(deduction, dA)
  L['14A'] = dedA
  L['15A'] = dA - dedA
  L['14B'] = joint ? deduction - dedA : 0
  L['15B'] = joint ? dB - L['14B'] : 0
  for (const c of ['A', 'B'] as const) L[`16${c}`] = L[`13${c}`] - L[`14${c}`] - L[`15${c}`]

  // ── Tax ──
  if (joint && (L['16A'] < 0 || L['16B'] < 0)) L['17'] = msTax(L['16A'] + L['16B'])
  else L['17'] = msTax(L['16A']) + (joint ? msTax(L['16B']) : 0)
  // ── Form 80-160 (up to three states) ──
  const states = d.otherStates.filter((o) => o.state.trim() && pos(o.tax) > 0).slice(0, 3)
  let f160: { cols: Record<string, number>[]; total4: number; a6: number; a7: number; b7: number; line10: number; line11: number; line12: number } | null = null
  if (states.length) {
    const cols = states.map((o) => {
      const c: Record<string, number> = { '1': r(pos(o.income)), '2': r(pos(o.deduction)), '3': r(pos(o.exemption)) }
      c['4'] = pos(c['1'] - c['2'] - c['3'])
      c['9'] = r(pos(o.tax))
      return c
    })
    const total4 = cols.reduce((s, c) => s + c['4'], 0)
    const a6 = Math.min(MS_ZERO_BAND, total4)
    const a7 = pos(total4 - MS_ZERO_BAND)
    const b7 = r(a7 * 0.044)
    for (const c of cols) {
      c['5'] = total4 > 0 ? Math.round(c['4'] / total4 * 10000) / 100 : 0
      c['7'] = r(b7 * c['5'] / 100)
      c['8'] = c['7']
      c['10'] = Math.min(c['8'], c['9'])
    }
    const line10 = cols.reduce((s, c) => s + c['10'], 0)
    f160 = { cols, total4, a6, a7, b7, line10, line11: L['17'], line12: Math.min(line10, L['17']) }
  }
  L['18'] = f160?.line12 ?? 0
  // ── Form 80-401: credits used in order up to the tax left ──
  let room = L['17'] - L['18']
  const f401 = d.credits401.filter((c) => c.code.trim()).slice(0, 4).map((c) => {
    const B = r(pos(c.earned)); const C = r(pos(c.passThrough)); const D = r(pos(c.carryover)); const F = r(pos(c.expired))
    const E = Math.min(pos(B + C + D - F), room); room -= E
    const code = c.code.trim().padStart(2, '0')
    // Codes marked * on the form have no carryover.
    const G = ['02', '03', '11', '12', '27', '41', '44', '50'].includes(code) ? 0 : pos(B + C + D - E - F)
    return { code, B, C, D, E, F, G }
  })
  L['19'] = f401.reduce((s, c) => s + c.E, 0)
  L['20'] = pos(L['17'] - L['18'] - L['19'])
  L['21'] = r(pos(d.useTax))
  L['22'] = 0
  L['23'] = L['20'] + L['21'] + L['22']

  // ── Payments ──
  const statements = w2s.map((w) => ({
    kind: 'w2' as const, payerId: d.w2[w.id]?.ein ?? '', name: `${(w.owner === 'taxpayer' ? ret.taxpayer : ret.spouse).firstName} ${(w.owner === 'taxpayer' ? ret.taxpayer : ret.spouse).lastName}`,
    ssn: (w.owner === 'taxpayer' ? ret.taxpayer : ret.spouse).ssn, wages: r(pos(d.w2[w.id]?.stateIncome ?? w.wages)), tax: r(pos(d.w2[w.id]?.stateTax ?? 0)), employer: w.employer
  }))
  L['24'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.withholding1099))
  L['25'] = r(pos(d.estimatedPayments))
  L['26'] = 0
  L['27'] = 0
  L['28'] = L['24'] + L['25'] + L['26'] - L['27']
  L['29'] = pos(L['28'] - L['23'])
  L['30'] = 0
  L['31'] = L['29'] - L['30']
  L['32'] = Math.min(L['31'], r(pos(d.creditForward)))
  const gifts = Object.values(d.contributions).reduce((s, x) => s + r(pos(x)), 0)
  L['33'] = Math.min(L['31'] - L['32'], gifts)
  L['34'] = L['31'] - L['32'] - L['33']
  L['35'] = pos(L['23'] - L['28'])
  L['36'] = 0
  L['37'] = L['35'] + L['36']

  // ── Notes ──
  attach.push('Form 80-107 (income / withholding schedule) and your W-2s; a copy of your federal return')
  if (itemize || interest['1'] + interest['4'] + L['41A'] + L['48A'] + L['33'] !== 0) attach.push('Form 80-108 (itemized deductions, interest and dividends, rents, other income, check-offs)')
  if (L['39A'] + L['39B'] !== 0) attach.push('Federal Schedule C')
  if (L['40A'] !== 0) attach.push('Federal Schedule D')
  if (f160) attach.push('A copy of each other state’s return and proof of payment (Form 80-160; W-2 withholding is not proof)')
  if (d.otherStates.filter((o) => o.state.trim() && pos(o.tax) > 0).length > 3) issues.push('Form 80-160 has room for three states; attach another for the rest.')
  if (d.credits401.filter((c) => c.code.trim()).length > 4) issues.push('Form 80-401 has room for four credits; attach another for the rest.')
  if (f401.length) attach.push('The certificate, approval letter or statement required for each Form 80-401 credit')
  if (f401.some((c) => c.code === '25') && !d.adopteeSsns.trim()) issues.push('Form 80-401 code 25 (child adoption): enter the adoptee’s SSN.')
  if (f401.some((c) => ['34', '35', '36', '39', '42', '43', '45'].includes(c.code)) && !d.charities.trim()) issues.push('Form 80-401 charitable credits: enter the name of the charitable organization.')
  if (ret.retirement.some((x) => owners.includes(x.owner) && x.taxableAmount > 0 && !early.includes(x))) issues.push('Retirement income (pensions, IRAs, 401(k)s after the required age) and Social Security are not taxed in Mississippi.')
  if (early.length) issues.push('Early distributions (code 1) are taxable in Mississippi and are reported on line 46.')
  if (joint && (L['40A'] || L['43A'] || L['44A'] || L['41A'])) issues.push('Interest, dividends, capital gains and rents are shown in the taxpayer column; move a spouse’s own share to column B if it applies.')
  if (itemize) issues.push(`Mississippi itemized deductions (${ia['8'].toLocaleString('en-US')}) are more than the standard deduction and are used.`)

  return { f160, f401, lines: L, itemized: itemize ? ia : null, interest, dependentsTotal, boxes, statements, issues, attach }
}
