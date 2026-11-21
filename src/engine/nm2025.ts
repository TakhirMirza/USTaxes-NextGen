/**
 * New Mexico Form PIT-1, full-year resident personal income tax return, tax year 2025.
 *
 * Source: 2025 PIT-1, PIT-ADJ, PIT-RC and PIT-CR and their instructions, and the 2025 tax rate tables (Single / MFJ /
 * MFS / HOH columns, $100 rows taxed at the midpoint up to $100,000; rate schedule above): federal AGI plus the state
 * and local income tax deduction add-back (itemizers) and PIT-ADJ additions, less the federal standard or itemized
 * deduction, the $4,000 deduction for certain dependents (MFJ / HOH), the low- and middle-income exemption ($2,500 per
 * exemption, phased out), and PIT-ADJ deductions (U.S. interest, railroad retirement, the 65-or-blind exemption of up
 * to $8,000 each, NM 529, net capital gain up to $2,500, active duty pay, $3,000 medical care exemption, state refunds,
 * armed forces retirement up to $30,000 each, Social Security below $100,000 / $150,000 / $75,000); tax at 1.5%–5.9%;
 * PIT-RC low income comprehensive tax rebate, $2,800 medical care credit and Child Income Tax Credit; working families
 * tax credit of 25% of the federal EIC. Whole dollars.
 */
import type { NmRetirementKind, Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n + 1e-9)
const pos = (n: number): number => Math.max(0, n)

type Col = 'single' | 'mfj' | 'mfs' | 'hoh'
const BRACKETS: Record<Col, [number, number][]> = {
  single: [[0, 0.015], [5500, 0.032], [16500, 0.043], [33500, 0.047], [66500, 0.049], [210000, 0.059]],
  mfj: [[0, 0.015], [8000, 0.032], [25000, 0.043], [50000, 0.047], [100000, 0.049], [315000, 0.059]],
  mfs: [[0, 0.015], [4000, 0.032], [12500, 0.043], [25000, 0.047], [50000, 0.049], [157500, 0.059]],
  hoh: [[0, 0.015], [8000, 0.032], [25000, 0.043], [50000, 0.047], [100000, 0.049], [315000, 0.059]]
}
/** Rate schedule above $100,000: [threshold, base, rate, excess over]. */
const OVER: Record<Col, [number, number, number, number][]> = {
  single: [[100000, 4356, 0.049, 100000], [210000, 9746, 0.059, 210000]],
  mfj: [[100000, 4087, 0.049, 100000], [315000, 14622, 0.059, 315000]],
  mfs: [[100000, 4492, 0.049, 100000], [157500, 7310, 0.059, 157500]],
  hoh: [[100000, 4087, 0.049, 100000], [315000, 14622, 0.059, 315000]]
}
const column = (fs: TaxReturnInput['filingStatus']): Col => (fs === 'qss' ? 'mfj' : fs)

const exact = (x: number, col: Col): number => {
  let tax = 0
  const b = BRACKETS[col]
  for (let i = 0; i < b.length; i++) {
    const top = i + 1 < b.length ? b[i + 1][0] : Infinity
    if (x > b[i][0]) tax += (Math.min(x, top) - b[i][0]) * b[i][1]
  }
  return tax
}

/** Line 18: the 2025 tax rate tables ($100 rows, first rows $0–$60 and $60–$100) or the schedule above $100,000. */
export function nmTax(taxable: number, fs: TaxReturnInput['filingStatus']): number {
  const col = column(fs)
  const x = Math.max(0, Math.floor(taxable))
  if (x >= 100000) {
    let row = OVER[col][0]
    for (const o of OVER[col]) if (x > o[0]) row = o
    return r(row[1] + (x - row[3]) * row[2])
  }
  const mid = x < 60 ? 30 : x < 100 ? 80 : Math.floor(x / 100) * 100 + 50
  return r(exact(mid, col))
}

/** PIT-ADJ Table 1: exemption for each taxpayer 65 or older or blind. */
export function nmSeniorExemption(agi: number, fs: TaxReturnInput['filingStatus']): number {
  const [start, step] = fs === 'single' ? [18000, 1500] : fs === 'mfs' ? [15000, 1500] : [30000, 3000]
  if (agi <= start) return 8000
  return Math.max(0, 8000 - 1000 * Math.ceil((agi - start) / step))
}

