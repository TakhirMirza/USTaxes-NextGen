/**
 * Virginia Form 760, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form 760 Resident Individual Income Tax Booklet (Virginia Department of Taxation),
 * Form 760, Schedule ADJ. Line numbers below are Form 760 lines unless marked "ADJ".
 *
 * Virginia starts from federal adjusted gross income (Form 1040 line 11), so everything here builds
 * on the computed federal return. Amounts are whole dollars, as the form requires.
 */
import type { TaxReturnInput, Owner, VaAdjEntry } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { assetDepreciation, midQuarterApplies } from './depreciation.ts'
import { parseDate } from './capital.ts'

// ── 2025 parameters ──────────────────────────────────────────────────────────
export const VA_STANDARD_DEDUCTION = { 1: 8750, 2: 17500, 3: 8750 } as const
export const VA_PERSONAL_EXEMPTION = 930
export const VA_AGE_BLIND_EXEMPTION = 800
export const VA_FILING_THRESHOLD = { 1: 11950, 2: 23900, 3: 11950 } as const
export const VA_AGE_DEDUCTION = 12000
export const VA_AGE_INCOME_LIMIT = { single: 50000, married: 75000 }
export const VA_STA_MAX = 259
export const VA_LOW_INCOME_PER_EXEMPTION = 300
export const VA_EITC_RATE = 0.20
/** Poverty guidelines for 1–8 exemptions; add $5,500 for each one after 8. */
export const VA_POVERTY = [15650, 21150, 26650, 32150, 37650, 43150, 48650, 54150]
export const VA_POVERTY_EXTRA = 5500
export const VA_DISABILITY_MAX = 20000
export const VA_SAVERS_LIMIT = 4000
export const VA_MILITARY_BASIC_PAY_MAX = 15000

export type VaStatus = 1 | 2 | 3

/** Schedule ADJ codes the app knows by name. Any other code can still be entered. */
export const VA_ADDITION_CODES: Record<string, string> = {
  '10': 'Interest on federally exempt U.S. obligations',
  '11': 'Accumulation distribution income',
  '12': 'Lump-sum distribution income',
  '14': 'Income from dealer disposition of property',
  '17': 'First-time home buyer savings account',
  '19': 'Federal partnership income addition',
  '20': 'Pass-through entity tax add back',
  '99': 'Other addition'
}
export const VA_SUBTRACTION_CODES: Record<string, string> = {
  '20': 'Income from Virginia obligations',
  '21': 'Federal Work Opportunity Tax Credit wages',
  '24': 'Virginia lottery prizes',
  '28': 'Virginia National Guard income',
  '30': 'Military pay for active duty in a combat zone',
  '31': 'Retirement income previously taxed by another state',
  '34': 'Commonwealth Savers distribution or refund',
  '37': 'Unemployment compensation',
  '38': 'Military basic pay',
  '39': 'Federal and state employees (salary $15,000 or less)',
  '40': 'Income received by Holocaust victims',
  '44': 'Congressional Medal of Honor recipients',
  '49': 'Certain death benefit payments',
  '51': 'Gains from land preservation',
  '52': 'Certain long-term capital gains',
  '53': 'Historic rehabilitation',
  '54': 'First-time home buyer savings account',
  '55': 'Discharge of student loans',
  '58': 'Gain from eminent domain',
  '59': 'Federal partnership income subtraction',
  '60': 'Military benefits (retirement, SBP), up to $40,000',
  '99': 'Other subtraction'
}
export const VA_DEDUCTION_CODES: Record<string, string> = {
  '101': 'Child and dependent care expenses',
  '102': 'Foster care ($1,000 per child)',
  '103': 'Bone marrow screening fee',
  '104': 'Commonwealth Savers (Virginia529) contributions',
  '105': 'Continuing teacher education (20%)',
  '106': 'Long-term health care premiums',
  '107': 'Public School Construction Grants contributions',
  '109': 'Sales tax on certain energy-efficient equipment',
  '110': 'Organ and tissue donor expenses',
  '111': 'Charitable mileage',
  '112': 'Virginia bank franchise tax',
  '115': 'ABLEnow account contributions',
  '116': 'Business interest deduction',
  '199': 'Other deduction'
}
/** Subtractions that rule out the Credit for Low-Income Individuals and the Virginia EIC. */
const BARS_CREDITS = new Set(['38', '39'])

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Tax rate schedule: 2% to $3,000; 3% to $5,000; 5% to $17,000; 5.75% above. */
export function vaTax(taxable: number): number {
  const t = pos(taxable)
  let tax: number
  if (t <= 3000) tax = t * 0.02
  else if (t <= 5000) tax = 60 + (t - 3000) * 0.03
  else if (t <= 17000) tax = 120 + (t - 5000) * 0.05
  else tax = 720 + (t - 17000) * 0.0575
  return r(tax)
}

