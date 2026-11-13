/**
 * Depreciation for tax year 2025: MACRS (GDS), the section 179 election, the special
 * depreciation allowance (bonus) restored to 100% by P.L. 119-21, and Form 4562 lines.
 *
 * Rates follow the optional tables in the 2025 Instructions for Form 4562 (Tables A–C) and
 * the 39-year table in the Form 8829 instructions. Mid-quarter rates are computed with the
 * declining-balance / straight-line switch the instructions describe.
 */
import type { DepreciableAsset, PropertyClass } from './model.ts'
import { parseDate } from './capital.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const SECTION_179_LIMIT = 2500000
export const SECTION_179_THRESHOLD = 4000000
export const TAX_YEAR = 2025
/** Property acquired after January 19, 2025 gets 100% bonus; before that, 40%. */
export const BONUS_RATE_NEW = 1.0
export const BONUS_RATE_PHASED = 0.40

const PERSONAL: PropertyClass[] = ['3', '5', '7', '10', '15', '20']
export const isPersonalProperty = (c: PropertyClass): boolean => PERSONAL.includes(c)

/** Table A (200% DB, half-year) and Table B (150% DB, half-year), in percent. */
const HALF_YEAR: Record<'3' | '5' | '7' | '10' | '15' | '20', number[]> = {
  '3': [33.33, 44.45, 14.81, 7.41],
  '5': [20.00, 32.00, 19.20, 11.52, 11.52, 5.76],
  '7': [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46],
  '10': [10.00, 18.00, 14.40, 11.52, 9.22, 7.37, 6.55, 6.55, 6.56, 6.55, 3.28],
  '15': [5.00, 9.50, 8.55, 7.70, 6.93, 6.23, 5.90, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 2.95],
  '20': [3.750, 7.219, 6.677, 6.177, 5.713, 5.285, 4.888, 4.522, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 2.231]
}

/** Mid-quarter rates (percent), computed: DB switching to SL; first year uses the quarter midpoint. */
function midQuarterRate(c: '3' | '5' | '7' | '10' | '15' | '20', quarter: number, year: number): number {
  const n = Number(c)
  const db = (c === '15' || c === '20' ? 1.5 : 2) / n
  const first = [0.875, 0.625, 0.375, 0.125][quarter - 1]
  let remaining = 1
  let lifeLeft = n
  for (let y = 1; y <= n + 1; y++) {
    const portion = y === 1 ? first : 1
    const dbAmt = remaining * db * portion
    const slAmt = lifeLeft > 0 ? (remaining / lifeLeft) * portion : remaining
    let dep = Math.max(dbAmt, slAmt)
    if (dep > remaining || y === n + 1) dep = remaining
    if (y === year) return Math.round(dep * 1000000) / 10000
    remaining -= dep
    lifeLeft -= portion
  }
  return 0
}

/** Residential rental (27.5 years), Table C. */
function residentialRate(month: number, year: number): number {
  if (year === 1) return [3.485, 3.182, 2.879, 2.576, 2.273, 1.970, 1.667, 1.364, 1.061, 0.758, 0.455, 0.152][month - 1]
  if (year >= 2 && year <= 9) return 3.636
  if (year >= 10 && year <= 27) {
    const even = year % 2 === 0
    return month <= 6 ? (even ? 3.637 : 3.636) : (even ? 3.636 : 3.637)
  }
  if (year === 28) return [1.97, 2.273, 2.576, 2.879, 3.182, 3.485, 3.636, 3.636, 3.636, 3.636, 3.636, 3.636][month - 1]
  if (year === 29) return month <= 6 ? 0 : [0.152, 0.455, 0.758, 1.061, 1.364, 1.667][month - 7]
  return 0
}

/** Nonresidential real property (39 years), mid-month; first-year rates from the Form 8829 instructions. */
export const NONRES_FIRST_YEAR = [2.461, 2.247, 2.033, 1.819, 1.605, 1.391, 1.177, 0.963, 0.749, 0.535, 0.321, 0.107]
function nonresidentialRate(month: number, year: number): number {
  if (year === 1) return NONRES_FIRST_YEAR[month - 1]
  if (year >= 2 && year <= 39) return 2.564
  if (year === 40) return Math.round((100 - NONRES_FIRST_YEAR[month - 1] - 38 * 2.564) * 1000) / 1000
  return 0
}

