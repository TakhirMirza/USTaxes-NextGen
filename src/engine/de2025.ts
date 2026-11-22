/**
 * Delaware Form PIT-RES, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 PIT-RES (revision 20260407), PIT-RSS, PIT-RSA and PIT-CRS, the 2025 PIT-RES instructions (revised
 * 03/26/26) and the 2025 state income tax table (revenuefiles.delaware.gov/2025/TY25_taxtable.pdf).
 *  - Federal AGI with additions (other states’ bond interest, fiduciary adjustments) and subtractions (U.S. interest,
 *    pension exclusion, taxable Social Security / railroad retirement, higher-education distributions, 529 up to
 *    $1,000 / $2,000 and ABLE up to $5,000 / $10,000, the $2,000 / $4,000 exclusion for people 60+ or disabled).
 *  - The pension exclusion: under 60, the pension up to $2,000 ($12,500 military); 60 or over, pension plus eligible
 *    retirement income (interest, dividends, capital gains, net rents, IRA and plan distributions) up to $12,500.
 *  - Standard deduction $3,250 ($6,500 joint) plus $2,500 for each 65-or-older / blind box, or PIT-RSA itemized
 *    deductions (federal Schedule A without Delaware income tax), plus foreign taxes, charitable mileage, union dues.
 *  - One rate schedule for every filing status: 0 / 2.2 / 3.9 / 4.8 / 5.2 / 5.55 / 6.6%. Under $60,000 the table taxes
 *    the middle of each $50 row; from $60,000, $2,943.50 + 6.6% of the excess.
 *  - Personal credits $110 per exemption and $110 at 60 or over; other-state credit; volunteer firefighter $1,000;
 *    PIT-CRS credits; child care 50% of the federal credit; EITC 4.5% refundable or 20% nonrefundable.
 *  - Spouses who file a joint federal return may file jointly (status 2) or separately on one form (status 4, each
 *    spouse in a column with a $3,250 standard deduction). Because the brackets are the same for every status,
 *    status 4 usually costs less when both spouses have income; by default the cheaper one is used.
 * Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)

export const DE_STANDARD = 3250
export const DE_ADDITIONAL = 2500
export const DE_PERSONAL_CREDIT = 110
export const DE_PENSION_MAX = 12500
export const DE_PENSION_UNDER_60 = 2000

/** Tax on a whole-dollar amount from the rate schedule. */
function deScheduleTax(x: number): number {
  if (x <= 2000) return 0
  if (x <= 5000) return (x - 2000) * 0.022
  if (x <= 10000) return 66 + (x - 5000) * 0.039
  if (x <= 20000) return 261 + (x - 10000) * 0.048
  if (x <= 25000) return 741 + (x - 20000) * 0.052
  if (x <= 60000) return 1001 + (x - 25000) * 0.0555
  return 2943.5 + (x - 60000) * 0.066
}

/** Line 24: the tax table below $60,000 (the middle of each $50 row; $0 below $2,000), the schedule from $60,000. */
export function deTax(taxable: number): number {
  const x = pos(Math.floor(taxable))
  if (x < 2000) return 0
  if (x < 60000) return Math.round(deScheduleTax(Math.floor(x / 50) * 50 + 25) + 1e-9)
  return Math.round(deScheduleTax(x) + 1e-9)
}

/** Delaware filing status: 1 single / widow(er), 2 joint, 3 separate forms, 4 combined separate on one form, 5 HOH. */
export type DeStatus = 1 | 2 | 3 | 4 | 5