export const povertyGuideline = (people: number): number =>
  people <= 0 ? 0 : people <= 8 ? VA_POVERTY[people - 1] : VA_POVERTY[7] + (people - 8) * VA_POVERTY_EXTRA

export interface VaLine { code: string; label: string; amount: number; auto: boolean; owner?: Owner }

export interface VaAgeDeduction {
  /** Per person: 'full' (born on or before 1/1/1939), 'income' (born 1/2/1939–1/1/1961), 'none'. */
  kind: Record<Owner, 'full' | 'income' | 'none'>
  claimants: number; fagi: number; conformityAdd: number; conformitySub: number; taxableSs: number
  afagi: number; limit: number; excess: number; amount: Record<Owner, number>; total: number
  birthDateMissing: boolean
}

export interface VaSta {
  vagi: Record<Owner, number>; exemptions: Record<Owner, number>; separate: Record<Owner, number>
  line4: number; line5: number; line6: number; line7: number; line8: number; line9: number; line10: number; line11: number
  amount: number; qualifies: boolean; capped: boolean
}

export interface VaLowIncome {
  familyVagi: number; familySize: number; poverty: number; eligible: boolean; exemptions: number
  line13: number; line14: number; line16b: number; nonrefundable: number; line17: number
  option: 'refundable' | 'nonrefundable' | 'none'
}

export interface VaResult {
  status: VaStatus
  hoh: boolean
  /** Which of the mutually exclusive benefits was used: the age deduction, or the low-income / earned income credit. */
  path: 'age' | 'credit'
  exemptions: { you: number; spouse: number; dependents: number; countA: number; amountA: number; age65: Record<Owner, boolean>; blind: Record<Owner, boolean>; countB: number; amountB: number }
  /** Form 760 lines, keyed by line number ('4' total; '19a', '19b', ...). */
  lines: Record<string, number>
  adj: {
    /** ADJ line 2a parts: bonus depreciation recomputed (A) and other conformity additions (B). */
    bonusAddition: number; otherConformity: number
    additions: VaLine[]; subtractions: VaLine[]; deductions: VaLine[]
    lines: Record<string, number>
    /** More coded lines than the form has room for (Schedule ADJS needed). */
    overflow: string[]
    needed: boolean
  }
  age: VaAgeDeduction
  sta: VaSta | null
  lowIncome: VaLowIncome
  itemized: { used: boolean; estimated: boolean; amount: number; medical: number; taxes: number; other: number }
  belowThreshold: boolean
  /** 760C safe harbor: no addition to tax is due. */
  underpayment: { safe: boolean; reason: string; required: number }
  issues: string[]
}

export const vaStatus = (ret: TaxReturnInput): VaStatus => (ret.filingStatus === 'mfj' ? 2 : ret.filingStatus === 'mfs' ? 3 : 1)

/** Birth date typed as MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY or MMDDYYYY. */
export function parseBirthDate(v: string | undefined): Date | null {
  const t = (v ?? '').trim()
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(t)
  if (!m) return null
  return parseDate(`${+m[1]}/${+m[2]}/${m[3]}`)
}

/** Age on December 31, 2025 from a birth date. */
const ageAtYearEnd = (d: Date): number => 2025 - d.getUTCFullYear()

/** Birth date → 'full' if on or before 1/1/1939, 'income' if 1/2/1939–1/1/1961, 'none' after. Falls back to the age entered. */
function ageKind(birth: string, age: number, age65: boolean): { kind: 'full' | 'income' | 'none'; missing: boolean } {
  const d = parseBirthDate(birth)
  if (d) {
    const t = d.getTime()
    if (t <= Date.UTC(1939, 0, 1)) return { kind: 'full', missing: false }
    if (t <= Date.UTC(1961, 0, 1)) return { kind: 'income', missing: false }
    return { kind: 'none', missing: false }
  }
  // Without a birth date: 65 or older counts as income-based (the full deduction needs a birth date on or before 1/1/1939).
  if (age >= 65 || age65) return { kind: 'income', missing: true }
  return { kind: 'none', missing: false }
}

