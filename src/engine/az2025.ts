/**
 * Arizona Form 140, full-year resident personal income tax return, tax year 2025.
 *
 * Source: 2025 Form 140 (ADOR 10413 (25)) and its instructions: flat 2.5% (line 46); standard deduction $15,750
 * single or married filing separately, $31,500 joint, $23,625 head of household (a federal qualifying surviving
 * spouse files as head of household); 34% of charitable gifts added to the standard deduction (page 3); exemptions
 * of $2,100 per person 65 or older, $1,500 per blind person, $2,300 other exemptions, $10,000 per qualifying parent
 * or grandparent; subtractions for U.S. obligation interest, up to $2,500 per person of government pensions,
 * military retirement, taxable Social Security, active military pay, 25% of long-term gain on assets acquired
 * after 2011, and 529/ABLE contributions up to $2,000 per beneficiary ($4,000 joint); the Dependent Tax Credit
 * ($100 under 17, $25 at 17 or older, cut 5% per $1,000 of federal AGI over $200,000/$400,000); the Family Income
 * Tax Credit worksheet; and the Increased Excise Tax Credit ($25 per person, $100 per household).
 * Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

export const AZ_RATE = 0.025
export const AZ_STANDARD = { single: 15750, mfs: 15750, mfj: 31500, hoh: 23625, qss: 23625 } as const
export const AZ_EXEMPTION = { age65: 2100, blind: 1500, other: 2300, parent: 10000 }
export const AZ_GOV_PENSION = 2500
export const AZ_529_LIMIT = { single: 2000, joint: 4000 }
export const AZ_CHARITY_RATE = 0.34
export const AZ_LTCG_RATE = 0.25
export const AZ_DEPENDENT_CREDIT = { under17: 100, over17: 25, threshold: 200000, thresholdJoint: 400000 }
export const AZ_DONATION_LINES = ['64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74'] as const

/** Filing status box on Form 140: 4 joint, 5 head of household, 6 separate, 7 single. */
export type AzStatus = 'mfj' | 'hoh' | 'mfs' | 'single'
const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export function azStatus(fs: TaxReturnInput['filingStatus']): AzStatus {
  return fs === 'qss' ? 'hoh' : fs
}

/** Table V: the share of the Dependent Tax Credit kept when federal AGI is over the limit. */
export function azDependentFactor(fagi: number, joint: boolean): number {
  const over = fagi - (joint ? AZ_DEPENDENT_CREDIT.thresholdJoint : AZ_DEPENDENT_CREDIT.threshold)
  if (over <= 0) return 1
  if (over > 19000) return 0
  return Math.round((1 - 0.05 * Math.ceil(over / 1000)) * 100) / 100
}

/** Family Income Tax Credit, Step 2 tables: the most income allowed for the number of dependents. */
export function azFamilyMaxIncome(status: AzStatus, dependents: number): number {
  if (status === 'mfj') return dependents <= 1 ? 20000 : dependents === 2 ? 23600 : dependents === 3 ? 27300 : 31000
  if (status === 'hoh') return dependents <= 1 ? 20000 : dependents === 2 ? 20135 : dependents === 3 ? 23800 : dependents === 4 ? 25200 : 26575
  return 10000
}

export interface AzDependentRow { name: string; ssn: string; relationship: string; months: number; under17: boolean }

/** 2025 Form 140PTC credit schedules: Schedule 1 (lived alone) and Schedule 2 (lived with others). */
const PTC_CREDITS = [502, 479, 457, 435, 412, 390, 368, 345, 323, 301, 279, 256, 234, 212, 189, 167, 145, 123, 100, 78, 56, 0]
export function azPtcCredit(income: number, alone: boolean): number {
  const [first, step] = alone ? [1750, 100] : [2500, 150]
  if (income <= first) return PTC_CREDITS[0]
  return PTC_CREDITS[Math.min(PTC_CREDITS.length - 1, Math.ceil((income - first) / step))]
}

export interface AzPtcResult {
  /** Part 1 household income: rows A–I by column (1 you, 2 spouse, 3 others, 4 total) and line J. */
  income: Record<string, [number, number, number, number]>
  J: number
  lines: Record<string, number>
  qualifies: boolean
  dependents: { name: string; ssn: string; relationship: string; months: number }[]
}

