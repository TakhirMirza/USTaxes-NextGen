/**
 * Maryland Form 502, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Maryland Resident Tax Booklet (Comptroller of Maryland), Form 502, Form 502B, Form 502SU.
 * Line numbers are Form 502 lines. Maryland starts from federal AGI (Form 1040 line 11), so this builds
 * on the computed federal return. Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

// ── 2025 parameters ──────────────────────────────────────────────────────────
export const MD_STANDARD_DEDUCTION = { low: 3350, high: 6700 }
export const MD_EXEMPTION = 3200
export const MD_AGE_BLIND_EXEMPTION = 1000
export const MD_PENSION_EXCLUSION_MAX = 41200
export const MD_TWO_INCOME_MAX = 1200
export const MD_ITEMIZED_PHASEOUT = { threshold: 200000, mfsThreshold: 100000, rate: 0.075 }
export const MD_CAPITAL_GAIN_SURTAX = { agi: 350000, rate: 0.02 }
export const MD_POVERTY = [15650, 21150, 26650, 32150, 37650, 43150, 48650, 54150]
export const MD_POVERTY_EXTRA = 5500
export const MD_SENIOR_CREDIT = { single: 1000, singleAgi: 100000, joint: 1750, jointOne: 1000, jointAgi: 150000 }
export const MD_CHILD_CREDIT = { amount: 500, threshold: 15000, reduction: 50, limit: 24000 }

/** [rate, over] — Tax Rate Schedule I (single, MFS, dependent) and II (joint, HOH, QSS). */
const SCHEDULE_I: [number, number][] = [[0.02, 0], [0.03, 1000], [0.04, 2000], [0.0475, 3000], [0.05, 100000], [0.0525, 125000], [0.055, 150000], [0.0575, 250000], [0.0625, 500000], [0.065, 1000000]]
const SCHEDULE_II: [number, number][] = [[0.02, 0], [0.03, 1000], [0.04, 2000], [0.0475, 3000], [0.05, 150000], [0.0525, 175000], [0.055, 225000], [0.0575, 300000], [0.0625, 600000], [0.065, 1200000]]

/** Counties and Baltimore City: 4-digit political subdivision code (county level), name, local rate. */
export const MD_COUNTIES: readonly { code: string; name: string; rate: number | 'anne-arundel' | 'frederick' }[] = [
  { code: '0100', name: 'Allegany County', rate: 0.0303 },
  { code: '0200', name: 'Anne Arundel County', rate: 'anne-arundel' },
  { code: '0300', name: 'Baltimore County', rate: 0.032 },
  { code: '0400', name: 'Baltimore City', rate: 0.032 },
  { code: '0500', name: 'Calvert County', rate: 0.032 },
  { code: '0600', name: 'Caroline County', rate: 0.032 },
  { code: '0700', name: 'Carroll County', rate: 0.0303 },
  { code: '0800', name: 'Cecil County', rate: 0.0274 },
  { code: '0900', name: 'Charles County', rate: 0.0303 },
  { code: '1000', name: 'Dorchester County', rate: 0.033 },
  { code: '1100', name: 'Frederick County', rate: 'frederick' },
  { code: '1200', name: 'Garrett County', rate: 0.0265 },
  { code: '1300', name: 'Harford County', rate: 0.0306 },
  { code: '1400', name: 'Howard County', rate: 0.032 },
  { code: '1500', name: 'Kent County', rate: 0.032 },
  { code: '1600', name: 'Montgomery County', rate: 0.032 },
  { code: '1700', name: 'Prince George’s County', rate: 0.032 },
  { code: '1800', name: 'Queen Anne’s County', rate: 0.032 },
  { code: '1900', name: 'St. Mary’s County', rate: 0.032 },
  { code: '2000', name: 'Somerset County', rate: 0.032 },
  { code: '2100', name: 'Talbot County', rate: 0.024 },
  { code: '2200', name: 'Washington County', rate: 0.0295 },
  { code: '2300', name: 'Wicomico County', rate: 0.032 },
  { code: '2400', name: 'Worcester County', rate: 0.0225 }
]
export const mdCounty = (code: string) => MD_COUNTIES.find((c) => c.code === `${code.slice(0, 2)}00`)