/** 65 or older on or before January 1, 2026. */
function is65(birth: string, age: number, age65: boolean): boolean {
  const d = parseBirthDate(birth)
  if (d) return d.getTime() <= Date.UTC(1961, 0, 2)
  return age >= 65 || age65
}

/** Bonus depreciation taken federally on assets placed in service in 2025, recomputed without it (ADJ line 2a, part A). */
export function vaBonusAddition(ret: TaxReturnInput): number {
  const owners: Owner[] = ret.filingStatus === 'mfj' ? ['taxpayer', 'spouse'] : ['taxpayer']
  const businesses = ret.businesses.filter((b) => owners.includes(b.owner))
  const rentals = ret.rentals.filter((p) => owners.includes(p.owner))
  const all = [...businesses.flatMap((b) => b.assets ?? []), ...rentals.flatMap((p) => p.assets ?? [])]
  const midQuarter = midQuarterApplies(all)
  let add = 0
  const each = (assets: typeof all, allow179: boolean): void => {
    for (const a of assets) {
      if (a.manual) continue
      const fed = assetDepreciation(a, { midQuarter, allow179 })
      if (!fed.currentYear || fed.bonus <= 0) continue
      const va = assetDepreciation({ ...a, bonus: 'none' }, { midQuarter, allow179 })
      add += fed.depreciation - va.depreciation
    }
  }
  businesses.forEach((b) => each(b.assets ?? [], true))
  rentals.forEach((p) => each(p.assets ?? [], false))
  return r(pos(add))
}

/** Commonwealth Savers deduction (code 104): up to $4,000 per account (plus carryforward) under age 70; everything at 70 or older. */
export function vaSaversDeduction(ret: TaxReturnInput): { deduction: number; carryforward: number } {
  let deduction = 0
  let carry = 0
  for (const s of ret.virginia.savers) {
    const p = s.owner === 'spouse' ? ret.spouse : ret.taxpayer
    const birth = parseBirthDate(ret.virginia.birthDate[s.owner])
    const age70 = birth ? birth.getTime() <= Date.UTC(1955, 11, 31) : p.age >= 70
    const available = pos(s.contributed) + pos(s.carryforward)
    const allowed = age70 ? available : Math.min(VA_SAVERS_LIMIT, available)
    deduction += allowed
    carry += available - allowed
  }
  return { deduction: r(deduction), carryforward: r(carry) }
}

/** Combine coded entries by code (one line per code), keeping order of first appearance. */
function byCode(entries: VaLine[]): VaLine[] {
  const out: VaLine[] = []
  for (const e of entries) {
    if (!e.code || !e.amount) continue
    const same = out.find((x) => x.code === e.code)
    if (same) { same.amount += e.amount; same.auto = same.auto && e.auto }
    else out.push({ ...e })
  }
  return out
}

const labelled = (table: Record<string, string>, e: VaAdjEntry): VaLine => ({
  code: e.code.trim(), label: table[e.code.trim()] ?? `Code ${e.code.trim()}`, amount: r(pos(e.amount)), auto: false, owner: e.owner
})

/** Virginia itemized deductions (Virginia Schedule A), estimated from the federal Schedule A when not entered. */
function vaItemized(ret: TaxReturnInput, res: TaxReturnResult): VaResult['itemized'] {
  const v = ret.virginia
  const used = res.deduction.used === 'itemized'
  if (!used) return { used: false, estimated: false, amount: 0, medical: 0, taxes: 0, other: 0 }
  if (v.itemizedOverride !== null) return { used: true, estimated: false, amount: r(pos(v.itemizedOverride)), medical: 0, taxes: 0, other: 0 }
  const it = ret.itemized
  const fagi = res.f1040['11a']
  // Virginia keeps the 10% floor for medical expenses (it did not adopt the federal 7.5% floor).
  const medical = r(pos(it.medical - 0.10 * pos(fagi)))
  // No SALT cap for Virginia, but state and local income taxes are not deductible (sales tax is).
  const taxes = r(pos(it.realEstateTax) + pos(it.personalPropertyTax) + (v.salesTaxElected ? pos(it.stateLocalIncomeOrSalesTax) : 0))
  const other = r(res.scheduleA.interest + res.scheduleA.charity + res.scheduleA.other)
  return { used: true, estimated: true, amount: medical + taxes + other, medical, taxes, other }
}