type Col = Record<string, number>
export interface DeResult {
  status: DeStatus
  /** Column A (spouse, status 4 only) and column B. */
  A: Col
  B: Col
  /** Single-column lines 43–47. */
  lines: Record<string, number>
  /** The other status for a joint federal return, for comparison (null otherwise). */
  alternative: { status: DeStatus; net: number } | null
  itemize: boolean
  /** PIT-RSA lines. */
  rsa: Record<string, number>
  rsaA: number
  /** PIT-RSS Schedule II (EITC). */
  eitc: { col: 'A' | 'B'; l12: number; l13: number; l14: number; l15: number; l16: number; l17: number } | null
  /** PIT-CRS lines. */
  crs: Record<string, number>
  /** Who is in each column. */
  owners: { A: Owner[]; B: Owner[] }
  /** Number of exemptions in each column (line 27a). */
  exemptions: { A: number; B: number }
  issues: string[]
  attach: string[]
}

/** Positive = owed, negative = refund. */
export const deNet = (d: DeResult): number => d.lines['46'] - d.lines['47']

export function deStatusFor(ret: TaxReturnInput): DeStatus[] {
  const fs = ret.filingStatus
  if (fs === 'mfj') return ret.de.status === 'joint' ? [2] : ret.de.status === 'combined' ? [4] : [4, 2]
  if (fs === 'mfs') return [3]
  if (fs === 'hoh') return [5]
  return [1]
}

export function computeDelaware(ret: TaxReturnInput, res: TaxReturnResult): DeResult {
  const options = deStatusFor(ret)
  const results = options.map((s) => computeStatus(ret, res, s))
  let best = results[0]
  for (const x of results.slice(1)) if (deNet(x) < deNet(best)) best = x
  if (results.length > 1) {
    const other = results.find((x) => x !== best)!
    best.alternative = { status: other.status, net: deNet(other) }
    if (best.status === 4) best.issues.unshift(`Filing status 4 (married filing combined separate) saves ${'$'}${(deNet(other) - deNet(best)).toLocaleString('en-US')} over a joint Delaware return. Income you share (interest, dividends, gains) is split evenly between the columns; change the spouse’s share if it isn’t.`)
  }
  return best
}

