/**
 * Connecticut Form CT-1040, full-year resident income tax return, tax year 2025.
 *
 * Source: 2025 Form CT-1040 (Rev. 12/25), its instructions (Rev. 12/25) and Schedule CT-EITC (Rev. 12/25): federal
 * AGI with the Schedule 1 modifications (other states’ bond interest added; U.S. interest, the Social Security
 * benefit adjustment, railroad and military retirement, 50% of Connecticut teachers’ retirement, CHET and ABLE
 * contributions and the pension / IRA subtraction — 100% of pensions and 75% of IRA distributions, phased out from
 * $75,000 / $100,000 of federal AGI — subtracted); the Tax Calculation Schedule (Table A personal exemption, Table B
 * rates 2% to 6.99%, Table C 2% phase-out add-back, Table D recapture, Table E personal tax credit); the property tax
 * credit (up to $300, Schedule 3, phased out by the Property Tax Credit Table) and the CT EITC (40% of the federal
 * credit plus $250 with a qualifying child). Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

type CtStatus = 'single' | 'mfj' | 'mfs' | 'hoh'
const status = (fs: TaxReturnInput['filingStatus']): CtStatus => (fs === 'qss' ? 'mfj' : fs)

/** Table A. */
export function ctExemption(fs: CtStatus, agi: number): number {
  const [start, base] = { single: [30000, 15000], mfj: [48000, 24000], mfs: [24000, 12000], hoh: [38000, 19000] }[fs]
  if (agi <= start) return base
  return pos(base - 1000 * Math.ceil((agi - start) / 1000))
}

/** Table B. */
export function ctInitialTax(fs: CtStatus, taxable: number): number {
  const x = pos(taxable)
  const brackets: Record<CtStatus, [number, number][]> = {
    single: [[10000, 0.02], [50000, 0.045], [100000, 0.055], [200000, 0.06], [250000, 0.065], [500000, 0.069], [Infinity, 0.0699]],
    mfs: [[10000, 0.02], [50000, 0.045], [100000, 0.055], [200000, 0.06], [250000, 0.065], [500000, 0.069], [Infinity, 0.0699]],
    mfj: [[20000, 0.02], [100000, 0.045], [200000, 0.055], [400000, 0.06], [500000, 0.065], [1000000, 0.069], [Infinity, 0.0699]],
    hoh: [[16000, 0.02], [80000, 0.045], [160000, 0.055], [320000, 0.06], [400000, 0.065], [800000, 0.069], [Infinity, 0.0699]]
  }
  let t = 0
  let prev = 0
  for (const [top, rate] of brackets[fs]) {
    if (x > prev) t += (Math.min(x, top) - prev) * rate
    prev = top
  }
  return r(t)
}

/** Table C: 2% phase-out add-back. */
export function ctPhaseOut(fs: CtStatus, agi: number): number {
  const [start, step, amount, max] = { single: [56500, 5000, 25, 250], mfj: [100500, 5000, 50, 500], mfs: [50250, 2500, 25, 250], hoh: [78500, 4000, 40, 400] }[fs]
  if (agi <= start) return 0
  return Math.min(max, amount * Math.ceil((agi - start) / step))
}

/** Table D: tax recapture. */
export function ctRecapture(fs: CtStatus, agi: number): number {
  const k = fs === 'mfj' ? 2 : 1
  if (fs === 'hoh') {
    if (agi <= 168000) return 0
    if (agi <= 240000) return 40 * Math.ceil((agi - 168000) / 8000)
    if (agi <= 320000) return 400
    if (agi <= 552000) return 400 + 140 * Math.ceil((agi - 320000) / 8000)
    if (agi <= 800000) return 4600
    if (agi <= 864000) return 4600 + 80 * Math.ceil((agi - 800000) / 8000)
    return 5320
  }
  const a = agi / k
  let v: number
  if (a <= 105000) v = 0
  else if (a <= 150000) v = 25 * Math.ceil((a - 105000) / 5000)
  else if (a <= 200000) v = 250
  else if (a <= 345000) v = 250 + 90 * Math.ceil((a - 200000) / 5000)
  else if (a <= 500000) v = 2950
  else if (a <= 540000) v = 2950 + 50 * Math.ceil((a - 500000) / 5000)
  else v = 3400
  return v * k
}