/** Low- and middle-income tax exemption worksheet (PIT-1 line 14). */
export function nmLowMiddleExemption(agi: number, fs: TaxReturnInput['filingStatus'], exemptions: number): number {
  const [limit, floor, rate] = fs === 'single' ? [36667, 20000, 0.15] : fs === 'mfs' ? [27500, 15000, 0.2] : [55000, 30000, 0.1]
  if (agi > limit || exemptions <= 0) return 0
  return r(pos(2500 - pos(agi - floor) * rate) * exemptions)
}

const LICTR_ROWS: [number, number[]][] = [
  [1000, [224, 298, 373, 448, 522, 597]], [1500, [252, 362, 465, 580, 655, 775]], [2500, [252, 362, 465, 580, 655, 810]], [7500, [252, 362, 465, 580, 655, 839]],
  [8000, [235, 356, 448, 568, 660, 839]], [9000, [212, 327, 431, 551, 660, 804]], [10000, [195, 287, 390, 488, 586, 764]], [11500, [166, 241, 316, 413, 511, 689]],
  [13000, [149, 212, 270, 339, 419, 551]], [14500, [132, 195, 252, 316, 362, 448]], [16500, [120, 178, 212, 270, 327, 385]], [18000, [114, 149, 189, 241, 287, 344]],
  [19500, [103, 132, 166, 206, 252, 298]], [21000, [91, 120, 160, 189, 212, 264]], [23000, [91, 120, 160, 189, 212, 264]], [24500, [86, 114, 137, 166, 195, 224]],
  [26000, [74, 103, 132, 160, 178, 206]], [27500, [63, 91, 120, 149, 160, 195]], [29500, [57, 86, 114, 132, 149, 178]], [31000, [45, 63, 91, 114, 132, 149]],
  [32500, [40, 57, 74, 91, 114, 120]], [34000, [28, 45, 57, 74, 91, 103]], [36000, [17, 40, 45, 63, 74, 86]]
]
/** PIT-RC Table 1: low income comprehensive tax rebate. */
export function nmLowIncomeRebate(mgi: number, exemptions: number): number {
  if (exemptions < 1) return 0
  const row = LICTR_ROWS.find(([top]) => Math.max(0, mgi) <= top)
  return row ? row[1][Math.min(6, exemptions) - 1] : 0
}

/** PIT-RC Table 4: Child Income Tax Credit per qualifying child. */
export function nmChildCreditPerChild(agi: number): number {
  for (const [top, amt] of [[25000, 637], [50000, 424], [75000, 212], [100000, 106], [200000, 79], [350000, 53]] as const) if (agi <= top) return amt
  return 26
}

const PROPERTY_MAX: [number, number][] = [
  [1000, 20], [2000, 25], [3000, 30], [4000, 35], [5000, 40], [6000, 45], [7000, 50], [8000, 55], [9000, 60], [10000, 75],
  [11000, 90], [12000, 105], [13000, 120], [14000, 135], [15000, 150], [16000, 180]
]
/** PIT-RC Table 2: maximum property tax liability by modified gross income ($16,000 or less). */
export function nmMaxPropertyTaxLiability(mgi: number): number | null {
  const row = PROPERTY_MAX.find(([top]) => Math.max(0, mgi) <= top)
  return row ? row[1] : null
}

/** PIT-RC Table 3: additional low income property tax rebate percentage ($24,000 or less). */
export function nmLowIncomePropertyPercent(mgi: number): number {
  if (mgi <= 8000) return 0.75
  if (mgi > 24000) return 0
  return Math.round((0.7 - 0.05 * (Math.ceil(mgi / 2000) - 5)) * 100) / 100
}

/** Child day care worksheet: 40% of days × the daily amount (up to $8), up to $480 per child. */
export function nmDayCareChild(days: number, rate: number): number {
  return Math.min(480, r(0.4 * Math.max(0, days) * Math.min(8, Math.max(0, rate))))
}