/** Form 502SU codes the app names. */
export const MD_SUBTRACTION_CODES: Record<string, string> = {
  a: 'Fire, police pension for job-related disability',
  k: 'Adoption expenses',
  p: 'Overseas military pay',
  r: 'State retirement pickup on Form 1099-R',
  s: 'Child’s interest and dividends on your return',
  u: 'Military retirement income',
  v: 'Public safety retirement income (55 or older)',
  w: 'Unreimbursed foster parent expenses',
  xa: 'Maryland Prepaid College Trust (up to $2,500)',
  xb: 'Maryland 529 College Investment Plan (up to $2,500 per beneficiary)',
  xd: 'Maryland ABLE contributions (up to $2,500)',
  ii: 'Build America Bond interest',
  ll: 'Foreclosure settlement payment',
  nn: 'Student loan debt discharged',
  yc: 'Union dues'
}
export const MD_ADDITION_CODES: Record<string, string> = {
  b: 'Pass-through entity additions',
  g: 'Income exempt federally but taxed by Maryland',
  l: 'Depreciation decoupling (Form 500DM)',
  k: 'Maryland 529 or Prepaid College refunds',
  p: 'ABLE account refunds',
  s: 'First-time homebuyer account withdrawal'
}

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export type MdStatus = 1 | 2 | 3 | 4 | 5 | 6
export function mdStatus(ret: TaxReturnInput): MdStatus {
  if (ret.canBeClaimedAsDependent) return 6
  return ({ single: 1, mfj: 2, mfs: 3, hoh: 4, qss: 5 } as const)[ret.filingStatus]
}
const usesScheduleII = (s: MdStatus): boolean => s === 2 || s === 4 || s === 5

function scheduleTax(income: number, s: [number, number][]): number {
  let tax = 0
  s.forEach(([rate, over], i) => {
    const next = s[i + 1]?.[1] ?? Infinity
    if (income > over) tax += (Math.min(income, next) - over) * rate
  })
  return tax
}

/** Maryland tax: the tax table under $100,000 (figured at the middle of each $50 row), the worksheet schedules above. */
export function mdTax(taxable: number, status: MdStatus): number {
  const t = pos(taxable)
  const sched = usesScheduleII(status) ? SCHEDULE_II : SCHEDULE_I
  if (t >= 100000) return r(scheduleTax(t, sched))
  if (t < 50) return 0
  const width = t < 100 ? 25 : 50
  const base = t < 100 ? 50 : 100
  const mid = base + Math.floor((t - base) / width) * width + width / 2
  return r(scheduleTax(mid, sched))
}

/** Local income tax from the 2025 Local Tax Rate Chart and Worksheet (19A). */
export function mdLocalTax(taxable: number, county: (typeof MD_COUNTIES)[number] | undefined, status: MdStatus): { tax: number; rate: number } {
  const t = pos(taxable)
  if (!county || t <= 0) return { tax: 0, rate: typeof county?.rate === 'number' ? county.rate : 0 }
  const joint = usesScheduleII(status)
  if (county.rate === 'anne-arundel') {
    const [a, b] = joint ? [75000, 480000] : [50000, 400000]
    const tax = t <= a ? t * 0.027 : t <= b ? a * 0.027 + (t - a) * 0.0294 : a * 0.027 + (b - a) * 0.0294 + (t - b) * 0.032
    return { tax: r(tax), rate: 0.027 }
  }
  if (county.rate === 'frederick') {
    const tiers = joint ? [25000, 100000, 250000] : [25000, 50000, 150000]
    const rate = t <= tiers[0] ? 0.0225 : t <= tiers[1] ? 0.0275 : t <= tiers[2] ? 0.0296 : 0.032
    return { tax: r(t * rate), rate }
  }
  return { tax: r(t * county.rate), rate: county.rate }
}

/** Each exemption by federal AGI (Exemption Amount Chart 10A). */
export function mdExemptionEach(fagi: number, status: MdStatus): number {
  if (status === 6) return 0
  if (usesScheduleII(status)) return fagi <= 150000 ? 3200 : fagi <= 175000 ? 1600 : fagi <= 200000 ? 800 : 0
  return fagi <= 100000 ? 3200 : fagi <= 125000 ? 1600 : fagi <= 150000 ? 800 : 0
}

export const mdPoverty = (people: number): number => (people <= 8 ? MD_POVERTY[Math.max(1, people) - 1] : MD_POVERTY[7] + (people - 8) * MD_POVERTY_EXTRA)

export interface MdLine { code: string; label: string; amount: number; auto: boolean }