/** Table E: personal tax credit decimal. */
const TABLE_E: Record<CtStatus, number[]> = {
  single: [18800, 19300, 19800, 20300, 20800, 21300, 21800, 22300, 25000, 25500, 26000, 26500, 31300, 31800, 32300, 32800, 33300, 60000, 60500, 61000, 61500, 62000, 62500, 63000, 63500, 64000, 64500],
  mfj: [30000, 30500, 31000, 31500, 32000, 32500, 33000, 33500, 40000, 40500, 41000, 41500, 50000, 50500, 51000, 51500, 52000, 96000, 96500, 97000, 97500, 98000, 98500, 99000, 99500, 100000, 100500],
  mfs: [15000, 15500, 16000, 16500, 17000, 17500, 18000, 18500, 20000, 20500, 21000, 21500, 25000, 25500, 26000, 26500, 27000, 48000, 48500, 49000, 49500, 50000, 50500, 51000, 51500, 52000, 52500],
  hoh: [24000, 24500, 25000, 25500, 26000, 26500, 27000, 27500, 34000, 34500, 35000, 35500, 44000, 44500, 45000, 45500, 46000, 74000, 74500, 75000, 75500, 76000, 76500, 77000, 77500, 78000, 78500]
}
const DECIMALS = [0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.14, 0.13, 0.12, 0.11, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01]
export function ctPersonalCredit(fs: CtStatus, agi: number): number {
  const i = TABLE_E[fs].findIndex((top) => agi <= top)
  return i < 0 ? 0 : DECIMALS[i]
}

/** The Tax Calculation Schedule, lines 1–10. */
export function ctTax(fs: CtStatus, agi: number): Record<string, number> {
  const T: Record<string, number> = {}
  T['1'] = pos(agi)
  T['2'] = ctExemption(fs, T['1'])
  T['3'] = pos(T['1'] - T['2'])
  T['4'] = ctInitialTax(fs, T['3'])
  T['5'] = ctPhaseOut(fs, T['1'])
  T['6'] = ctRecapture(fs, T['1'])
  T['7'] = T['4'] + T['5'] + T['6']
  T['8'] = ctPersonalCredit(fs, T['1'])
  T['9'] = r(T['7'] * T['8'])
  T['10'] = T['7'] - T['9']
  return T
}

/** Pension and Annuity Phase-Out Table (by federal AGI). */
export function ctPensionRate(fs: CtStatus, agi: number): number {
  const joint = fs === 'mfj'
  const tops = joint ? [99999, 104999, 109999, 114999, 119999, 124999, 129999, 139999, 149999] : [74999, 77499, 79999, 82499, 84999, 87499, 89999, 94999, 99999]
  const rates = [1, 0.85, 0.7, 0.55, 0.4, 0.25, 0.1, 0.05, 0.025]
  const i = tops.findIndex((top) => agi <= top)
  return i < 0 ? 0 : rates[i]
}

/** Property Tax Credit Table decimal. */
export function ctPropertyCreditDecimal(fs: CtStatus, agi: number): number {
  const [start, step] = { single: [49500, 10000], mfj: [70500, 10000], mfs: [35250, 5000], hoh: [54500, 10000] }[fs]
  if (agi <= start) return 0
  return Math.min(1, Math.round(15 * Math.ceil((agi - start) / step)) / 100)
}