function computeStatus(ret: TaxReturnInput, res: TaxReturnResult, status: DeStatus): DeResult {
  const d = ret.de
  const f = res.f1040
  const issues: string[] = []
  const attach: string[] = []
  const married = status === 2 || status === 4
  const two = status === 4
  const everyone: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const owners: { A: Owner[]; B: Owner[] } = two ? { A: ['spouse'], B: ['taxpayer'] } : { A: [], B: everyone }
  const cols: ('A' | 'B')[] = two ? ['A', 'B'] : ['B']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const age = (o: Owner): number => person(o).age
  const is60 = (o: Owner): boolean => age(o) >= 60 || person(o).age65OrOlder
  const is65 = (o: Owner): boolean => age(o) >= 65 || person(o).age65OrOlder
  const agi = r(f['11a'])
  const A: Col = {}
  const B: Col = {}
  const C = { A, B }

  // ── What each spouse brought in ──
  const wagesBy = (o: Owner): number => ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0)
  const seBy = (o: Owner): number => res.scheduleC.filter((x) => x.owner === o).reduce((s, x) => s + x.netProfit, 0)
  const earnedBy = (o: Owner): number => wagesBy(o) + seBy(o)
  const isEarly = (code: string): boolean => code.trim().startsWith('1')
  const retirementBy = (o: Owner): number => ret.retirement.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0)
  const ssGross = ret.socialSecurity.reduce((s, x) => s + pos(x.netBenefits), 0)
  const ssShare = (o: Owner): number => (ssGross > 0 ? ret.socialSecurity.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.netBenefits), 0) / ssGross : o === 'taxpayer' ? 1 : 0)
  const rentalNet = new Map(res.scheduleE.properties.map((p) => [p.id, p.net]))
  const rentBy = (o: Owner): number => ret.rentals.filter((p) => p.owner === o).reduce((s, p) => s + (rentalNet.get(p.id) ?? 0), 0)
  const seHalf = (o: Owner): number => res.scheduleSE.filter((x) => x.owner === o).reduce((s, x) => s + x.total / 2, 0)
  const own = (o: Owner): number => earnedBy(o) - seHalf(o) + retirementBy(o) + f['6b'] * ssShare(o) + rentBy(o)
  const shared = agi - own('taxpayer') - own('spouse')
  const spouseAgi = two ? (d.spouseAgi !== null ? r(d.spouseAgi) : r(own('spouse') + shared / 2)) : 0
  if (two) { A['1'] = spouseAgi; B['1'] = agi - spouseAgi } else B['1'] = agi
  // Amounts that belong to both: split evenly on status 4, otherwise all in column B.
  const split = (n: number): Record<'A' | 'B', number> => (two ? { A: r(n / 2), B: r(n) - r(n / 2) } : { A: 0, B: r(n) })
  const byOwner = (rec: Record<Owner, number>, c: 'A' | 'B'): number => r(sum(owners[c].map((o) => pos(rec[o] ?? 0))))

  // ── Section A / B ──
  const muni = split(pos(d.otherStateBondInterest))
  const fid = split(pos(d.fiduciaryAdditions))
  const usInt = split(pos(d.usObligationInterest))
  const otherSub = split(pos(d.otherSubtractions))
  // Eligible retirement income (60 or over): interest, dividends, net capital gains and net rents; joint accounts split evenly.
  const investment = pos(f['2b']) + pos(f['3b']) + pos(f['7a'])
  const eligibleBy = (o: Owner): number => (ret.filingStatus === 'mfj' ? investment / 2 : investment) + pos(rentBy(o))
  const pensionExclusion = (o: Owner): number => {
    const items = ret.retirement.filter((x) => x.owner === o && !isEarly(x.code))
    const all = sum(items.map((x) => pos(x.taxableAmount)))
    if (!is60(o)) {
      if (d.militaryPension[o]) return r(Math.min(DE_PENSION_MAX, all))
      return r(Math.min(DE_PENSION_UNDER_60, sum(items.filter((x) => !x.ira).map((x) => pos(x.taxableAmount)))))
    }
    return r(Math.min(DE_PENSION_MAX, all + eligibleBy(o)))
  }
  for (const c of cols) {
    const X = C[c]
    X['2'] = muni[c]
    X['3'] = fid[c]
    X['4'] = X['1'] + X['2'] + X['3']
    X['5'] = usInt[c]
    X['6'] = sum(owners[c].map(pensionExclusion))
    X['7'] = otherSub[c]
    X['8a'] = r(sum(owners[c].map((o) => f['6b'] * ssShare(o)))) + byOwner(d.railroadRetirement, c) + byOwner(d.higherEducation, c)
    // 529 and ABLE: individual or joint limits, by federal AGI.
    const jointCol = status === 2
    const c529 = byOwner(d.tuition529, c)
    const cap529 = jointCol ? (agi < 200000 ? 2000 : 0) : (X['1'] < 100000 ? 1000 : 0)
    X['8b'] = Math.min(c529, cap529) + Math.min(byOwner(d.able, c), jointCol ? 10000 : 5000)
    X['9'] = X['5'] + X['6'] + X['7'] + X['8a'] + X['8b']
    X['10'] = X['4'] - X['9']
    // Line 11 worksheet.
    const os = owners[c]
    const qualifies = (o: Owner): boolean => is60(o) || d.disabled[o]
    const earned = sum(os.map(earnedBy))
    if (jointCol) X['11'] = os.every(qualifies) && earned < 5000 && X['10'] <= 20000 ? Math.min(4000, pos(X['10'])) : 0
    else X['11'] = qualifies(os[0]) && earned < 2500 && X['10'] <= 10000 ? Math.min(2000, pos(X['10'])) : 0
    X['12'] = X['10'] - X['11']
  }

  // ── PIT-RSA ──
  const it = ret.itemized
  const S: Record<string, number> = {}
  S['1'] = r(pos(it.medical))
  S['2'] = agi
  S['3'] = r(pos(agi) * 0.075)
  S['4'] = pos(S['1'] - S['3'])
  const deWithheld = sum(ret.w2s.filter((w) => everyone.includes(w.owner)).map((w) => pos(d.w2[w.id]?.stateTax ?? 0)))
    + sum(ret.retirement.filter((x) => everyone.includes(x.owner)).map((x) => pos(d.r1099[x.id]?.stateTax ?? 0)))
  const creditedTax = pos(d.otherState.tax)
  S['5a'] = d.salesTax ? 0 : r(pos(it.stateLocalIncomeOrSalesTax - deWithheld - pos(d.estimatedPayments) - creditedTax))
  S['5b'] = d.salesTax ? r(pos(it.stateLocalIncomeOrSalesTax)) : 0
  S['5c'] = r(pos(it.realEstateTax))
  S['5d'] = r(pos(it.personalPropertyTax))
  S['5e'] = S['5a'] + S['5b'] + S['5c'] + S['5d']
  S['5f'] = Math.min(S['5e'], r(res.scheduleA.saltCap))
  S['7'] = S['5f']
  S['8a'] = r(pos(it.mortgageInterest))
  S['8e'] = S['8a']
  S['10'] = S['8e']
  S['11'] = r(pos(it.charityCash))
  S['14'] = r(res.scheduleA.charity)
  S['12'] = pos(S['14'] - S['11'])
  S['16'] = r(pos(it.other))
  S['17a'] = S['4'] + S['7'] + S['10'] + S['14'] + S['16']

  const union = (os: Owner[]): number => sum(os.map((o) => Math.min(500, r(pos(d.unionDues[o] ?? 0)))))
  const extras = { '14': split(pos(d.foreignTaxes)), '15': split(pos(d.charityMiles) * 0.26), '18': split(pos(d.landAdjustment)) }
  const lineB12 = cols.reduce((s, c) => s + pos(C[c]['12']), 0)
  const rsaA = two ? (lineB12 > 0 ? r(S['17a'] * pos(A['12']) / lineB12) : r(S['17a'] / 2)) : 0
  const itemizedCol = (c: 'A' | 'B'): number => {
    const v13 = c === 'A' ? rsaA : S['17a'] - rsaA
    return pos(v13 + extras['14'][c] + extras['15'][c] + union(owners[c]) - extras['18'][c])
  }
  const standardCol = (c: 'A' | 'B'): number => (status === 2 ? 2 * DE_STANDARD : DE_STANDARD)
    + DE_ADDITIONAL * sum(owners[c].map((o) => (is65(o) ? 1 : 0) + (person(o).blind ? 1 : 0)))
  const totalItemized = sum(cols.map(itemizedCol))
  const totalStandard = sum(cols.map(standardCol))
  const itemize = d.deduction === 'itemized' || (d.deduction === 'auto' && totalItemized > totalStandard)
  for (const c of cols) {
    const X = C[c]
    if (itemize) {
      X['13'] = c === 'A' ? rsaA : S['17a'] - rsaA
      X['14'] = extras['14'][c]
      X['15'] = extras['15'][c]
      X['16'] = union(owners[c])
      X['17'] = X['13'] + X['14'] + X['15'] + X['16']
      X['18'] = extras['18'][c]
      X['19'] = pos(X['17'] - X['18'])
      X['20'] = X['19']
      X['21'] = 0
    } else {
      X['20'] = status === 2 ? 2 * DE_STANDARD : DE_STANDARD
      X['21'] = standardCol(c) - X['20']
    }
    X['22'] = X['20'] + X['21']
    X['23'] = pos(X['12'] - X['22'])
    X['24'] = deTax(X['23'])
    X['25'] = 0
    X['26'] = X['24'] + X['25']
  }

  // ── Credits ──
  const deps = ret.dependents.length
  const selfCount = ret.canBeClaimedAsDependent ? 0 : 1
  const depCol: 'A' | 'B' = two && A['26'] > B['26'] ? 'A' : 'B'
  const exemptions = { A: two ? 1 : 0, B: two ? selfCount : selfCount + (status === 2 ? 1 : 0) }
  exemptions[depCol] += deps
  const otherCol: 'A' | 'B' = two && d.otherState.owner === 'spouse' ? 'A' : 'B'
  const careCol: 'A' | 'B' = two && A['23'] < B['23'] ? 'A' : 'B'
  const eitcCol: 'A' | 'B' = two && A['23'] > B['23'] ? 'A' : 'B'
  // PIT-CRS.
  const K: Record<string, number> = {}
  const cr = (k: string): number => r(pos(d.crs[k] ?? 0))
  for (const k of ['1', '2', '4', '5', '7', '8', '10', '11', '12', '14', '15', '17', '22', '25', '26', '27', '28', '29']) K[k] = cr(k)
  K['3'] = K['1'] + K['2']; K['6'] = K['4'] + K['5']; K['9'] = K['7'] + K['8']; K['13'] = K['11'] + K['12']; K['16'] = K['14'] + K['15']
  K['18'] = K['17'] * 100
  K['19'] = K['3'] + K['6'] + K['9'] + K['10'] + K['13'] + K['16'] + K['18']
  K['20'] = B['26']
  K['21'] = K['19']
  K['23'] = K['21'] + K['22']
  K['24'] = Math.min(K['20'], K['23'])
  K['30'] = K['25'] + K['26'] + K['27'] + K['28'] + K['29']
  const sCorpBy = (c: 'A' | 'B'): number => r(sum(d.sCorp.filter((x) => (two ? owners[c].includes(x.owner) : true)).map((x) => pos(x.amount))))
  for (const c of cols) {
    const X = C[c]
    X['27a'] = DE_PERSONAL_CREDIT * exemptions[c]
    X['27b'] = DE_PERSONAL_CREDIT * owners[c].filter(is60).length
    if (c === otherCol && pos(d.otherState.tax) > 0) {
      const ratio = X['12'] > 0 ? Math.min(1, pos(d.otherState.income) / X['12']) : 0
      X['28'] = Math.min(r(X['24'] * ratio), r(pos(d.otherState.tax)))
    } else X['28'] = 0
    X['29'] = 1000 * owners[c].filter((o) => d.firefighter[o].trim() !== '').length
    X['30'] = c === 'B' ? K['24'] : 0
    X['31'] = c === careCol ? Math.min(3000, r(pos(res.schedule3.dependentCare) * 0.5)) : 0
    X['32'] = Math.min(X['26'], X['27a'] + X['27b'] + X['28'] + X['29'] + X['30'] + X['31'])
    X['33'] = X['26'] - X['32']
  }
  let eitc: DeResult['eitc'] = null
  const fedEic = r(pos(f['27a']))
  for (const c of cols) C[c]['34'] = 0
  if (fedEic > 0) {
    const l12 = C[eitcCol]['33']
    const l14 = r(fedEic * 0.045)
    const l15 = r(fedEic * 0.2)
    const l16 = l14 >= l12 ? l14 : 0
    const l17 = l14 >= l12 ? 0 : Math.min(l12, l15)
    eitc = { col: eitcCol, l12, l13: fedEic, l14, l15, l16, l17 }
    C[eitcCol]['34'] = l16 || l17
  }
  for (const c of cols) {
    const X = C[c]
    const os = two ? owners[c] : everyone
    X['35'] = r(sum(ret.w2s.filter((w) => os.includes(w.owner)).map((w) => pos(d.w2[w.id]?.stateTax ?? 0)))
      + sum(ret.retirement.filter((x) => os.includes(x.owner)).map((x) => pos(d.r1099[x.id]?.stateTax ?? 0))))
    X['36'] = c === 'B' ? r(pos(d.estimatedPayments)) : 0
    X['37'] = sCorpBy(c)
    X['38'] = c === 'B' ? K['30'] : 0
    X['39'] = c === 'B' ? r(pos(d.realEstatePayments)) : 0
    X['40'] = X['35'] + X['36'] + X['37'] + X['38'] + X['39']
    const paid = X['34'] + X['40']
    X['41'] = paid <= X['33'] ? X['33'] - paid : 0
    X['42'] = paid > X['33'] ? paid - X['33'] : 0
  }

  // ── Page 3 ──
  const L: Record<string, number> = {}
  L['43'] = sum('ABCDEFGHIJKLMNPQRSTU'.split('').map((k) => r(pos(d.contributions[k] ?? 0))))
  L['45'] = 0
  const over = sum(cols.map((c) => C[c]['42'])) - sum(cols.map((c) => C[c]['41']))
  const left = over - L['43'] - L['45']
  L['44'] = left > 0 ? Math.min(r(pos(d.creditForward)), left) : 0
  L['46'] = left > 0 ? 0 : -left
  L['47'] = left > 0 ? left - L['44'] : 0

  // ── Notes ──
  attach.push('Pages 1 and 2 of your federal Form 1040 and the federal schedules you filed')
  if (sum(cols.map((c) => C[c]['35'])) > 0) attach.push('W-2s and 1099-Rs showing Delaware tax withheld')
  if (sum(cols.map((c) => C[c]['28'])) > 0) attach.push(`A signed copy of your ${d.otherState.state.trim() || 'other state'} return`)
  if (sum(cols.map((c) => C[c]['31'])) > 0) attach.push('Federal Form 2441')
  if (eitc) attach.push('Federal Schedule EIC')
  if (sum(cols.map((c) => C[c]['8b'])) > 0) attach.push('Deposit records for the 529 / ABLE contributions')
  if (sum(cols.map((c) => C[c]['6'])) > 0) attach.push('1099-Rs supporting the pension exclusion')
  if (K['19'] + K['30'] > 0) attach.push('Division of Revenue approval letters for the PIT-CRS credits')
  if (sum(cols.map((c) => C[c]['37'])) > 0) attach.push('Form SCT-SSR for each S corporation payment')
  if (r(pos(d.realEstatePayments)) > 0) attach.push('Form REW-EST for the real estate tax payments')
  if (byOwnerTotal(d.higherEducation) > 0) attach.push('Forms 1098-T and proof of payment (higher-education exclusion)')
  if (itemize && totalItemized < totalStandard) issues.push('You chose to itemize although the Delaware standard deduction is larger; PIT-RSA line 18 is checked.')
  if (itemize && !d.salesTax && it.stateLocalIncomeOrSalesTax > 0) issues.push('PIT-RSA line 5a leaves out Delaware income tax: Delaware withholding, your Delaware estimated payments and tax credited to another state are taken off the state income tax you itemized federally.')
  if (ret.retirement.some((x) => isEarly(x.code))) issues.push('Distributions with code 1 (early) do not count toward the pension exclusion.')
  if (d.otherState.tax > 0 && !d.otherState.state.trim()) issues.push('Enter the two-letter code of the state you paid tax to (Schedule I).')
  if (deps > 0 && two) issues.push(`The $110 personal credits for your dependents are in column ${depCol}, where the tax can absorb them.`)
  if (L['46'] > 800) issues.push('The balance due is over $800: you may owe an estimated tax penalty (Form PIT-UND is not prepared here).')
  return { status, A: two ? A : {}, B, lines: L, alternative: null, itemize, rsa: S, rsaA, eitc, crs: K, owners, exemptions, issues, attach }
}

const byOwnerTotal = (rec: Record<Owner, number>): number => pos(rec.taxpayer ?? 0) + pos(rec.spouse ?? 0)