export interface MdResult {
  /** Form 502CG lines, when federal AGI is over $350,000 and there is net capital gain. */
  cg: Record<string, number> | null
  status: MdStatus
  county: (typeof MD_COUNTIES)[number] | undefined
  lines: Record<string, number>
  localRate: number
  exemptions: { a: number; aAmount: number; b: number; bAmount: number; c: number; cAmount: number; d: number; dAmount: number; each: number; you65: boolean; spouse65: boolean; youBlind: boolean; spouseBlind: boolean; deps65: number }
  pension: { taxpayer: number; spouse: number }
  twoIncome: { taxpayer: number; spouse: number } | null
  subtractions: MdLine[]
  additions: MdLine[]
  deduction: { method: 'standard' | 'itemized'; standard: number; itemized: number; federalItemized: number; incomeTaxes: number; phaseout: number }
  eic: { worksheet: '18A' | '18A.1' | ''; federal: number }
  poverty: { eligible: boolean; people: number; guideline: number }
  credits: { senior: number; childTaxCredit: number }
  issues: string[]
  /** Forms and attachments the app does not fill. */
  attach: string[]
}

const personAge65 = (ret: TaxReturnInput, o: Owner): boolean => {
  const p = o === 'spouse' ? ret.spouse : ret.taxpayer
  return p.age65OrOlder || p.age >= 65
}