/** Line 20 worksheet: credit for taxes paid to another state. */
export function nmOtherStateCredit(nmTax: number, nmTaxable: number, otherTax: number, otherTaxable: number, doubleTaxed: number): number {
  if (nmTax <= 0 || otherTax <= 0 || nmTaxable <= 0 || otherTaxable <= 0 || doubleTaxed <= 0) return 0
  const rate1 = Math.round((nmTax / nmTaxable) * 10000) / 10000
  const rate2 = Math.round((otherTax / otherTaxable) * 10000) / 10000
  const c1 = Math.min(doubleTaxed, nmTaxable) * rate1
  const c2 = Math.min(doubleTaxed, otherTaxable) * rate2
  return Math.min(r(Math.min(c1, c2)), nmTax)
}

export interface NmResult {
  lines: Record<string, number>
  adj: Record<string, number>
  rc: Record<string, number>
  exemptions: number
  boxes: { taxpayer65: boolean; taxpayerBlind: boolean; spouse65: boolean; spouseBlind: boolean }
  qualifyingChildren: number
  issues: string[]
  attach: string[]
}

export function computeNewMexico(ret: TaxReturnInput, res: TaxReturnResult): NmResult {
  const d = ret.nm
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const agi = r(f['11a'])
  const dependent = ret.canBeClaimedAsDependent
  const old = (p: TaxReturnInput['taxpayer']): boolean => p.age >= 65 || p.age65OrOlder
  const spouseShown = joint || fs === 'mfs'
  const boxes = { taxpayer65: old(ret.taxpayer), taxpayerBlind: ret.taxpayer.blind, spouse65: spouseShown && old(ret.spouse), spouseBlind: spouseShown && ret.spouse.blind }

  // ── Exemptions (line 5) ──
  const exemptions = dependent ? 0 : (joint ? 2 : 1) + ret.dependents.length
  L['5'] = exemptions

  // ── PIT-ADJ ──
  const A: Record<string, number> = {}
  A['1'] = r(pos(d.otherStateBondInterest))
  A['6'] = A['1']
  const kind = (id: string): NmRetirementKind => d.retirementKind[id] ?? 'standard'
  const mine = ret.retirement.filter((x) => owners.includes(x.owner))
  A['9'] = r(pos(d.usObligationInterest))
  A['10'] = r(mine.filter((x) => kind(x.id) === 'railroad').reduce((s, x) => s + pos(x.taxableAmount), 0))
  const seniorEach = nmSeniorExemption(agi, fs)
  const qualifying = owners.filter((o) => { const p = o === 'taxpayer' ? ret.taxpayer : ret.spouse; return old(p) || p.blind }).length
  A['13'] = seniorEach * qualifying
  A['15'] = r(pos(d.nm529))
  const sd = res.scheduleD
  A['16'] = Math.min(2500, r(pos(Math.min(pos(sd.longTerm), f['7a']))))
  A['17'] = r(pos(d.activeDutyPay))
  const any65 = owners.some((o) => old(o === 'taxpayer' ? ret.taxpayer : ret.spouse))
  A['18'] = any65 && d.bigMedical ? 3000 : 0
  A['21'] = r(pos(d.stateRefundInFagi))
  A['24'] = owners.reduce((s, o) => s + Math.min(30000, r(mine.filter((x) => x.owner === o && kind(x.id) === 'military').reduce((t, x) => t + pos(x.taxableAmount), 0))), 0)
  A['25'] = agi <= ({ single: 100000, mfs: 75000, mfj: 150000, hoh: 150000, qss: 150000 } as const)[fs] ? r(pos(f['6b'])) : 0
  A['28'] = ['9', '10', '13', '15', '16', '17', '18', '21', '24', '25'].reduce((s, k) => s + A[k], 0)

  // ── PIT-1 page 1 ──
  L['9'] = agi
  const itemized = res.deduction.used === 'itemized'
  const sa = res.scheduleA
  const salt5a = itemized && sa.saltBeforeCap > 0 ? sa.taxes * pos(ret.itemized.stateLocalIncomeOrSalesTax) / sa.saltBeforeCap : 0
  L['10'] = itemized ? r(Math.min(salt5a, pos(res.deduction.itemized - res.deduction.standard))) : 0
  L['11'] = A['6']
  L['12'] = r(f['12e'])
  L['13'] = !dependent && (joint || fs === 'hoh') ? pos(ret.dependents.length - 1) * 4000 : 0
  L['14'] = nmLowMiddleExemption(agi, fs, exemptions)
  L['15'] = A['28']
  L['17'] = pos(L['9'] + L['10'] + L['11'] - L['12'] - L['13'] - L['14'] - L['15'])
  L['18'] = nmTax(L['17'], fs)
  L['19'] = 0
  const os = d.otherState
  L['20'] = nmOtherStateCredit(L['18'], L['17'], r(pos(os.tax)), r(pos(os.taxableIncome)), r(pos(os.doubleTaxed)))
  const cr = d.crCredits.filter((c) => c.code.trim() && (c.applied > 0 || c.refund > 0))
  L['21'] = Math.min(L['18'] - L['20'], r(cr.reduce((t, c) => t + pos(c.applied), 0)))
  L['22'] = pos(L['18'] + L['19'] - L['20'] - L['21'])

  // ── PIT-RC ──
  const R: Record<string, number> = {}
  const rcTrue = !dependent
  R['1'] = exemptions
  R['2b'] = R['1']
  R['2c'] = (boxes.taxpayerBlind ? 1 : 0) + (joint && boxes.spouseBlind ? 1 : 0)
  R['2d'] = R['2b'] + R['2c']
  R['2e'] = boxes.taxpayer65 ? 2 : 0
  R['2f'] = joint && boxes.spouse65 ? 2 : 0
  R['2g'] = R['2d'] + R['2e'] + R['2f']
  R['3'] = R['2g']
  const mineW2 = ret.w2s.filter((w) => owners.includes(w.owner))
  R['4'] = r(mineW2.reduce((s, w) => s + pos(w.wages), 0))
  R['5'] = r(ret.socialSecurity.filter((x) => owners.includes(x.owner)).reduce((s, x) => s + pos(x.netBenefits), 0) + mine.reduce((s, x) => s + pos(x.grossDistribution), 0))
  R['6'] = r(pos(res.schedule1.unemployment))
  R['8'] = r(pos(res.schedule1.businessIncome) + pos(res.schedule1.rentalIncome))
  R['9'] = r(pos(f['7a']))
  R['11'] = r(pos(f['2b']) + pos(f['2a']) + pos(f['3b']) + pos(res.schedule1.otherIncome))
  R['12'] = Math.max(agi, R['4'] + R['5'] + R['6'] + R['8'] + R['9'] + R['11'])
  R['13'] = R['12']
  R['13a'] = R['3']
  R['14'] = rcTrue && R['13'] <= 36000 ? nmLowIncomeRebate(R['13'], R['13a']) : 0
  if (fs === 'mfs') R['14'] = r(R['14'] / 2)
  // Section 3: property tax rebate for persons 65 or older.
  const mfs = fs === 'mfs'
  const maxLiability = nmMaxPropertyTaxLiability(R['13'])
  R['15'] = r(pos(d.propertyTax))
  R['16a'] = r(pos(d.rentPaid))
  R['16c'] = r(R['16a'] * 0.06)
  R['17a'] = R['15'] + R['16c']
  R['17b'] = maxLiability ?? 0
  R['17c'] = rcTrue && any65 && maxLiability !== null ? Math.min(mfs ? 125 : 250, pos(R['17a'] - R['17b'])) : 0
  // Section 4: additional low income property tax rebate (Los Alamos, Santa Fe, Doña Ana, Bernalillo).
  R['18a'] = R['15']
  R['18bPct'] = d.county && R['13'] <= 24000 ? nmLowIncomePropertyPercent(R['13']) : 0
  R['18c'] = rcTrue ? Math.min(mfs ? 175 : 350, r(R['18a'] * R['18bPct'])) : 0
  // Section 5: child day care credit.
  const careKids = ret.dependents.filter((x) => x.age < 15 && (d.dayCare[x.id]?.days ?? 0) > 0)
  R['19'] = R['13'] <= 30160 ? Math.min(1200, careKids.reduce((t, x) => t + nmDayCareChild(d.dayCare[x.id].days, d.dayCare[x.id].rate), 0)) : 0
  R['20'] = R['19'] > 0 ? careKids.length : 0
  R['21'] = R['19'] > 0 ? r(pos(res.schedule3.dependentCare)) : 0
  R['22'] = rcTrue ? pos(R['19'] - R['21']) : 0
  if (mfs) R['22'] = r(R['22'] / 2)
  R['23'] = any65 && d.bigMedical ? 2800 : 0
  R['24'] = rcTrue ? r(pos(d.specialNeedsAdoptions)) * (mfs ? 750 : 1500) : 0
  const qualifyingChildren = ret.dependents.filter((x) => x.childRelationship && (x.age < 19 || (x.student && x.age < 24) || x.disabled) && x.monthsLivedWithYou > 6).length
  R['25'] = rcTrue ? nmChildCreditPerChild(agi) * qualifyingChildren : 0
  if (fs === 'mfs') R['25'] = r(R['25'] / 2)
  R['26'] = R['14'] + R['17c'] + R['18c'] + R['22'] + R['23'] + R['24'] + R['25']

  // ── PIT-1 page 2 ──
  L['23'] = L['22']
  L['24'] = R['26']
  L['25a'] = r(pos(f['27a']))
  L['25'] = r(L['25a'] * 0.25)
  L['26'] = r(cr.reduce((t, c) => t + pos(c.refund), 0))
  L['27'] = r(mineW2.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0) + pos(d.withholdingOther))
  L['30'] = r(pos(d.estimatedPayments))
  L['32'] = L['24'] + L['25'] + L['26'] + L['27'] + L['30']
  L['33'] = pos(L['22'] - L['32'])
  L['38'] = L['33']
  L['39'] = pos(L['32'] - L['23'])
  L['40'] = Math.min(L['39'], r(pos(d.contributions)))
  L['41'] = Math.min(L['39'] - L['40'], r(pos(d.creditForward)))
  L['42'] = L['39'] - L['40'] - L['41']

  // ── Notes ──
  attach.push('Your W-2s and 1099s showing New Mexico tax withheld')
  if (L['11'] + L['15'] > 0) attach.push('Schedule PIT-ADJ')
  if (L['24'] > 0) attach.push('Schedule PIT-RC')
  if (L['21'] + L['26'] > 0) attach.push('Schedule PIT-CR and the claim form and approval for each credit')
  if (cr.length > 5) attach.push('PIT-CR Supplemental (credits 6 and up) — not filled in here')
  if (L['20'] > 0) attach.push(`The Line 20 worksheet and a copy of your ${os.name.trim() || 'other state’s'} return`)
  if (ret.dependents.length > 5) attach.push('Schedule PIT-S (dependents 6 and up)')
  if (R['22'] > 0) attach.push('The Child Day Care Credit Worksheet and a Form PIT-CG from each caregiver')
  if (R['24'] > 0) attach.push('The special needs certificate (first year claimed)')
  if (L['40'] > 0) attach.push('Schedule PIT-D (voluntary contributions) — not filled in here')
  if (R['18c'] > 0 || R['17c'] > 0) attach.push('Your property tax bill or rent records (keep them; do not send)')
  if (R['19'] > 0 && joint) issues.push('Child day care credit: both spouses must have worked (or attended school) during the care period.')
  if (careKids.length && R['13'] > 30160) issues.push('Modified gross income is over $30,160, so there is no child day care credit.')
  if (d.county && R['13'] > 24000) issues.push('Modified gross income is over $24,000, so there is no additional low income property tax rebate.')
  if (mine.some((x) => x.taxableAmount > 0) && Object.keys(d.retirementKind).length === 0) issues.push('Mark armed forces or railroad retirement among your 1099-Rs: armed forces retirement is exempt up to $30,000 each and railroad retirement in full.')
  if (A['25'] === 0 && f['6b'] > 0) issues.push('Federal AGI is above the limit, so Social Security is taxed in New Mexico.')
  if (L['10'] > 0) issues.push('You itemized: the state income tax part of your federal SALT deduction is added back (line 10, worksheet estimate).')
  if (L['33'] > 1000 && L['30'] === 0) issues.push('Tax due of $1,000 or more may mean an underpayment penalty (PIT-ES).')

  return { lines: L, adj: A, rc: R, exemptions, boxes, qualifyingChildren, issues, attach }
}