export function computeAzPtc(ret: TaxReturnInput, res: TaxReturnResult): AzPtcResult | null {
  const p = ret.az.ptc
  if (!p.claim) return null
  const joint = ret.filingStatus === 'mfj'
  const r = Math.round
  const f = res.f1040
  const wages = (o: 'taxpayer' | 'spouse'): number => r(ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0))
  const pension = (o: 'taxpayer' | 'spouse'): number => r(ret.retirement.filter((x) => x.owner === o).reduce((s, x) => s + Math.max(0, x.taxableAmount), 0))
  const s1 = res.schedule1
  const row = (a: number, b: number, c = 0): [number, number, number, number] => [a, joint ? b : 0, c, a + (joint ? b : 0) + c]
  const income: AzPtcResult['income'] = {
    A: row(wages('taxpayer'), wages('spouse')),
    B: row(r((f['2b'] ?? 0) + (f['3b'] ?? 0)), 0),
    C: row(r(s1.businessIncome), 0),
    D: row(r((f['7a'] ?? 0) + s1.otherGains), 0),
    E: row(pension('taxpayer'), pension('spouse')),
    F: row(r(s1.rentalIncome), 0),
    G: row(0, 0),
    H: row(0, 0),
    I: row(r(s1.unemployment + s1.otherIncome + s1.hsaTaxable), 0, r(Math.max(0, p.otherPersonsIncome)))
  }
  const J = Object.values(income).reduce((s, x) => s + x[3], 0)
  const L: Record<string, number> = {}
  L['10'] = J
  L['11'] = azPtcCredit(J, p.livedAlone)
  L['12'] = p.own ? r(Math.max(0, p.propertyTax)) : 0
  L['13'] = p.own ? 0 : r(Math.max(0, p.landlordTax))
  L['14'] = L['12'] + L['13']
  L['15'] = Math.min(L['11'], L['14'])
  const claimed = ret.canBeClaimedAsDependent || !!p.claimedByName.trim()
  const deps = claimed ? [] : ret.dependents.slice(0, 3).map((x) => ({ name: x.name, ssn: x.ssn, relationship: x.relationship, months: x.monthsLivedWithYou }))
  if (!claimed) {
    L['p2'] = deps.length; L['p3'] = joint ? 2 : 1; L['p4'] = L['p2'] + L['p3']; L['p5'] = L['p4'] * 25; L['p6'] = Math.min(L['p5'], 100)
    L['17'] = L['p6']; L['18'] = L['p2']
  } else L['17'] = 0
  L['19'] = L['15'] + L['17']
  const old = ret.taxpayer.age >= 65 || ret.taxpayer.age65OrOlder
  return { income, J, lines: L, qualifies: (old || p.ssi) && L['11'] > 0, dependents: deps }
}

export interface AzResult {
  status: AzStatus
  lines: Record<string, number>
  /** Page 3: standard deduction increase for charitable contributions. */
  charity: Record<string, number>
  deduction: { method: 'standard' | 'itemized'; standard: number; itemized: number }
  dependents: AzDependentRow[]
  counts: { age65: number; blind: number; under17: number; over17: number; parents: number; other: number }
  credits: { dependentFactor: number; familyQualifies: boolean; familyPeople: number; excisePeople: number }
  statements: { owner: Owner; employer: string; ein: string; stateId: string; wages: number; tax: number }[]
  /** Form 140PTC (null unless claimed). */
  ptc: AzPtcResult | null
  issues: string[]
  attach: string[]
}

const PARENT = /(parent|mother|father|grandma|grandpa)/i