export type Convention = 'HY' | 'MQ' | 'MM'

/** MACRS rate in percent for recovery year `year` (1 = the year placed in service). */
export function macrsRate(c: PropertyClass, year: number, month: number, convention: Convention): number {
  if (year < 1) return 0
  if (c === '27.5') return residentialRate(month, year)
  if (c === '39') return nonresidentialRate(month, year)
  if (convention === 'MQ') return midQuarterRate(c, Math.ceil(month / 3), year)
  return HALF_YEAR[c][year - 1] ?? 0
}

export interface AssetResult {
  id: string; description: string; propertyClass: PropertyClass
  placedYear: number; placedMonth: number; currentYear: boolean
  businessBasis: number
  /** Section 179 elected on this asset (before the business income limit). */ section179Elected: number
  /** Bonus rate applied (0, 0.4 or 1). */ bonusRate: number
  bonus: number
  /** Basis for MACRS after 179 and bonus (Form 4562 column (c)). */ depreciableBasis: number
  convention: Convention
  macrs: number
  /** Manually entered amount, used instead of MACRS. */ manual: boolean
  /** Total 2025 depreciation excluding the 179 deduction (179 is limited and allocated separately). */ depreciation: number
  /** Listed property (Form 4562 Part V). */ listed: DepreciableAsset['listed']
  /** More than 50% qualified business use (line 26); otherwise line 27, straight line under ADS. */ qualifiedUse: boolean
  /** Passenger automobile limit applied (after the business-use percentage), or null. */ autoLimit: number | null
  recoveryPeriod: string
  /** Form 4562 column (g) of lines 26–27, e.g. "200 DB/HY". */ methodConvention: string
  issues: string[]
}

/** Limits for passenger automobiles (Table 2 of the 2025 Form 4562 instructions), for the 2025 tax year. */
export function autoLimit2025(placedYear: number, bonusTaken: boolean): number {
  if (placedYear === 2025) return bonusTaken ? 20200 : 12200
  if (placedYear === 2024) return 19800
  if (placedYear === 2023) return 11700
  if (placedYear === 2022) return 6460
  if (placedYear === 2021) return 5860
  if (placedYear >= 2018) return 5760
  return 1875
}
export const HEAVY_SUV_179_LIMIT = 31300

/** ADS recovery period used for listed property with 50% or less business use. */
const adsPeriod = (c: PropertyClass): number => (c === '5' ? 5 : c === '7' ? 10 : c === '3' ? 4 : Number(c) + 5)
/** Straight line, half-year: 0.5/N in year 1 and in year N + 1, 1/N in between (percent). */
const slHalfYear = (n: number, year: number): number => (year === 1 || year === n + 1 ? 50 / n : year <= n ? 100 / n : 0)