/** Taxpayer's and spouse's shares of federal AGI, for the Spouse Tax Adjustment. Joint items are split in half. */
function splitFagi(ret: TaxReturnInput, res: TaxReturnResult): Record<Owner, number> {
  const owned: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
  ret.w2s.forEach((w) => { owned[w.owner] += w.wages })
  ret.retirement.forEach((x) => { owned[x.owner] += x.taxableAmount })
  const ssTotal = ret.socialSecurity.reduce((s, x) => s + x.netBenefits, 0)
  if (ssTotal > 0) ret.socialSecurity.forEach((x) => { owned[x.owner] += res.f1040['6b'] * (x.netBenefits / ssTotal) })
  res.scheduleC.forEach((c) => { owned[c.owner] += c.netProfit })
  res.scheduleSE.forEach((se) => { owned[se.owner] -= se.total / 2 })
  const fagi = res.f1040['11a']
  const joint = fagi - owned.taxpayer - owned.spouse
  return { taxpayer: owned.taxpayer + joint / 2, spouse: owned.spouse + joint / 2 }
}

interface PathOptions { allowAge: boolean; allowCredits: boolean }

function computePath(ret: TaxReturnInput, res: TaxReturnResult, opt: PathOptions): VaResult {
  const v = ret.virginia
  const f = res.f1040
  const status = vaStatus(ret)
  const married = status !== 1
  const people: Owner[] = status === 2 ? ['taxpayer', 'spouse'] : ['taxpayer']
  const issues: string[] = []

  // ── Schedule ADJ: additions ──
  const bonusAddition = vaBonusAddition(ret)
  const otherConformity = r(pos(v.otherConformityAddition))
  const additions = byCode(v.additions.map((e) => labelled(VA_ADDITION_CODES, e)))
  const adj: Record<string, number> = {}
  adj['1'] = r(pos(v.otherStateBondInterest))
  adj['2a'] = bonusAddition + otherConformity
  adj['3'] = adj['1'] + adj['2a'] + additions.reduce((s, x) => s + x.amount, 0)

  // ── Schedule ADJ: subtractions ──
  const autoSubs: VaLine[] = []
  if (res.schedule1.unemployment > 0) autoSubs.push({ code: '37', label: VA_SUBTRACTION_CODES['37'], amount: r(res.schedule1.unemployment), auto: true })
  const manualSubs = v.subtractions.filter((e) => !(e.code.trim() === '37' && autoSubs.length)).map((e) => labelled(VA_SUBTRACTION_CODES, e))
  // Military basic pay (38): up to $15,000, reduced $1 for $1 over $15,000, per person.
  for (const s of manualSubs) {
    if (s.code === '38') s.amount = r(pos(Math.min(s.amount, VA_MILITARY_BASIC_PAY_MAX) - pos(s.amount - VA_MILITARY_BASIC_PAY_MAX)))
    if (s.code === '39') s.amount = Math.min(s.amount, 15000)
    if (s.code === '60') s.amount = Math.min(s.amount, 40000)
  }
  const subtractions = byCode([...autoSubs, ...manualSubs])
  const creditsBarred = subtractions.some((s) => BARS_CREDITS.has(s.code))
  adj['4'] = r(pos(v.usObligationInterest))
  const disability: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
  for (const o of people) disability[o] = Math.min(VA_DISABILITY_MAX, r(pos(v.disability[o])))
  adj['5a'] = disability.taxpayer
  adj['5b'] = disability.spouse
  adj['6a'] = r(pos(v.conformitySubtraction))
  adj['7'] = adj['4'] + adj['5a'] + adj['5b'] + adj['6a'] + subtractions.reduce((s, x) => s + x.amount, 0)

  // ── Schedule ADJ: deductions ──
  const autoDed: VaLine[] = []
  if (res.form2441.expensesUsed > 0 && res.form2441.credit > 0) autoDed.push({ code: '101', label: VA_DEDUCTION_CODES['101'], amount: r(res.form2441.expensesUsed), auto: true })
  const savers = vaSaversDeduction(ret)
  if (savers.deduction > 0) autoDed.push({ code: '104', label: VA_DEDUCTION_CODES['104'], amount: savers.deduction, auto: true })
  const autoCodes = new Set(autoDed.map((d) => d.code))
  const deductions = byCode([...autoDed, ...v.deductions.filter((e) => !autoCodes.has(e.code.trim())).map((e) => labelled(VA_DEDUCTION_CODES, e))])
  adj['9'] = deductions.reduce((s, x) => s + x.amount, 0)

  const lines: Record<string, number> = {}
  lines['1'] = r(f['11a'])
  lines['2'] = adj['3']
  lines['3'] = lines['1'] + lines['2']

  // ── Line 4: age deduction ──
  const kinds: Record<Owner, 'full' | 'income' | 'none'> = { taxpayer: 'none', spouse: 'none' }
  let birthDateMissing = false
  for (const o of people) {
    const p = o === 'spouse' ? ret.spouse : ret.taxpayer
    const k = ageKind(v.birthDate[o], p.age, p.age65OrOlder)
    birthDateMissing ||= k.missing
    // Each person takes either the age deduction or the disability subtraction.
    kinds[o] = opt.allowAge && disability[o] === 0 ? k.kind : 'none'
  }
  const claimants = people.filter((o) => kinds[o] === 'income').length
  const combinedFagi = lines['1'] + (status === 3 ? r(v.spouseFagiIfSeparate) : 0)
  const taxableSs = r(f['6b'])
  const afagi = combinedFagi + adj['2a'] - adj['6a'] - taxableSs
  const limit = married ? VA_AGE_INCOME_LIMIT.married : VA_AGE_INCOME_LIMIT.single
  const excess = pos(afagi - limit)
  const ageAmount: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
  for (const o of people) if (kinds[o] === 'full') ageAmount[o] = VA_AGE_DEDUCTION
  if (claimants > 0) {
    const pool = pos(claimants * VA_AGE_DEDUCTION - excess)
    const share = claimants === 2 ? r(pool / 2) : pool
    for (const o of people) if (kinds[o] === 'income') ageAmount[o] = share
  }
  const age: VaAgeDeduction = {
    kind: kinds, claimants, fagi: combinedFagi, conformityAdd: adj['2a'], conformitySub: adj['6a'], taxableSs, afagi, limit, excess,
    amount: ageAmount, total: ageAmount.taxpayer + ageAmount.spouse, birthDateMissing
  }
  lines['4you'] = ageAmount.taxpayer
  lines['4spouse'] = ageAmount.spouse
  lines['4'] = age.total
  lines['5'] = taxableSs
  lines['6'] = r(pos(v.stateRefundInFagi))
  lines['7'] = adj['7']
  lines['8'] = lines['4'] + lines['5'] + lines['6'] + lines['7']
  lines['9'] = lines['3'] - lines['8']

  // ── Deductions and exemptions ──
  const itemized = vaItemized(ret, res)
  lines['10'] = itemized.amount
  let standard = itemized.used ? 0 : VA_STANDARD_DEDUCTION[status]
  if (!itemized.used && ret.canBeClaimedAsDependent) standard = Math.min(standard, r(pos(res.eic.earnedIncome)))
  lines['11'] = standard
  const age65: Record<Owner, boolean> = { taxpayer: false, spouse: false }
  const blind: Record<Owner, boolean> = { taxpayer: false, spouse: false }
  for (const o of people) {
    const p = o === 'spouse' ? ret.spouse : ret.taxpayer
    age65[o] = is65(v.birthDate[o], p.age, p.age65OrOlder)
    blind[o] = p.blind
  }
  const you = 1
  const spouse = status === 2 ? 1 : 0
  const dependents = ret.dependents.length
  const countA = you + spouse + dependents
  let countB = [age65.taxpayer, age65.spouse, blind.taxpayer, blind.spouse].filter(Boolean).length
  const exemptions = {
    you, spouse, dependents, countA, amountA: countA * VA_PERSONAL_EXEMPTION, age65, blind, countB, amountB: countB * VA_AGE_BLIND_EXEMPTION
  }
  lines['12'] = exemptions.amountA + exemptions.amountB
  lines['13'] = adj['9']
  lines['14'] = lines['10'] + lines['11'] + lines['12'] + lines['13']
  lines['15'] = lines['9'] - lines['14']

  const belowThreshold = lines['9'] < VA_FILING_THRESHOLD[status]
  lines['16'] = belowThreshold ? 0 : vaTax(lines['15'])

  // ── Line 17: Spouse Tax Adjustment ──
  let sta: VaSta | null = null
  if (status === 2 && !belowThreshold && lines['15'] > 3000) {
    const split = splitFagi(ret, res)
    let spVagi: number
    if (v.spouseVagiOverride !== null) spVagi = r(v.spouseVagiOverride)
    else {
      // Separate VAGI worksheet: additions and subtractions without an owner are split in half.
      const ownedSubs = (o: Owner): number => subtractions.filter((s) => s.owner === o).reduce((t, s) => t + s.amount, 0)
      const unowned = subtractions.filter((s) => !s.owner).reduce((t, s) => t + s.amount, 0)
      const ss = ret.socialSecurity.reduce((t, x) => t + x.netBenefits, 0)
      const ssSpouse = ss > 0 ? taxableSs * ret.socialSecurity.filter((x) => x.owner === 'spouse').reduce((t, x) => t + x.netBenefits, 0) / ss : 0
      const otherSubs = adj['4'] + adj['6a'] + lines['6'] + unowned
      spVagi = r(split.spouse + lines['2'] / 2 - ageAmount.spouse - ssSpouse - disability.spouse - ownedSubs('spouse') - otherSubs / 2)
    }
    const vagi: Record<Owner, number> = { taxpayer: lines['9'] - spVagi, spouse: spVagi }
    const exm: Record<Owner, number> = {
      taxpayer: VA_PERSONAL_EXEMPTION + VA_AGE_BLIND_EXEMPTION * ((age65.taxpayer ? 1 : 0) + (blind.taxpayer ? 1 : 0)),
      spouse: VA_PERSONAL_EXEMPTION + VA_AGE_BLIND_EXEMPTION * ((age65.spouse ? 1 : 0) + (blind.spouse ? 1 : 0))
    }
    const separate = { taxpayer: vagi.taxpayer - exm.taxpayer, spouse: vagi.spouse - exm.spouse }
    const line4 = lines['15']
    const line5 = Math.min(separate.taxpayer, separate.spouse)
    const s: VaSta = { vagi, exemptions: exm, separate, line4, line5, line6: 0, line7: 0, line8: 0, line9: 0, line10: 0, line11: lines['16'], amount: 0, qualifies: line5 > 0, capped: false }
    if (s.qualifies) {
      if (line5 > 17000 && line4 > 34000) { s.amount = VA_STA_MAX; s.capped = true }
      else {
        s.line6 = pos(line4 - line5)
        s.line7 = line4 / 2
        s.line8 = vaTax(Math.min(line5, s.line7))
        s.line9 = vaTax(Math.max(s.line6, s.line7))
        s.line10 = s.line8 + s.line9
        s.amount = Math.min(VA_STA_MAX, pos(s.line11 - s.line10))
      }
    }
    sta = s
  }
  lines['17vagi'] = sta ? sta.vagi.spouse : 0
  lines['17'] = sta?.amount ?? 0
  lines['18'] = pos(lines['16'] - lines['17'])

  // ── Payments ──
  lines['19a'] = r(pos(v.withholding.taxpayer))
  lines['19b'] = status === 2 ? r(pos(v.withholding.spouse)) : 0
  lines['20'] = r(pos(v.estimatedPayments))
  lines['21'] = r(pos(v.priorOverpayment))
  lines['22'] = r(pos(v.extensionPayments))
  lines['24'] = r(pos(v.otherStateCredit))
  lines['25'] = r(pos(v.scheduleCrCredits))

  // ── ADJ lines 10–17: low-income credit or Virginia earned income credit ──
  const familySize = countA + (status === 3 ? 1 : 0)
  const familyVagi = lines['9'] + r(pos(v.dependentsVagi)) + (status === 3 ? r(v.spouseFagiIfSeparate) : 0)
  const poverty = povertyGuideline(familySize)
  const creditsAllowed = opt.allowCredits && !creditsBarred && age.total === 0 && disability.taxpayer + disability.spouse === 0
  const eligible = creditsAllowed && familyVagi <= poverty
  const fedEic = r(res.eic.credit)
  const li: VaLowIncome = {
    familyVagi, familySize, poverty, eligible, exemptions: eligible ? countA : 0,
    line13: eligible ? countA * VA_LOW_INCOME_PER_EXEMPTION : 0,
    line14: creditsAllowed ? fedEic : 0, line16b: 0, nonrefundable: 0, line17: 0, option: 'none'
  }
  li.line16b = r(li.line14 * VA_EITC_RATE)
  if (creditsAllowed) {
    // The low-income credit is figured without the 65-or-older and blind exemptions.
    let taxForCredit = pos(lines['18'] - lines['24'])
    if (li.line13 > 0 && countB > 0) {
      const lines12 = exemptions.amountA
      const taxable = lines['9'] - (lines['10'] + lines['11'] + lines12 + lines['13'])
      const tax = belowThreshold ? 0 : vaTax(taxable)
      taxForCredit = pos(tax - (sta?.amount ?? 0) - lines['24'])
    }
    li.nonrefundable = Math.min(li.line13, taxForCredit)
    if (li.line16b >= li.nonrefundable && li.line16b > 0) { li.line17 = li.line16b; li.option = 'refundable' }
    else if (li.nonrefundable > 0) { li.line17 = li.nonrefundable; li.option = 'nonrefundable' }
  }
  if (li.option === 'nonrefundable' && countB > 0) {
    // Taking the low-income credit gives up the 65-or-older and blind exemptions: refigure lines 12–18.
    countB = 0
    exemptions.countB = 0
    exemptions.amountB = 0
    lines['12'] = exemptions.amountA
    lines['14'] = lines['10'] + lines['11'] + lines['12'] + lines['13']
    lines['15'] = lines['9'] - lines['14']
    lines['16'] = belowThreshold ? 0 : vaTax(lines['15'])
    lines['18'] = pos(lines['16'] - lines['17'])
    li.nonrefundable = Math.min(li.line13, pos(lines['18'] - lines['24']))
    li.line17 = li.nonrefundable
  }
  adj['10'] = familyVagi
  adj['11'] = familySize
  adj['12'] = li.exemptions
  adj['13'] = li.line13
  adj['14'] = li.line14
  adj['16b'] = li.line16b
  adj['17'] = li.line17
  lines['23'] = li.line17

  // ── ADJ lines 18–21 and Form 760 lines 26–36 ──
  adj['18'] = r(pos(v.additionToTax))
  adj['21'] = adj['18']
  lines['26'] = ['19a', '19b', '20', '21', '22', '23', '24', '25'].reduce((s, k) => s + lines[k], 0)
  lines['27'] = pos(lines['18'] - lines['26'])
  lines['28'] = pos(lines['26'] - lines['18'])
  lines['29'] = Math.min(r(pos(v.creditForward)), lines['28'])
  lines['30'] = r(pos(v.vacSavers))
  lines['31'] = r(pos(v.vacOther))
  lines['32'] = adj['21']
  lines['33'] = r(pos(v.useTax))
  lines['34'] = lines['29'] + lines['30'] + lines['31'] + lines['32'] + lines['33']
  if (lines['27'] > 0) { lines['35'] = lines['27'] + lines['34']; lines['36'] = 0 }
  else if (lines['28'] < lines['34']) { lines['35'] = lines['34'] - lines['28']; lines['36'] = 0 }
  else { lines['35'] = 0; lines['36'] = lines['28'] - lines['34'] }

  // ── 760C safe harbor ──
  const taxAfterNonref = pos(lines['18'] - (li.option === 'nonrefundable' ? li.line17 : 0) - lines['24'] - lines['25'])
  const paid = lines['19a'] + lines['19b'] + lines['20'] + lines['21']
  const required = Math.min(0.9 * taxAfterNonref, v.priorYearTax === null ? Infinity : v.priorYearTax)
  let underpayment: VaResult['underpayment']
  if (pos(taxAfterNonref - paid) <= 150) underpayment = { safe: true, reason: 'You owe $150 or less after withholding and estimated payments.', required: r(required === Infinity ? 0 : required) }
  else if (paid >= required) underpayment = { safe: true, reason: v.priorYearTax === null ? 'Withholding and estimated payments cover 90% of your 2025 tax.' : 'Withholding and estimated payments cover 90% of your 2025 tax or 100% of your 2024 tax.', required: r(required) }
  else underpayment = { safe: false, reason: 'Withholding and timely estimated payments are less than 90% of your 2025 tax (or 100% of your 2024 tax). An addition to tax may be due: complete Form 760C and enter it on Schedule ADJ line 18.', required: r(required === Infinity ? 0 : required) }

  // ── Where the coded lines go ──
  const overflow: string[] = []
  if (additions.length > 2) overflow.push(`${additions.length - 2} addition(s) after line 2c`)
  if (subtractions.length > 3) overflow.push(`${subtractions.length - 3} subtraction(s) after line 6d`)
  if (deductions.length > 3) overflow.push(`${deductions.length - 3} deduction(s) after line 8c`)
  const needed = adj['3'] > 0 || adj['7'] > 0 || adj['9'] > 0 || adj['17'] > 0 || adj['21'] > 0

  // ── Notes ──
  for (const o of people) {
    const raw = v.birthDate[o].trim()
    const p = o === 'spouse' ? ret.spouse : ret.taxpayer
    const who = o === 'spouse' ? 'your spouse’s' : 'your'
    const d = parseBirthDate(raw)
    if (raw && !d) issues.push(`Enter ${who} birth date as MM/DD/YYYY (for example 08/14/1959). As typed it cannot be read, so the age deduction and the 65-or-older exemption are left out.`)
    if (d && p.age > 0 && Math.abs(ageAtYearEnd(d) - p.age) > 1) issues.push(`${o === 'spouse' ? 'Your spouse’s' : 'Your'} birth date (age ${ageAtYearEnd(d)} at the end of 2025) does not match the age on the About you step (${p.age}). The federal return uses that age for the standard deduction and credits: correct whichever is wrong.`)
  }
  if (birthDateMissing) issues.push('Enter birth dates for anyone 65 or older: the age deduction and the 65-or-older exemption depend on them, and Form 760 asks for them.')
  if (!v.localityCode.trim()) issues.push('Enter your three-digit locality code (city or county where you lived on January 1, 2026; listed in the Form 760 instructions).')
  if (itemized.estimated) issues.push('Virginia itemized deductions are estimated from your federal Schedule A (no SALT cap, state income tax removed, medical expenses over 10% of AGI). Complete Virginia Schedule A and enter its line 19 to be exact, especially if your AGI is high enough for the Virginia overall limitation.')
  if (bonusAddition > 0) issues.push(`Virginia does not allow bonus depreciation: ${bonusAddition.toLocaleString('en-US')} is added back on Schedule ADJ line 2a. Keep a record so you can subtract the extra Virginia depreciation in later years.`)
  const priorBonus = [...ret.businesses.flatMap((b) => b.assets ?? []), ...ret.rentals.flatMap((p) => p.assets ?? [])]
    .some((a) => a.priorSpecial > 0 && (parseDate(a.placedInService)?.getUTCFullYear() ?? 2025) < 2025)
  if (priorBonus) issues.push('Assets placed in service before 2025 that received federal bonus depreciation have a different Virginia basis. Enter the extra Virginia depreciation as a conformity subtraction (Schedule ADJ line 6a).')
  if (savers.carryforward > 0) issues.push(`Commonwealth Savers contributions over $4,000 per account carry forward: ${savers.carryforward.toLocaleString('en-US')} to 2026.`)
  if (overflow.length) issues.push(`Schedule ADJ has room for two additions, three subtractions and three deductions. Attach Schedule ADJS for ${overflow.join(', ')}.`)
  if (!underpayment.safe) issues.push(underpayment.reason)
  if (status === 3) issues.push('Filing status 3: report only your own income, deductions and exemptions. Dependents and itemized deductions that cannot be separated must be split by each spouse’s share of federal AGI.')
  if (status === 3 && claimants > 0 && !v.spouseFagiIfSeparate) issues.push('For the age deduction, married taxpayers filing separately must test combined income: enter your spouse’s federal AGI.')
  if (lines['24'] > 0) issues.push('Attach Schedule OSC and a copy of the other state’s return for the credit on line 24.')
  if (lines['25'] > 0) issues.push('Attach Schedule CR for the credits on line 25.')

  return {
    status, hoh: ret.filingStatus === 'hoh', path: age.total > 0 ? 'age' : 'credit', exemptions, lines,
    adj: { bonusAddition, otherConformity, additions, subtractions, deductions, lines: adj, overflow, needed },
    age, sta, lowIncome: li, itemized, belowThreshold, underpayment, issues
  }
}

const net = (x: VaResult): number => x.lines['36'] - x.lines['35']

/**
 * Figures Form 760. The age deduction and the low-income / earned income credits exclude each other,
 * so both are tried and the one that leaves you better off is used, as the instructions direct.
 */
export function computeVirginia(ret: TaxReturnInput, res: TaxReturnResult): VaResult {
  const withAge = computePath(ret, res, { allowAge: true, allowCredits: false })
  if (withAge.age.total === 0) return computePath(ret, res, { allowAge: false, allowCredits: true })
  const withCredits = computePath(ret, res, { allowAge: false, allowCredits: true })
  if (withCredits.lowIncome.line17 > 0 && net(withCredits) > net(withAge)) return withCredits
  return withAge
}