export function computeMaryland(ret: TaxReturnInput, res: TaxReturnResult): MdResult {
  const m = ret.maryland
  const f = res.f1040
  const status = mdStatus(ret)
  const joint = status === 2
  const people: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const county = mdCounty(m.subdivisionCode || '')
  const fagi = r(f['11a'])

  // ── Income ──
  L['1'] = fagi
  L['1a'] = r(f['1z'])
  const seNet = res.scheduleC.filter((c) => people.includes(c.owner)).reduce((s, c) => s + pos(c.netProfit), 0)
  L['1b'] = r(L['1a'] + seNet)
  L['1c'] = r(f['7a'])
  L['1d'] = r(f['4b'] + f['5b'])
  const investment = f['2b'] + f['3b'] + pos(f['7a'])
  L['1e'] = investment > 11950 ? 1 : 0

  // ── Additions ──
  L['2'] = r(pos(m.otherStateBondInterest))
  L['3'] = r(pos(m.statePickup))
  L['4'] = 0
  const additions: MdLine[] = m.additions.filter((a) => a.code && a.amount).map((a) => ({ code: a.code, label: MD_ADDITION_CODES[a.code] ?? `Code ${a.code}`, amount: r(pos(a.amount)), auto: false }))
  L['5'] = additions.reduce((s, a) => s + a.amount, 0)
  L['6'] = L['2'] + L['3'] + L['4'] + L['5']
  L['7'] = L['1'] + L['6']

  // ── Subtractions ──
  L['8'] = r(pos(m.stateRefundInFagi))
  const careLimit = res.form2441.qualifyingPersons >= 2 ? 6000 : 3000
  L['9'] = res.form2441.expensesUsed > 0 ? r(Math.min(res.form2441.expensesUsed, careLimit)) : 0
  // Pension exclusion (Worksheet 13A): employer plans only, 65 or older or totally disabled.
  const pension: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
  for (const o of people) {
    const eligible = personAge65(ret, o) || m.totallyDisabled[o] || (joint && m.totallyDisabled[o === 'taxpayer' ? 'spouse' : 'taxpayer'])
    if (!eligible) continue
    const plan = ret.retirement.filter((x) => x.owner === o && !x.ira).reduce((s, x) => s + pos(x.taxableAmount), 0)
    const ss = ret.socialSecurity.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.netBenefits), 0)
    pension[o] = r(Math.min(plan, pos(MD_PENSION_EXCLUSION_MAX - ss)))
  }
  L['10a'] = pension.taxpayer + pension.spouse
  L['10b'] = 0
  L['11'] = r(f['6b'])
  L['12'] = 0
  const subtractions: MdLine[] = []
  if (m.usObligationInterest > 0) subtractions.push({ code: 'ab', label: 'Income from U.S. Government obligations', amount: r(m.usObligationInterest), auto: false })
  for (const s of m.subtractions) {
    if (!s.code || !s.amount) continue
    const same = subtractions.find((x) => x.code === s.code)
    if (same) same.amount += r(pos(s.amount))
    else subtractions.push({ code: s.code, label: MD_SUBTRACTION_CODES[s.code] ?? `Code ${s.code}`, amount: r(pos(s.amount)), auto: false })
  }
  L['13'] = subtractions.reduce((s, x) => s + x.amount, 0)

  // Two-income married couple subtraction (Worksheet 13D): each spouse's income less subtractions; joint items split in half.
  let twoIncome: MdResult['twoIncome'] = null
  L['14'] = 0
  if (joint) {
    const owned: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
    ret.w2s.forEach((w) => { owned[w.owner] += w.wages })
    ret.retirement.forEach((x) => { owned[x.owner] += x.taxableAmount })
    const ssTotal = ret.socialSecurity.reduce((s, x) => s + x.netBenefits, 0)
    const ssShare: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
    if (ssTotal > 0) ret.socialSecurity.forEach((x) => { ssShare[x.owner] += f['6b'] * (x.netBenefits / ssTotal) })
    owned.taxpayer += ssShare.taxpayer
    owned.spouse += ssShare.spouse
    res.scheduleC.forEach((c) => { owned[c.owner] += c.netProfit })
    res.scheduleSE.forEach((se) => { owned[se.owner] -= se.total / 2 })
    const jointPart = fagi - owned.taxpayer - owned.spouse
    const shared = (L['6'] - (L['8'] + L['9'] + L['13'])) / 2
    const each = (o: Owner): number => owned[o] + jointPart / 2 + shared - pension[o] - ssShare[o]
    twoIncome = { taxpayer: r(each('taxpayer')), spouse: r(each('spouse')) }
    L['14'] = Math.min(MD_TWO_INCOME_MAX, pos(Math.min(twoIncome.taxpayer, twoIncome.spouse)))
  }
  L['15'] = L['8'] + L['9'] + L['10a'] + L['10b'] + L['11'] + L['12'] + L['13'] + L['14']
  L['16'] = L['7'] - L['15']

  // ── Deduction ──
  const standard = usesScheduleII(status) ? MD_STANDARD_DEDUCTION.high : MD_STANDARD_DEDUCTION.low
  const federalItemized = res.deduction.used === 'itemized' ? r(res.deduction.itemized) : 0
  const saltBefore = res.scheduleA.saltBeforeCap ?? 0
  const saltAllowed = res.scheduleA.taxes ?? 0
  const incomeTaxRaw = pos(ret.itemized.stateLocalIncomeOrSalesTax)
  // State and local income taxes deducted federally (their share of the capped SALT deduction).
  const incomeTaxes = federalItemized > 0 && saltBefore > 0 ? r(incomeTaxRaw * Math.min(1, saltAllowed / saltBefore)) : 0
  const phaseout = federalItemized > 0 ? r(pos(fagi - (status === 3 ? MD_ITEMIZED_PHASEOUT.mfsThreshold : MD_ITEMIZED_PHASEOUT.threshold)) * MD_ITEMIZED_PHASEOUT.rate) : 0
  const itemized = federalItemized > 0 ? pos(federalItemized - incomeTaxes - phaseout) : 0
  const method: 'standard' | 'itemized' = federalItemized > 0 && (m.deductionMethod === 'itemized' || (m.deductionMethod === 'auto' && itemized > standard)) ? 'itemized' : 'standard'
  if (method === 'itemized') {
    L['17a'] = federalItemized
    L['17b'] = incomeTaxes
    L['17c'] = phaseout
    L['17'] = itemized
  } else L['17'] = standard
  L['18'] = L['16'] - L['17']

  // ── Exemptions ──
  const each = mdExemptionEach(fagi, status)
  const a = status === 6 ? 0 : 1 + (joint ? 1 : 0)
  const you65 = personAge65(ret, 'taxpayer')
  const spouse65 = joint && personAge65(ret, 'spouse')
  const youBlind = ret.taxpayer.blind
  const spouseBlind = joint && ret.spouse.blind
  const b = status === 6 ? 0 : [you65, spouse65, youBlind, spouseBlind].filter(Boolean).length
  const deps65 = ret.dependents.filter((d) => d.age >= 65).length
  const c = status === 6 ? 0 : ret.dependents.length + deps65
  const exemptions = {
    a, aAmount: a * each, b, bAmount: b * MD_AGE_BLIND_EXEMPTION, c, cAmount: c * each, d: a + b + c, dAmount: a * each + b * MD_AGE_BLIND_EXEMPTION + c * each,
    each, you65, spouse65, youBlind, spouseBlind, deps65
  }
  L['19'] = exemptions.dAmount
  L['20'] = pos(L['18'] - L['19'])

  // Additional 2% tax on net capital gain income (Form 502CG) for federal AGI over $350,000.
  const cgLines = (['2', '3', '4', '5', '6', '7'] as const).map((k) => r(pos(m.cg[k])))
  const cgExcluded = cgLines.some((x) => x > 0) ? cgLines.reduce((s, x) => s + x, 0) : r(pos(m.capitalGainExclusions))
  L['20a'] = fagi > MD_CAPITAL_GAIN_SURTAX.agi ? r(pos(f['7a']) - cgExcluded) : 0
  // Form 502CG lines 1–9.
  const CG: Record<string, number> | null = fagi > MD_CAPITAL_GAIN_SURTAX.agi && pos(f['7a']) > 0 ? { '1': r(pos(f['7a'])), '1a': r(pos(m.cg.k1)), ...Object.fromEntries(cgLines.map((x, i) => [String(i + 2), x])), '8': cgExcluded } : null
  if (CG) CG['9'] = pos(CG['1'] - CG['8'])
  if (L['20a'] < 0) L['20a'] = 0

  // ── Maryland tax and credits ──
  L['21'] = mdTax(L['20'], status)
  L['21a'] = 0
  L['21b'] = r(L['20a'] * MD_CAPITAL_GAIN_SURTAX.rate)
  const mdTaxTotal = L['21'] + L['21a'] + L['21b']
  const fedEic = r(res.eic.credit)
  const hasChild = res.eic.qualifyingChildren > 0
  const worksheet: '18A' | '18A.1' | '' = fedEic <= 0 ? '' : !hasChild && (status === 1 || status === 4 || status === 5) ? '18A.1' : '18A'
  L['22'] = worksheet === '18A.1' ? fedEic : worksheet === '18A' ? r(fedEic * 0.5) : 0
  // Poverty level credit (Worksheet 18B).
  const household = 1 + (joint ? 1 : 0) + ret.dependents.length
  const guideline = mdPoverty(household)
  const earned = L['1b']
  const povertyEligible = status !== 6 && earned > 0 && Math.max(L['7'], earned) < guideline && mdTaxTotal > L['22']
  L['23'] = povertyEligible ? r(earned * 0.05) : 0
  // Senior tax credit (Form 502CR Part M).
  let senior = 0
  if (usesScheduleII(status)) {
    if (fagi <= MD_SENIOR_CREDIT.jointAgi) senior = joint && you65 && spouse65 ? MD_SENIOR_CREDIT.joint : you65 || spouse65 ? MD_SENIOR_CREDIT.jointOne : 0
  } else if (status !== 6 && fagi <= MD_SENIOR_CREDIT.singleAgi && you65) senior = MD_SENIOR_CREDIT.single
  L['24'] = senior + r(pos(m.otherCredits))
  L['26'] = L['22'] + L['23'] + L['24']
  L['27'] = pos(mdTaxTotal - L['26'])

  // ── Local tax ──
  const local = mdLocalTax(L['20'], county, status)
  L['28'] = local.tax
  const creditRate = county?.rate === 'anne-arundel' ? 0.027 : local.rate
  L['29'] = L['22'] > 0 ? r(fedEic * creditRate * 10) : 0
  L['30'] = L['23'] > 0 ? r(earned * creditRate) : 0
  L['31'] = r(pos(m.localCredits))
  L['32'] = L['29'] + L['30'] + L['31']
  L['33'] = pos(L['28'] - L['32'])
  L['34'] = L['27'] + L['33']
  const contributions = m.contributions.map((x) => r(pos(x)))
  ;['35', '36', '37', '38', '39'].forEach((k, i) => { L[k] = contributions[i] ?? 0 })
  L['40'] = L['34'] + L['35'] + L['36'] + L['37'] + L['38'] + L['39']

  // ── Payments and refundable credits ──
  L['41'] = r(pos(m.withholding))
  L['42'] = 0
  L['43'] = r(pos(m.estimatedPayments))
  L['44'] = worksheet === '18A' ? pos(r(fedEic * 0.45) - mdTaxTotal) : worksheet === '18A.1' ? pos(fedEic - mdTaxTotal) : 0
  // Maryland Child Tax Credit: $500 per dependent under 6 (or disabled, under 17), reduced $50 per $1,000 of AGI over $15,000.
  const ctcKids = ret.dependents.filter((d) => d.age < 6 || (d.disabled && d.age < 17)).length
  const ctcEach = fagi <= MD_CHILD_CREDIT.threshold ? MD_CHILD_CREDIT.amount
    : fagi > MD_CHILD_CREDIT.limit ? 0 : pos(MD_CHILD_CREDIT.amount - MD_CHILD_CREDIT.reduction * Math.ceil((fagi - MD_CHILD_CREDIT.threshold) / 1000))
  const childTaxCredit = status === 3 || status === 6 ? 0 : ctcKids * ctcEach
  L['45'] = childTaxCredit + r(pos(m.refundableCredits))
  L['46'] = L['41'] + L['42'] + L['43'] + L['44'] + L['45']
  L['47'] = pos(L['40'] - L['46'])
  L['48'] = pos(L['46'] - L['40'])
  L['49'] = Math.min(r(pos(m.creditForward)), L['48'])
  L['50'] = L['48'] - L['49']
  L['51'] = 0
  L['52'] = L['47'] + L['51']

  // ── Notes ──
  if (!county) issues.push('Choose the Maryland county (or Baltimore City) you lived in on December 31, 2025: it sets your local income tax.')
  if (federalItemized > 0) issues.push(method === 'itemized'
    ? `Itemizing saves more than the ${standard.toLocaleString('en-US')} standard deduction. State and local income taxes (${incomeTaxes.toLocaleString('en-US')}) are removed${phaseout ? ` and ${phaseout.toLocaleString('en-US')} is phased out for income over the threshold` : ''}.`
    : `The ${standard.toLocaleString('en-US')} standard deduction is larger than your Maryland itemized deductions (${itemized.toLocaleString('en-US')}).`)
  if (federalItemized > 0 && ret.itemized.stateLocalIncomeOrSalesTax > 0) issues.push('Line 17b assumes the state and local tax on your federal Schedule A is income tax. If you deducted sales tax instead, choose the deduction method yourself.')
  if (L['10a'] > 0) attach.push('Form 502R (retirement income; required with the pension exclusion)')
  else if (ret.socialSecurity.length || ret.retirement.length) attach.push('Form 502R (retirement income: Social Security, pensions or IRA distributions)')
  if (senior > 0 || L['24'] > senior) attach.push(`Form 502CR (${senior > 0 ? `Part M, senior tax credit ${senior.toLocaleString('en-US')}` : 'credits on line 24'})`)
  if (childTaxCredit > 0) attach.push(`Form 502CR Part CC (Maryland Child Tax Credit ${childTaxCredit.toLocaleString('en-US')}) and Worksheet 21C`)
  if (L['20a'] > 0) {
    attach.push('Form 502CG (additional 2% tax on net capital gain income)')
    issues.push('Federal AGI is over $350,000, so Maryland adds 2% on net capital gain income. Gains on a primary residence sold for $1.5 million or less, retirement accounts and some other assets are excluded on Form 502CG: enter excluded gains if you have them.')
  }
  if (L['31'] > 0 || m.refundableCredits > 0) attach.push('Form 502CR (local and refundable credits)')
  if (res.form2441.credit > 0) issues.push('You may also qualify for Maryland’s child and dependent care credit (Form 502CR Part B), which is not figured here; enter it under other credits.')
  if (status === 6) issues.push('You can be claimed as a dependent, so Maryland filing status 6 applies: no personal exemption and no poverty level credit.')
  if (ret.dependents.length && ret.dependents.some((d) => !m.dependentBirthDates[d.id])) issues.push('Form 502B requires each dependent’s date of birth.')
  if (L['47'] > 1000 && L['43'] === 0) issues.push('You owe more than $1,000 with no estimated payments: Maryland may charge interest for underpaid estimated tax (Form 502UP), not figured here.')
  return {
    cg: CG, status, county, lines: L, localRate: local.rate, exemptions, pension, twoIncome, subtractions, additions,
    deduction: { method, standard, itemized, federalItemized, incomeTaxes, phaseout },
    eic: { worksheet, federal: fedEic }, poverty: { eligible: povertyEligible, people: household, guideline },
    credits: { senior, childTaxCredit }, issues, attach
  }
}