export function assetDepreciation(a: DepreciableAsset, opts: { midQuarter: boolean; allow179: boolean }): AssetResult {
  const issues: string[] = []
  const date = parseDate(a.placedInService)
  const placedYear = date ? date.getUTCFullYear() : 0
  const placedMonth = date ? date.getUTCMonth() + 1 : 1
  const label = a.description.trim() || 'An asset'
  const pct = Math.min(100, pos(a.businessPct)) / 100
  const businessBasis = r(pos(a.cost) * pct)
  const base: AssetResult = {
    id: a.id, description: label, propertyClass: a.propertyClass, placedYear, placedMonth, currentYear: placedYear === TAX_YEAR,
    businessBasis, section179Elected: 0, bonusRate: 0, bonus: 0, depreciableBasis: businessBasis, convention: 'HY', macrs: 0,
    manual: false, depreciation: 0, listed: a.listed ?? 'none', qualifiedUse: (a.businessPct ?? 100) > 50, autoLimit: null,
    recoveryPeriod: `${a.propertyClass} yrs.`, methodConvention: '', issues
  }
  if (a.manual) return { ...base, manual: true, depreciation: r(pos(a.manualAmount)), depreciableBasis: 0 }
  if (!date) { issues.push(`${label}: enter the date placed in service (MM/DD/YYYY).`); return base }
  if (placedYear > TAX_YEAR) { issues.push(`${label}: placed in service after 2025, so there is no 2025 depreciation.`); return base }
  if ((a.listed ?? 'none') !== 'none') return listedDepreciation(a, base, date, opts)
  if (a.businessPct > 0 && a.businessPct <= 50 && isPersonalProperty(a.propertyClass)) issues.push(`${label}: business use of 50% or less. If this is listed property (a vehicle, for example), MACRS 200% DB, bonus and section 179 are not allowed; use straight line under ADS.`)
  const convention: Convention = !isPersonalProperty(a.propertyClass) ? 'MM' : (base.currentYear && opts.midQuarter ? 'MQ' : 'HY')
  const year = TAX_YEAR - placedYear + 1
  if (base.currentYear) {
    const s179 = opts.allow179 && isPersonalProperty(a.propertyClass) ? Math.min(r(pos(a.section179)), businessBasis) : 0
    if (a.section179 > 0 && !opts.allow179) issues.push(`${label}: section 179 is not allowed for property used in a residential rental.`)
    if (a.section179 > 0 && !isPersonalProperty(a.propertyClass)) issues.push(`${label}: section 179 is not figured for buildings here.`)
    let bonusRate = 0
    if (isPersonalProperty(a.propertyClass) && a.bonus !== 'none') {
      const beforeCutoff = placedMonth === 1 && date.getUTCDate() <= 19
      bonusRate = a.bonus === '40' || a.acquiredBeforeJan20 || beforeCutoff ? BONUS_RATE_PHASED : BONUS_RATE_NEW
    }
    const bonus = r((businessBasis - s179) * bonusRate)
    const depreciableBasis = businessBasis - s179 - bonus
    const macrs = r(depreciableBasis * macrsRate(a.propertyClass, 1, placedMonth, convention) / 100)
    return { ...base, section179Elected: s179, bonusRate, bonus, depreciableBasis, convention, macrs, depreciation: bonus + macrs }
  }
  const depreciableBasis = pos(businessBasis - r(pos(a.priorSpecial)))
  const macrs = r(depreciableBasis * macrsRate(a.propertyClass, year, placedMonth, convention) / 100)
  return { ...base, depreciableBasis, convention, macrs, depreciation: macrs }
}

/** Listed property: MACRS with the passenger-auto limits when business use is over 50%, otherwise ADS straight line. */
function listedDepreciation(a: DepreciableAsset, base: AssetResult, date: Date, opts: { midQuarter: boolean; allow179: boolean }): AssetResult {
  const { issues, businessBasis, placedYear, placedMonth } = base
  const label = base.description
  const pct = Math.min(100, pos(a.businessPct)) / 100
  const year = TAX_YEAR - placedYear + 1
  const v = a.vehicle
  if (a.listed !== 'other' && v && v.businessMiles + v.commutingMiles + v.otherMiles > 0) {
    const milesPct = Math.round((v.businessMiles / (v.businessMiles + v.commutingMiles + v.otherMiles)) * 100)
    if (Math.abs(milesPct - a.businessPct) > 1) issues.push(`${label}: business use from the mileage is ${milesPct}%, but ${a.businessPct}% is entered.`)
  }
  if (!base.qualifiedUse) {
    if (a.section179 > 0) issues.push(`${label}: section 179 and bonus depreciation are not allowed when business use is 50% or less.`)
    const n = adsPeriod(a.propertyClass)
    let dep = r(pos(businessBasis - r(pos(a.priorSpecial))) * slHalfYear(n, year) / 100)
    let limit: number | null = null
    if (a.listed === 'auto') { limit = r(autoLimit2025(placedYear, false) * pct); dep = Math.min(dep, limit) }
    return {
      ...base, depreciableBasis: pos(businessBasis - r(pos(a.priorSpecial))), convention: 'HY', macrs: dep, depreciation: dep, autoLimit: limit,
      recoveryPeriod: `${n} yrs.`, methodConvention: 'S/L/HY'
    }
  }
  const convention: Convention = base.currentYear && opts.midQuarter ? 'MQ' : 'HY'
  if (base.currentYear) {
    let s179 = opts.allow179 ? Math.min(r(pos(a.section179)), businessBasis) : 0
    if (a.listed === 'heavy' && s179 > HEAVY_SUV_179_LIMIT) { issues.push(`${label}: section 179 for an SUV over 6,000 pounds is limited to $${HEAVY_SUV_179_LIMIT.toLocaleString()}.`); s179 = HEAVY_SUV_179_LIMIT }
    let bonusRate = 0
    if (a.bonus !== 'none') bonusRate = a.bonus === '40' || a.acquiredBeforeJan20 || (placedMonth === 1 && date.getUTCDate() <= 19) ? BONUS_RATE_PHASED : BONUS_RATE_NEW
    let bonus = r((businessBasis - s179) * bonusRate)
    const depreciableBasis = businessBasis - s179 - bonus
    let macrs = r(depreciableBasis * macrsRate(a.propertyClass, 1, placedMonth, convention) / 100)
    let limit: number | null = null
    if (a.listed === 'auto') {
      limit = r(autoLimit2025(2025, bonus > 0) * pct)
      s179 = Math.min(s179, limit)
      bonus = Math.min(bonus, limit - s179)
      macrs = Math.min(macrs, limit - s179 - bonus)
    }
    return {
      ...base, section179Elected: s179, bonusRate, bonus, depreciableBasis, convention, macrs, depreciation: bonus + macrs, autoLimit: limit,
      methodConvention: `${a.propertyClass === '15' || a.propertyClass === '20' ? '150' : '200'} DB/${convention}`
    }
  }
  const depreciableBasis = pos(businessBasis - r(pos(a.priorSpecial)))
  let macrs = r(depreciableBasis * macrsRate(a.propertyClass, year, placedMonth, convention) / 100)
  let limit: number | null = null
  if (a.listed === 'auto') { limit = r(autoLimit2025(placedYear, false) * pct); macrs = Math.min(macrs, limit) }
  return { ...base, depreciableBasis, convention, macrs, depreciation: macrs, autoLimit: limit, methodConvention: `200 DB/${convention}` }
}