export function computeArizona(ret: TaxReturnInput, res: TaxReturnResult): AzResult {
  const d = ret.az
  const f = res.f1040
  const status = azStatus(ret.filingStatus)
  const joint = status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const C: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])

  // ── Exemption counts (boxes 8–11a) ──
  const people = owners.map((o) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse))
  const age65 = people.filter((p) => p.age65OrOlder || p.age >= 65).length
  const blind = people.filter((p) => p.blind).length
  const parents = Math.max(0, Math.floor(d.qualifyingParents))
  // A qualifying parent or grandparent takes the $10,000 exemption instead of the dependent credit.
  let parentsLeft = parents
  const deps = ret.dependents.filter((x) => {
    if (parentsLeft > 0 && PARENT.test(x.relationship)) { parentsLeft--; return false }
    return true
  })
  const dependents: AzDependentRow[] = deps.map((x) => ({ name: x.name.trim(), ssn: x.ssn, relationship: x.relationship.trim(), months: x.monthsLivedWithYou, under17: x.age < 17 }))
  const under17 = dependents.filter((x) => x.under17).length
  const over17 = dependents.length - under17
  const other = Math.max(0, Math.floor(d.otherExemptions))

  // ── Income, additions and subtractions (lines 12–37) ──
  L['12'] = fagi
  L['13'] = 0
  L['14'] = L['12'] - L['13']
  L['15'] = r(pos(d.otherStateBondInterest))
  L['16'] = 0
  L['17'] = 0
  L['18'] = r(pos(d.otherAdditions))
  L['19'] = L['14'] + L['15'] + L['16'] + L['17'] + L['18']
  const sd = res.scheduleD
  L['20'] = r(f['7a'])
  L['21'] = r(sd.shortTerm)
  L['22'] = r(sd.longTerm)
  const ltcgCap = pos(Math.min(L['22'], L['20']))
  L['23'] = d.ltcgAfter2011 === null ? 0 : Math.min(r(pos(d.ltcgAfter2011)), ltcgCap)
  L['24'] = r(L['23'] * AZ_LTCG_RATE)
  L['25'] = 0
  L['26'] = 0
  L['27'] = 0
  L['28'] = r(pos(d.usObligationInterest))
  L['29a'] = owners.reduce((s, o) => s + Math.min(r(pos(d.governmentPension[o])), AZ_GOV_PENSION), 0)
  L['29b'] = owners.reduce((s, o) => s + r(pos(d.militaryRetirement[o])), 0)
  L['30'] = r(pos(f['6b']))
  L['31'] = 0
  L['32'] = r(pos(d.activeMilitaryPay))
  L['33'] = 0
  const limit529 = (joint ? AZ_529_LIMIT.joint : AZ_529_LIMIT.single) * Math.max(1, Math.floor(d.beneficiaries))
  L['34a'] = Math.min(r(pos(d.contributions529)), limit529)
  L['34b'] = Math.min(r(pos(d.contributionsAble)), limit529)
  L['34c'] = L['34a'] + L['34b']
  L['35'] = L['19'] - (L['24'] + L['25'] + L['26'] + L['27'] + L['28'] + L['29a'] + L['29b'] + L['30'] + L['31'] + L['32'] + L['33'] + L['34c'])
  L['36'] = r(pos(d.otherSubtractions))
  L['37'] = L['35'] - L['36']

  // ── Exemptions (lines 38–42) ──
  L['8'] = age65; L['9'] = blind; L['10a'] = under17; L['10b'] = over17; L['11a'] = parents; L['40E'] = other
  L['38'] = age65 * AZ_EXEMPTION.age65
  L['39'] = blind * AZ_EXEMPTION.blind
  L['40'] = other * AZ_EXEMPTION.other
  L['41'] = parents * AZ_EXEMPTION.parent
  L['42'] = pos(L['37'] - L['38'] - L['39'] - L['40'] - L['41'])

  // ── Deductions (lines 43–45): the larger of itemized or standard plus 34% of charitable gifts ──
  const standard = AZ_STANDARD[ret.filingStatus]
  const it = ret.itemized
  C['1C'] = r(pos(it.charityCash))
  C['2C'] = r(pos(it.charityNonCash))
  C['3C'] = r(pos(d.charityCarryover))
  C['4C'] = C['1C'] + C['2C'] + C['3C']
  C['5C'] = r(pos(d.charityCreditGifts))
  C['6C'] = pos(C['4C'] - C['5C'])
  C['7C'] = r(C['6C'] * AZ_CHARITY_RATE)
  const federalItemized = r(res.deduction.itemized)
  const itemized = pos(federalItemized - r(pos(d.itemizedAdjustment)))
  const mustItemize = ret.filingStatus === 'mfs' && d.spouseItemizes
  const itemizes = mustItemize || (itemized > standard + C['7C'] && federalItemized > 0)
  L['43'] = itemizes ? itemized : standard
  L['44'] = itemizes ? 0 : C['7C']
  L['45'] = pos(L['42'] - L['43'] - L['44'])

  // ── Tax and credits (lines 46–52) ──
  L['46'] = r(L['45'] * AZ_RATE)
  L['47'] = 0
  L['48'] = L['46'] + L['47']
  const factor = azDependentFactor(fagi, joint)
  L['49'] = r((under17 * AZ_DEPENDENT_CREDIT.under17 + over17 * AZ_DEPENDENT_CREDIT.over17) * factor)
  // Family Income Tax Credit: Worksheet I line 8 is line 42 plus the exemptions (no small business income here).
  const familyIncome = L['42'] + L['38'] + L['39'] + L['40'] + L['41'] + L['13']
  const familyDeps = under17 + over17 + parents
  const familyQualifies = !ret.canBeClaimedAsDependent && familyIncome <= azFamilyMaxIncome(status, familyDeps)
  const familyPeople = familyDeps + (joint ? 2 : 1)
  L['50'] = familyQualifies ? Math.min(familyPeople * 40, status === 'mfj' || status === 'hoh' ? 240 : 120) : 0
  L['51'] = r(pos(d.nonrefundableCredits))
  L['52'] = pos(L['48'] - L['49'] - L['50'] - L['51'])

  // ── Payments and refundable credits (lines 53–59) ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  L['53'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.withholding1099))
  L['54a'] = r(pos(d.estimatedPayments))
  L['54b'] = 0
  L['54c'] = L['54a'] + L['54b']
  L['55'] = r(pos(d.extensionPayment))
  const exciseLimit = status === 'mfj' || status === 'hoh' ? 25000 : 12500
  const excisePeople = !ret.canBeClaimedAsDependent && fagi <= exciseLimit ? familyDeps + (joint ? 2 : 1) : 0
  // Filing Form 140PTC: the excise tax credit is figured there instead.
  L['56'] = d.ptc.claim ? 0 : Math.min(excisePeople * 25, 100)
  L['57'] = 0
  L['58'] = r(pos(d.refundableCredits))
  L['59'] = L['53'] + L['54c'] + L['55'] + L['56'] + L['57'] + L['58']

  // ── Balance (lines 60–80) ──
  L['60'] = pos(L['52'] - L['59'])
  L['61'] = pos(L['59'] - L['52'])
  L['62'] = Math.min(r(pos(d.creditForward)), L['61'])
  L['63'] = L['61'] - L['62']
  for (const k of AZ_DONATION_LINES) L[k] = r(pos(d.donations[k] ?? 0))
  L['76'] = 0
  L['78'] = AZ_DONATION_LINES.reduce((s, k) => s + L[k], 0) + L['76']
  const net = L['63'] - L['78']
  L['79'] = pos(net)
  L['80'] = L['60'] + (L['60'] > 0 ? L['78'] : pos(-net))

  // ── Notes ──
  if (L['18'] > 0) attach.push('Form 140 page 5 (Other Additions) with the items listed')
  if (L['36'] > 0) attach.push('Form 140 page 6 (Other Subtractions) with the items listed')
  if (L['44'] > 0) attach.push('Form 140 page 3 (Standard Deduction Increase for Charitable Contributions)')
  if (itemizes) attach.push('Copy of federal Schedule A (and Arizona Schedule A if you adjusted it)')
  if (L['53'] > 0) attach.push('W-2s and 1099-Rs showing Arizona tax withheld')
  if (L['51'] > 0) attach.push('Form 301 and the credit forms for line 51')
  if (L['58'] > 0) attach.push('The credit forms for line 58 (308-I, 334 or 349)')
  if (dependents.length > 3 || parents > 2 || other > 0) attach.push('Form 140 page 4 (more dependents, parents or other exemptions)')
  if (L['22'] > 0 && d.ltcgAfter2011 === null) issues.push('You have long-term capital gains. Arizona subtracts 25% of the net long-term gain on assets bought after 2011: enter that gain to claim it (line 23).')
  if (L['29a'] === 0 && ret.retirement.some((x) => !x.ira && x.taxableAmount > 0)) issues.push('If a pension is from the U.S. government or an Arizona state or local government, up to $2,500 of it per person is not taxed: enter it under government pensions.')
  if (factor < 1 && L['49'] > 0) issues.push(`Federal AGI is over the limit, so the Dependent Tax Credit is ${Math.round(factor * 100)}% of the full amount (Table V).`)
  if (fagi <= exciseLimit && L['56'] > 0) issues.push('Increased Excise Tax Credit: do not claim it if someone else in your household already claimed $100, or if you file Form 140PTC (then it is figured there).')
  if (age65 > 0 && fagi < 10000 && !d.ptc.claim) issues.push('At 65 or older with low income you may also qualify for the Property Tax Credit (Form 140PTC): see the Arizona step.')
  if (statements.some((x) => x.tax > 0 && !x.ein)) issues.push('Enter each W-2’s employer ID for your records.')
  if (ret.filingStatus === 'mfs') issues.push('Arizona is a community property state: a separate return reports half of community income (see page 5 item A / page 6 item A).')
  const ptc = computeAzPtc(ret, res)
  if (ptc) {
    if (!ptc.qualifies) issues.push(ptc.lines['11'] === 0 ? `Form 140PTC: household income ${ptc.J.toLocaleString('en-US')} is above the limit, so no property tax credit is allowed.` : 'Form 140PTC is only for people 65 or older or receiving Title 16 SSI payments.')
    attach.push('Form 140PTC is filed separately (by April 15, 2026) with proof of property taxes paid or Form 201 from your landlord' + (ret.az.ptc.ssi ? ', and proof of SSI payments' : ''))
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(ret.az.ptc.birthDate.trim())) issues.push('Form 140PTC: enter your date of birth (box 79).')
  }
  if (L['60'] > 1000 && L['54a'] === 0) issues.push('A large balance due may mean an estimated payment penalty (Form 221).')

  return {
    status, lines: L, charity: C,
    deduction: { method: itemizes ? 'itemized' : 'standard', standard, itemized },
    dependents, counts: { age65, blind, under17, over17, parents, other },
    credits: { dependentFactor: factor, familyQualifies, familyPeople, excisePeople },
    statements, ptc, issues, attach
  }
}
