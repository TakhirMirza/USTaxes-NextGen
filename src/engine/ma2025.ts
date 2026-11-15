/**
 * Massachusetts Form 1, full-year resident income tax return, tax year 2025.
 *
 * Source: 2025 Form 1 and its instructions. Part B (5.0%) income: wages, pensions (government contributory
 * pensions and Social Security are exempt), Massachusetts bank interest, business, rental and pass-through
 * income, unemployment, lottery and Schedule X; deductions for FICA/retirement (up to $2,000 each), 50% of rent
 * (up to $4,000) and Schedule Y; exemptions ($4,400 / $6,800 / $8,800, $1,000 per dependent, $700 at 65,
 * $2,200 blind, medical from Schedule A line 4). Part A income from Schedule B (other interest and dividends at
 * 5.0%, short-term gains at 8.5%) and long-term gains from Schedule D at 5.0%, with excess exemptions applied.
 * Tax table at 5.0% under $24,000 ($50 bands, midpoint), No Tax Status, Limited Income Credit, the 4% surtax
 * over $1,083,150, the EITC at 40% of the federal credit and the $440 Child and Family Tax Credit.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const MA_RATE = 0.05
export const MA_SHORT_TERM_RATE = 0.085
export const MA_SURTAX = { threshold: 1083150, rate: 0.04 }
export const MA_PERSONAL = { single: 4400, mfs: 4400, hoh: 6800, mfj: 8800, qss: 4400 } as const
export const MA_DONATION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

/** Line 22: 5.0% tax from the tax table (under $24,000) or income × 5%. */
export function maTax(income: number): number {
  const x = pos(Math.floor(income))
  if (x < 10) return 0
  if (x > 24000) return r(x * MA_RATE)
  const upper = Math.ceil(x / 50) * 50
  const lower = upper === 50 ? 9 : upper - 50
  return Math.floor(((lower + upper) / 2) * MA_RATE + 0.5)
}

/** Schedule HC Table 1: 150% of the federal poverty level by family size. */
export function maFpl150(size: number): number {
  return 22590 + 8070 * Math.max(0, size - 1)
}

/** No Tax Status thresholds (not available married filing separately). */
export function maNoTaxThreshold(fs: TaxReturnInput['filingStatus'], dependents: number): number | null {
  if (fs === 'single') return 8000
  if (fs === 'hoh') return 14400 + 1000 * dependents
  if (fs === 'mfj') return 16400 + 1000 * dependents
  return null
}

/** Limited Income Credit ceiling. */
export function maLicLimit(fs: TaxReturnInput['filingStatus'], dependents: number): number | null {
  if (fs === 'single') return 14000
  if (fs === 'hoh') return 25200 + 1750 * dependents
  if (fs === 'mfj') return 28700 + 1750 * dependents
  return null
}