/** Mid-quarter test: Q4 placements over 40% of 2025 personal-property bases (after 179, before bonus). */
export function midQuarterApplies(assets: DepreciableAsset[]): boolean {
  let total = 0
  let q4 = 0
  for (const a of assets) {
    if (a.manual || !isPersonalProperty(a.propertyClass)) continue
    const d = parseDate(a.placedInService)
    if (!d || d.getUTCFullYear() !== TAX_YEAR) continue
    const basis = pos(pos(a.cost) * Math.min(100, pos(a.businessPct)) / 100 - pos(a.section179))
    total += basis
    if (d.getUTCMonth() >= 9) q4 += basis
  }
  return total > 0 && q4 > 0.4 * total
}

/** Form 4562 Part I for the whole return. */
export interface Section179Result {
  line1: number; line2: number; line3: number; line4: number; line5: number
  line8: number; line9: number; line10: number; line11: number; line12: number; line13: number
  businessIncome: number
}

export function section179(args: { costOfProperty: number; elected: number; carryover: number; businessIncome: number; mfs: boolean }): Section179Result {
  const line1 = args.mfs ? SECTION_179_LIMIT / 2 : SECTION_179_LIMIT
  const line2 = r(args.costOfProperty)
  const line3 = SECTION_179_THRESHOLD
  const line4 = pos(line2 - line3)
  const line5 = pos(line1 - line4)
  const line8 = r(args.elected)
  const line9 = Math.min(line5, line8)
  const line10 = r(pos(args.carryover))
  const line11 = Math.min(r(pos(args.businessIncome)), line5)
  const line12 = Math.min(line9 + line10, line11)
  const line13 = line9 + line10 - line12
  return { line1, line2, line3, line4, line5, line8, line9, line10, line11, line12, line13, businessIncome: r(pos(args.businessIncome)) }
}

export interface Form4562Row {
  propertyClass: PropertyClass
  /** MM/YYYY, only for real property (lines 19i and 19j). */ placed: string
  basis: number; period: string; convention: Convention; method: string; deduction: number
}