export interface CtResult {
  status: CtStatus
  lines: Record<string, number>
  tcs: Record<string, number>
  sch3: Record<string, number>
  eitc: Record<string, number>
  eitcChildren: number
  withholding: { ein: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeConnecticut(ret: TaxReturnInput, res: TaxReturnResult): CtResult {
  const d = ret.ct
  const f = res.f1040
  const fs = status(ret.filingStatus)
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const agi = r(f['11a'])
  L['1'] = agi

  // ── Schedule 1 ──
  L['31'] = r(pos(d.otherStateBondInterest))
  L['37'] = r(pos(d.otherAddition.amount))
  L['38'] = L['31'] + L['37']
  L['39'] = r(pos(d.usObligationInterest))
  // Social Security benefit adjustment.
  const ssLimit = fs === 'single' || fs === 'mfs' ? 75000 : 100000
  const taxableSs = r(pos(f['6b']))
  if (agi < ssLimit) L['41'] = taxableSs
  else {
    const A = r(pos(f['6a']))
    const line7 = pos(agi - taxableSs) + r(pos(f['2a'])) + r(A / 2)
    const B = pos(line7 - (fs === 'mfj' ? 32000 : fs === 'mfs' ? 0 : 25000))
    const D = r(Math.min(A, B) * 0.25)
    L['41'] = A > 0 && B > 0 ? pos(taxableSs - D) : 0
  }
  const kind = (id: string): string => d.retirementKind[id] ?? 'standard'
  const ofKind = (k: string): number => r(ret.retirement.filter((x) => owners.includes(x.owner) && kind(x.id) === k).reduce((s, x) => s + pos(x.taxableAmount), 0))
  L['43'] = ofKind('railroad')
  L['44'] = ofKind('military')
  L['45'] = r(ofKind('ctrb') * 0.5)
  L['48'] = Math.min(r(pos(d.chetContributions)), joint ? 10000 : 5000)
  const standard = ret.retirement.filter((x) => owners.includes(x.owner) && kind(x.id) === 'standard')
  const ira = r(standard.filter((x) => x.ira).reduce((s, x) => s + pos(x.taxableAmount), 0))
  const pension = r(standard.filter((x) => !x.ira).reduce((s, x) => s + pos(x.taxableAmount), 0))
  const pensionRate = ctPensionRate(fs, agi)
  L['48b'] = r((ira * 0.75 + pension) * pensionRate)
  L['48d'] = r(pos(d.ableContributions))
  L['49'] = r(pos(d.otherSubtraction.amount))
  L['50'] = ['39', '41', '43', '44', '45', '48', '48b', '48d', '49'].reduce((s, k) => s + L[k], 0)

  // ── Page 1 ──
  L['2'] = L['38']
  L['3'] = L['1'] + L['2']
  L['4'] = L['50']
  L['5'] = L['3'] - L['4']
  const tcs = ctTax(fs, L['5'])
  L['6'] = tcs['10']
  L['7'] = Math.min(r(pos(d.otherStateCredit)), L['6'])
  L['8'] = pos(L['6'] - L['7'])
  L['9'] = 0
  L['10'] = L['8'] + L['9']
  // Schedule 3: property tax credit.
  const S: Record<string, number> = {}
  S['60'] = r(pos(d.residence.amount))
  S['61'] = r(pos(d.auto1.amount))
  S['62'] = joint ? r(pos(d.auto2.amount)) : 0
  S['63'] = S['60'] + S['61'] + S['62']
  S['64'] = 300
  S['65'] = Math.min(S['63'], S['64'])
  S['66'] = ctPropertyCreditDecimal(fs, L['5'])
  S['67'] = r(S['65'] * S['66'])
  S['68'] = S['65'] - S['67']
  L['11'] = L['10'] > 0 ? Math.min(S['68'], L['10']) : 0
  L['12'] = pos(L['10'] - L['11'])
  L['13'] = Math.min(r(pos(d.itCredits)), L['12'])
  L['14'] = pos(L['12'] - L['13'])
  L['15'] = r(pos(d.useTax))
  L['16'] = L['14'] + L['15']

  // ── Page 2 ──
  L['17'] = L['16']
  const withholding = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { ein: x?.ein ?? '', wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  }).filter((x) => x.tax > 0)
  if (d.other1099.tax > 0) withholding.push({ ein: d.other1099.ein, wages: r(pos(d.other1099.income)), tax: r(d.other1099.tax) })
  L['18'] = withholding.reduce((s, x) => s + x.tax, 0)
  L['19'] = r(pos(d.estimatedPayments))
  L['20'] = r(pos(d.extensionPayment))
  // Schedule CT-EITC.
  const E: Record<string, number> = {}
  const eicChildren = res.f1040['27a'] > 0 ? ret.dependents.filter((x) => x.childRelationship && x.monthsLivedWithYou > 6 && (x.age < 19 || (x.student && x.age < 24) || x.disabled)).length : 0
  E['8'] = r(pos(f['27a']))
  E['10'] = r(E['8'] * 0.4)
  E['15a'] = E['8'] > 0 && eicChildren > 0 ? 250 : 0
  E['16'] = E['10'] + E['15a']
  L['20a'] = E['16']
  L['21'] = L['18'] + L['19'] + L['20'] + L['20a']
  L['22'] = pos(L['21'] - L['17'])
  L['23'] = Math.min(r(pos(d.creditForward)), L['22'])
  L['25'] = L['22'] - L['23']
  L['26'] = pos(L['17'] - L['21'])
  L['30'] = L['26']

  // ── Notes ──
  if (L['18'] > 0) attach.push('Keep your W-2s and 1099s (do not send them); the withholding schedule on page 2 lists them')
  if (L['7'] > 0) attach.push('Schedule 2 (page 3) and a copy of the other jurisdiction’s return — Schedule 2 is not filled in here')
  if (L['13'] > 0) attach.push('Schedule CT-IT Credit')
  if (ret.dependents.length > 0) attach.push('Schedule CT-Dependent (dependent information) — not filled in here')
  if (withholding.length > 5) attach.push('Supplemental Schedule CT-1040WH for withholding statements after the fifth')
  if (L['45'] > 0) attach.push('Your Connecticut Teachers’ Retirement Board 1099-R (line 45)')
  if (L['48b'] > 0 && pensionRate < 1) issues.push(`Federal AGI is over the pension and annuity limit: only ${pensionRate * 100}% of the subtraction is allowed.`)
  if (ret.retirement.some((x) => owners.includes(x.owner)) && Object.keys(d.retirementKind).length === 0) issues.push('Mark military, railroad, Connecticut teachers’ and Roth distributions among your 1099-Rs: they are subtracted differently.')
  if (ret.filingStatus === 'qss') issues.push('Qualifying surviving spouses use the married filing jointly columns of the Connecticut tables.')
  if (S['63'] === 0 && L['10'] > 0) issues.push('Property tax on your home or car paid to a Connecticut town may give a credit of up to $300 (Schedule 3).')
  if (E['16'] > 0) issues.push('The CT EITC needs Schedule CT-EITC; investment income must be $11,950 or less.')
  if (L['26'] > 1000 && L['19'] === 0) issues.push('A balance due may mean interest on underpaid estimated tax (Form CT-2210).')

  return { status: fs, lines: L, tcs, sch3: S, eitc: E, eitcChildren: eicChildren, withholding, issues, attach }
}