export interface MaResult {
  lines: Record<string, number>
  scheduleB: { lines: Record<string, number>; interest: number; dividends: number; lossApplied: number; fivePercent: number; shortTerm: number }
  scheduleD: { longTerm: number }
  scheduleY: Record<string, number>
  excessExemptions: number
  noTaxStatus: boolean
  /** Schedule HC: family size, 150% of the federal poverty level and whether a penalty may apply. */
  health: { familySize: number; fpl150: number; atOrBelowFpl: boolean; askLine6: boolean; penaltyPossible: Record<Owner, boolean> }
  agi: number
  statements: { owner: Owner; employer: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeMassachusetts(ret: TaxReturnInput, res: TaxReturnResult): MaResult {
  const d = ret.ma
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const person = (o: Owner): TaxReturnInput['taxpayer'] => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const older = (o: Owner): boolean => person(o).age65OrOlder || person(o).age >= 65
  const s1 = res.schedule1

  // ── Exemptions (line 2) ──
  L['2a'] = MA_PERSONAL[fs]
  L['2bCount'] = ret.dependents.length
  L['2b'] = L['2bCount'] * 1000
  L['2cCount'] = owners.filter(older).length
  L['2c'] = L['2cCount'] * 700
  L['2dCount'] = owners.filter((o) => person(o).blind).length
  L['2d'] = L['2dCount'] * 2200
  L['2e'] = res.deduction.used === 'itemized' ? r(res.scheduleA.medical) : 0
  L['2f'] = 0
  L['2g'] = L['2a'] + L['2b'] + L['2c'] + L['2d'] + L['2e'] + L['2f']

  // ── 5.0% income (lines 3–10) ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  const retirements = ret.retirement.filter((x) => owners.includes(x.owner))
  L['3'] = statements.reduce((s, x) => s + x.wages, 0)
  L['4'] = r(pos(retirements.filter((x) => !x.ira).reduce((s, x) => s + pos(x.taxableAmount), 0) - pos(d.governmentPension)))
  L['5'] = r(pos(d.maBankInterest))
  L['6a'] = r(res.scheduleC.filter((c) => owners.includes(c.owner)).reduce((s, c) => s + c.netProfit, 0))
  L['7'] = r(s1.rentalIncome)
  L['8a'] = r(s1.unemployment)
  L['8b'] = r(pos(d.lotteryWinnings))
  const xIra = r(pos(retirements.filter((x) => x.ira).reduce((s, x) => s + pos(x.taxableAmount), 0) - pos(d.iraBasisRecovered)))
  L['9'] = pos(xIra)
  L['10'] = L['3'] + L['4'] + L['5'] + L['6a'] + L['7'] + L['8a'] + L['8b'] + L['9']

  // ── Deductions (lines 11–16) ──
  const fica = (o: Owner): number => Math.min(2000, r(ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + pos(w.socialSecurityWithheld) + pos(w.medicareWithheld), 0)
    + res.scheduleSE.filter((x) => x.owner === o).reduce((s, x) => s + x.total, 0)))
  L['11a'] = fica('taxpayer')
  L['11b'] = joint ? fica('spouse') : 0
  L['14a'] = r(pos(d.rentPaid))
  L['14'] = Math.min(r(L['14a'] / 2), fs === 'mfs' ? 2000 : 4000)
  const adj = s1.adjustments
  const Y: Record<string, number> = {
    '7': r(adj.selfEmployedHealthInsurance ?? 0),
    '8': r(adj.hsaDeduction ?? 0),
    '9c': r(pos(ret.itemized.charityCash) + pos(ret.itemized.charityNonCash)),
    '10': Math.min(2500, r(adj.studentLoanInterest ?? 0)),
    '15': owners.reduce((s, o) => s + Math.min(750, pos(pos(d.commuter[o]) - 150)), 0),
    '18a': Math.min(r(pos(d.collegeSavings)), joint ? 2000 : 1000),
    other: r(pos(d.otherDeductions))
  }
  Y['19'] = Object.values(Y).reduce((s, v) => s + v, 0)
  L['15'] = Y['19']
  L['16'] = L['11a'] + L['11b'] + L['14'] + L['15']
  L['17'] = pos(L['10'] - L['16'])
  L['18'] = L['2g']
  L['19'] = pos(L['17'] - L['18'])
  let excess = pos(L['18'] - L['17'])
  const excessTotal = excess

  // ── Schedule B (interest, dividends, short-term gains) and Schedule D (long-term gains) ──
  const B: Record<string, number> = {}
  B['1'] = r(pos(f['2a']) + pos(f['2b']))
  B['2'] = r(pos(f['3b']))
  B['3'] = 0
  B['4'] = B['1'] + B['2'] + B['3']
  B['5'] = r(pos(d.maBankInterest))
  B['6a'] = r(pos(d.usObligationInterest) + pos(pos(f['2a']) - pos(d.otherStateBondInterest)))
  B['7'] = pos(B['4'] - B['5'] - B['6a'])
  B['8'] = 0
  B['9'] = B['7']
  const st = r(res.scheduleD.shortTerm)
  let lt = r(res.scheduleD.longTerm)
  B['10'] = pos(st)
  B['13a'] = B['10']; B['13c'] = B['13a']; B['15'] = B['13c']
  B['16'] = st < 0 ? st : 0
  B['19a'] = B['15'] + B['16']
  B['19c'] = B['19a']
  if (B['19c'] < 0) {
    B['20'] = Math.min(B['9'], -B['19c'], 2000)
    B['21'] = B['19c'] + B['20']
    const used = Math.min(-B['21'], pos(lt))
    B['22'] = used
    lt -= used
    B['23'] = B['21'] + used
    B['28'] = 0
  } else {
    B['20'] = 0
    B['24'] = B['19c']
    B['25'] = lt < 0 ? Math.min(-lt, B['24']) : 0
    lt += B['25']
    B['26'] = B['24'] - B['25']
    B['27'] = 0
    B['28'] = B['26']
    B['23'] = 0
  }
  B['29'] = B['9']
  B['30'] = B['20']
  B['31'] = B['29'] - B['30']
  B['32'] = lt < 0 ? Math.min(-lt, 2000, B['31']) : 0
  lt += B['32']
  B['33'] = B['31'] - B['32']
  B['34'] = B['28']
  B['35'] = B['33'] + B['34']
  B['36'] = Math.min(excess, B['35'])
  excess -= B['36']
  B['37'] = B['35'] - B['36']
  B['38'] = Math.min(B['37'], B['9'])
  B['39'] = pos(B['37'] - B['38'])
  B['40'] = B['23']
  const interest = pos(B['1'] - pos(f['2a']) - B['5'] - pos(d.usObligationInterest) + pos(d.otherStateBondInterest))
  const dividends = B['2']
  const lossApplied = B['30'] + B['32']
  const ltGain = pos(lt)
  const dExcess = Math.min(excess, ltGain)
  excess -= dExcess
  const longGain = ltGain - dExcess
  const shortGain = B['39']
  L['20'] = B['38']
  L['21'] = L['19'] + L['20']
  L['22'] = maTax(L['21'])
  L['23a'] = shortGain
  L['23aTax'] = r(shortGain * MA_SHORT_TERM_RATE)
  L['23'] = L['23aTax']
  L['24'] = r(longGain * MA_RATE)
  L['28a'] = L['22'] + L['23'] + L['24']
  const surtaxBase = L['21'] + shortGain + longGain
  L['28b'] = r(pos(surtaxBase - MA_SURTAX.threshold) * MA_SURTAX.rate)

  // ── No Tax Status and Limited Income Credit ──
  const deps = ret.dependents.length
  const yEarly = Y['7'] + Y['8'] + Y['9c'] + Y['10']
  const agi = pos(L['10'] - yEarly) + B['35'] + ltGain
  const nts = maNoTaxThreshold(fs, deps)
  const noTaxStatus = nts !== null && agi <= nts
  L['28'] = noTaxStatus ? 0 : L['28a'] + L['28b']
  const lic = maLicLimit(fs, deps)
  L['29'] = 0
  if (!noTaxStatus && nts !== null && lic !== null && agi <= lic) L['29'] = pos(L['28'] - r((agi - nts) * 0.1))
  L['30'] = r(pos(d.otherStateCredit))
  L['31'] = r(pos(d.otherCredits))
  L['32'] = pos(L['28'] - L['29'] - L['30'] - L['31'])
  for (const k of MA_DONATION_LETTERS) L[`33${k}`] = r(pos(d.donations[k] ?? 0))
  L['33'] = MA_DONATION_LETTERS.reduce((s, k) => s + L[`33${k}`], 0)
  L['34'] = r(pos(d.useTax))
  L['35'] = 0
  L['37'] = L['32'] + L['33'] + L['34'] + L['35']

  // ── Payments and refundable credits ──
  L['38a'] = statements.reduce((s, x) => s + x.tax, 0)
  L['38b'] = r(pos(d.withholding1099))
  L['38c'] = r(pos(d.otherWithholding))
  L['38'] = L['38a'] + L['38b'] + L['38c']
  L['39'] = r(pos(d.priorOverpayment))
  L['40'] = r(pos(d.estimatedPayments))
  L['41'] = r(pos(d.extensionPayment))
  L['43a'] = res.eic.qualifyingChildren
  L['43b'] = fs === 'mfs' ? 0 : r(pos(res.eic.credit))
  L['43'] = r(L['43b'] * 0.4)
  L['44'] = r(pos(d.circuitBreaker))
  const familyCount = fs === 'mfs' ? 0 : ret.dependents.filter((x) => x.age < 13).length + Math.max(0, Math.floor(d.extraFamilyCredit))
  L['46a'] = familyCount
  L['46'] = familyCount * 440
  L['47'] = 0
  L['48'] = L['43'] + L['44'] + L['46'] + L['47']
  L['51'] = L['38'] + L['39'] + L['40'] + L['41'] + L['48']
  L['52'] = pos(L['51'] - L['37'])
  L['53'] = Math.min(r(pos(d.creditForward)), L['52'])
  L['54'] = L['52'] - L['53']
  L['55'] = pos(L['37'] - L['51'])

  // ── Schedule HC ──
  const familySize = owners.length + deps
  const fpl150 = maFpl150(familySize)
  const fagi = r(f['11a'])
  const atOrBelowFpl = fagi <= fpl150
  const govAtSomePoint = (o: Owner): boolean => d.health[o].plans.medicare || d.health[o].plans.military || d.health[o].plans.other
  const longestGap = (m: boolean[]): number => { let best = 0; let run = 0; for (const x of m) { run = x ? 0 : run + 1; best = Math.max(best, run) } return best }
  const needsLine6 = (o: Owner): boolean => d.health[o].coverage !== 'full' && !(d.health[o].coverage === 'part' && govAtSomePoint(o))
  const penaltyPossible: Record<Owner, boolean> = { taxpayer: false, spouse: false }
  for (const o of owners) {
    if (!needsLine6(o) || atOrBelowFpl) continue
    penaltyPossible[o] = d.health[o].coverage === 'none' || longestGap(d.health[o].months) >= 4
  }
  const askLine6 = owners.some(needsLine6)

  // ── Notes ──
  if (penaltyPossible.taxpayer || penaltyPossible.spouse) issues.push('Health care penalty: without coverage for 4 or more months in a row and income above 150% of the poverty level, a penalty may apply. Complete Schedule HC lines 8–12 and the Health Care Penalty Worksheet, then enter the amount on Form 1, line 35.')
  if (askLine6 && atOrBelowFpl) issues.push(`Schedule HC line 6: your federal AGI is at or below 150% of the poverty level (${fpl150.toLocaleString('en-US')} for a family of ${familySize}), so no health care penalty applies.`)
  if (owners.some((o) => d.health[o].plans.private && !d.health[o].subscriber.trim())) issues.push('Schedule HC line 4f/4g: enter your insurer and subscriber number from Form MA 1099-HC.')
  if (owners.some((o) => !d.birthDate[o])) issues.push('Schedule HC line 1 asks for date of birth.')
  if (res.scheduleD.longTerm !== 0) attach.push(`Schedule D (long-term capital gains ${ltGain.toLocaleString('en-US')} taxed at 5%)`)
  if (L['9'] > 0) attach.push('Schedule X (IRA/Keogh distributions and other income)')
  if (L['15'] > 0) attach.push('Schedule Y (other deductions)')
  if (L['6a'] !== 0) attach.push('Massachusetts Schedule C')
  if (L['7'] !== 0) attach.push('Massachusetts Schedule E (computer-generated, from tax software)')
  if (L['28b'] > 0) attach.push('Schedule 4% Surtax')
  if (L['44'] > 0) attach.push('Schedule CB (Senior Circuit Breaker Credit)')
  if (noTaxStatus) issues.push(`No Tax Status: Massachusetts AGI of ${agi.toLocaleString('en-US')} is at or below ${(nts ?? 0).toLocaleString('en-US')}, so no income tax is due.`)
  if (L['29'] > 0) issues.push(`Limited Income Credit: ${L['29'].toLocaleString('en-US')}.`)
  if (excessTotal > 0) issues.push('Your exemptions exceed your 5.0% income; the excess is applied to interest, dividends and capital gains (excess exemption oval on line 24).')
  if (L['9'] > 0 && d.iraBasisRecovered === 0) issues.push('IRA distributions: Massachusetts never allowed a deduction for IRA contributions, so contributions you made are recovered tax-free first. Enter them on the IRA line if they are not yet recovered.')
  if (retirements.some((x) => !x.ira && x.taxableAmount > 0) && d.governmentPension === 0) issues.push('Contributory pensions from the U.S. government or Massachusetts (and its cities and towns) and military retirement are not taxed; enter them as government pensions.')
  if (f['6b'] > 0) issues.push('Social Security is not taxed in Massachusetts.')
  if (st !== 0 || res.scheduleD.longTerm !== 0) issues.push('Capital gains use the federal short- and long-term totals. Massachusetts has its own loss carryovers and collectibles rate (12%); adjust Schedules B and D if they apply.')
  if (older('taxpayer') || (joint && older('spouse'))) issues.push('Seniors who own or rent their home may qualify for the Senior Circuit Breaker Credit (up to $2,820) on Schedule CB.')
  if (Y['9c'] > 0) issues.push('Charitable deduction (Schedule Y line 9c): the federal amount without household goods or used clothing, allowed even if you do not itemize.')

  return {
    lines: L,
    scheduleB: { lines: B, interest, dividends, lossApplied, fivePercent: L['20'], shortTerm: L['23a'] },
    scheduleD: { longTerm: longGain },
    scheduleY: Y, excessExemptions: excessTotal, noTaxStatus,
    health: { familySize, fpl150, atOrBelowFpl, askLine6, penaltyPossible },
    agi, statements, issues, attach
  }
}