export interface Form4562Result {
  id: string; kind: 'business' | 'rental'; name: string
  /** Section 179 property elected on this activity (line 6). */ elected: { description: string; cost: number; elected: number }[]
  /** Line 12 allocated to this activity. */ section179: number
  line14: number; line16: number; line17: number
  rows: Form4562Row[]
  /** Home first used for business in 2025 (line 19j; not on Schedule C line 13). */
  home: { placed: string; basis: number; deduction: number } | null
  /** Part V listed property, lines 26 (over 50% use) and 27 (50% or less). */
  listed: { description: string; placed: string; businessPct: number; cost: number; basis: number; period: string; method: string; deduction: number; section179: number; qualified: boolean; vehicle: DepreciableAsset['vehicle'] | null }[]
  /** Line 25: special allowance for listed property. */ line25: number
  /** Line 28 (= line 21). */ line28: number
  /** Line 29: section 179 on listed property (goes to line 7). */ line29: number
  line22: number
  /** Form 4562 is required: property placed in service in 2025, a section 179 deduction, or a home first used in 2025. */
  required: boolean
}

const two = (n: number): string => String(n).padStart(2, '0')

export function form4562For(args: {
  id: string; kind: 'business' | 'rental'; name: string; assets: AssetResult[]; section179Allowed: number
  home?: { month: number; basis: number; deduction: number } | null
  source?: DepreciableAsset[]
}): Form4562Result {
  const listedAssets = args.assets.filter((a) => a.listed !== 'none')
  const assets = args.assets.filter((a) => a.listed === 'none')
  const current = assets.filter((a) => a.currentYear && !a.manual)
  const rows: Form4562Row[] = []
  for (const cls of PERSONAL) {
    for (const convention of ['HY', 'MQ'] as Convention[]) {
      const group = current.filter((a) => a.propertyClass === cls && a.convention === convention && (a.depreciableBasis > 0 || a.macrs > 0))
      if (!group.length) continue
      rows.push({
        propertyClass: cls, placed: '', basis: group.reduce((s, a) => s + a.depreciableBasis, 0), period: `${cls} yrs.`, convention,
        method: cls === '15' || cls === '20' ? '150 DB' : '200 DB', deduction: group.reduce((s, a) => s + a.macrs, 0)
      })
    }
  }
  for (const a of current.filter((x) => !isPersonalProperty(x.propertyClass))) {
    rows.push({ propertyClass: a.propertyClass, placed: `${two(a.placedMonth)}/${TAX_YEAR}`, basis: a.depreciableBasis, period: `${a.propertyClass} yrs.`, convention: 'MM', method: 'S/L', deduction: a.macrs })
  }
  const line14 = assets.filter((a) => a.currentYear).reduce((s, a) => s + a.bonus, 0)
  const line16 = assets.filter((a) => a.manual && a.currentYear).reduce((s, a) => s + a.depreciation, 0)
  const line17 = assets.filter((a) => !a.currentYear).reduce((s, a) => s + a.depreciation, 0)
  const home = args.home && args.home.deduction > 0 ? { placed: `${two(args.home.month)}/${TAX_YEAR}`, basis: args.home.basis, deduction: args.home.deduction } : null
  const elected = assets.filter((a) => a.section179Elected > 0).map((a) => ({ description: a.description, cost: a.businessBasis, elected: a.section179Elected }))
  const listed = listedAssets.map((a) => {
    const src = args.source?.find((x) => x.id === a.id)
    const isVehicle = a.listed === 'auto' || a.listed === 'heavy'
    return {
      description: a.description, placed: src?.placedInService ?? '', businessPct: src ? Math.min(100, src.businessPct) : 100,
      cost: src ? r(src.cost) : a.businessBasis, basis: a.depreciableBasis, period: a.recoveryPeriod, method: a.manual ? '' : a.methodConvention,
      deduction: a.manual ? a.depreciation : a.macrs, section179: a.section179Elected, qualified: a.qualifiedUse,
      vehicle: isVehicle && src ? src.vehicle : null
    }
  })
  const line25 = listedAssets.filter((a) => a.currentYear).reduce((s, a) => s + a.bonus, 0)
  const line28 = line25 + listed.reduce((s, x) => s + x.deduction, 0)
  const line29 = listed.reduce((s, x) => s + x.section179, 0)
  const line22 = args.section179Allowed + line14 + line16 + line17 + rows.reduce((s, x) => s + x.deduction, 0) + (home?.deduction ?? 0) + line28
  return {
    id: args.id, kind: args.kind, name: args.name, elected, section179: args.section179Allowed, line14, line16, line17, rows, home,
    listed, line25, line28, line29, line22,
    required: assets.some((a) => a.currentYear) || args.section179Allowed > 0 || elected.length > 0 || home !== null || listed.length > 0
  }
}
