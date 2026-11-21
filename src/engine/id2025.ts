/**
 * Idaho Form 40, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form 40 (EFO00089 03-02-2026) with its instructions, and Form 39R (EFO00088 03-02-2026) with the
 * Form 40 / 43 / 39R / 39NR instruction booklet (EIN00046). Idaho starts from federal AGI; Form 39R Part A additions and
 * Part B subtractions (Social Security and railroad benefits, U.S. interest, state refund, child care worksheet with a
 * $12,000 limit, retirement benefits deduction of $48,216 / $72,324 less Social Security, college savings up to
 * $6,000 / $12,000, health and long-term care insurance premiums); the federal standard deduction amounts
 * ($15,750 / $31,500 / $23,625 plus $1,600 or $2,000 for 65 or blind; dependents limited to earned income + $450,
 * at least $1,350) or federal itemized deductions without state income or sales taxes; the federal QBI and
 * Schedule 1-A deductions (Form 1040 lines 13a + 13b); tax of 5.3% of taxable income above $4,811 ($9,622 joint,
 * head of household and qualifying surviving spouse); Idaho child tax credit $205 per qualifying child 16 or under;
 * $10 permanent building fund tax; refundable food tax credit $155 per person; $100 credit per family member 65+ or
 * developmentally disabled you maintain a home for (up to $300). Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const ID_STANDARD: Record<TaxReturnInput['filingStatus'], number> = { single: 15750, mfs: 15750, mfj: 31500, qss: 31500, hoh: 23625 }
export const ID_FOOD_CREDIT = 155
export const ID_CHILD_CREDIT = 205

/** Line 20 worksheet: 5.3% of Idaho taxable income above $4,811 ($9,622 for joint, head of household and qualifying surviving spouse). */
export function idTax(taxable: number, fs: TaxReturnInput['filingStatus']): number {
  const floor = fs === 'single' || fs === 'mfs' ? 4811 : 9622
  return r(pos(Math.floor(taxable) - floor) * 0.053)
}

/** Gross income at or above which a resident must file (and owes the $10 permanent building fund tax). */
export function idFilingThreshold(fs: TaxReturnInput['filingStatus'], olds: number): number {
  if (fs === 'mfs') return 5
  if (fs === 'mfj') return 31500 + 1600 * Math.min(2, olds)
  if (fs === 'qss') return 31500 + 1600 * Math.min(1, olds)
  if (fs === 'hoh') return 23625 + 2000 * Math.min(1, olds)
  return 15750 + 2000 * Math.min(1, olds)
}

export interface IdResult {
  lines: Record<string, number>
  /** Form 39R lines (A1…A7, B1…B24, C1…C7, D4, E4). */
  s39: Record<string, number>
  household: { a: number; b: number; c: number; d: number }
  boxes: { old: Record<Owner, boolean>; blind: Record<Owner, boolean>; dependent: boolean }
  /** Food tax credit worksheet: people counted. */
  food: { taxpayer: number; spouse: number; dependents: number }
  qualifyingChildren: number
  itemize: boolean
  pbfWaived: boolean
  issues: string[]
  attach: string[]
}

export function computeIdaho(ret: TaxReturnInput, res: TaxReturnResult): IdResult {
  const d = ret.id
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const isOld = (o: Owner): boolean => person(o).age >= 65 || person(o).age65OrOlder
  const L: Record<string, number> = {}
  const S: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const dependentFiler = ret.canBeClaimedAsDependent
  const earnedOf = (o: Owner): number => r(ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + pos(w.wages), 0) + res.scheduleC.filter((b) => b.owner === o).reduce((s, b) => s + pos(b.netProfit), 0))

  // ── Household (line 6) ──
  const household = { a: dependentFiler ? 0 : 1, b: joint ? 1 : 0, c: ret.dependents.length, d: 0 }
  household.d = household.a + household.b + household.c

  // ── Form 39R Part A: additions ──
  S['A3'] = r(pos(d.otherStateBondInterest))
  S['A6'] = r(pos(d.otherAdditions))
  S['A7'] = S['A3'] + S['A6']

  // ── Form 39R Part B: subtractions ──
  S['B2'] = res.deduction.used === 'itemized' ? r(pos(d.stateRefund)) : 0
  S['B3'] = r(pos(d.usObligationInterest))
  // Line 6: child and dependent care worksheet.
  const care = ret.dependentCare
  if (res.form2441.qualifyingPersons > 0 && care.expenses > 0) {
    const w1 = r(pos(care.expenses - care.employerBenefits))
    const w4 = pos(12000 - (res.form2441.partIII?.line25 ?? 0))
    const w5 = earnedOf('taxpayer')
    const w6 = joint ? earnedOf('spouse') : w5
    S['B6'] = pos(Math.min(w1, w4, w5, w6))
  } else S['B6'] = 0
  S['B7'] = r(pos(f['6b']))
  // Line 8: retirement benefits deduction.
  const ssReceived = r(ret.socialSecurity.filter((x) => owners.includes(x.owner)).reduce((s, x) => s + pos(x.netBenefits), 0))
  const qualifies = (o: Owner, kind: 'military' | 'qualified'): boolean => {
    const p = person(o)
    if (kind === 'military') return d.disabled[o] || p.age >= 62 || earnedOf(o) > 0
    return fs !== 'mfs' && (isOld(o) || (d.disabled[o] && p.age >= 62))
  }
  const eligible = ret.retirement.filter((x) => owners.includes(x.owner) && (d.retirementKind[x.id] ?? 'none') !== 'none')
  const qualified = eligible.filter((x) => qualifies(x.owner, d.retirementKind[x.id] as 'military' | 'qualified'))
  S['B8e'] = r(qualified.reduce((s, x) => s + pos(x.taxableAmount), 0))
  if (S['B8e'] > 0) {
    S['B8a'] = joint ? 72324 : 48216
    S['B8b'] = 0
    S['B8c'] = ssReceived
    S['B8d'] = pos(S['B8a'] - S['B8b'] - S['B8c'])
    S['B8f'] = Math.min(S['B8d'], S['B8e'])
  } else S['B8f'] = 0
  if (eligible.length > qualified.length) issues.push('Some retirement benefits you marked don’t meet the age or disability test for the Idaho retirement benefits deduction (65 or older, or 62 and disabled; any age for military retirees who are disabled, 62 or older, or working). They are left out.')
  S['B14'] = Math.min(r(pos(d.collegeSavings)), joint ? 12000 : 6000)
  S['B18'] = r(pos(d.healthPremiums))
  S['B19'] = r(pos(d.longTermCarePremiums))
  S['B23'] = r(pos(d.otherSubtractions))
  S['B24'] = ['B2', 'B3', 'B6', 'B7', 'B8f', 'B14', 'B18', 'B19', 'B23'].reduce((s, k) => s + S[k], 0)

  // ── Income ──
  L['7'] = r(f['11a'])
  L['8'] = S['A7']
  L['9'] = L['7'] + L['8']
  L['10'] = S['B24']
  L['11'] = L['9'] - L['10']

  // ── Deductions ──
  const old: Record<Owner, boolean> = { taxpayer: isOld('taxpayer'), spouse: joint && isOld('spouse') }
  const blind: Record<Owner, boolean> = { taxpayer: ret.taxpayer.blind, spouse: joint && ret.spouse.blind }
  const boxCount = owners.reduce((s, o) => s + (old[o] ? 1 : 0) + (blind[o] ? 1 : 0), 0)
  let standard = ID_STANDARD[fs]
  if (dependentFiler) standard = Math.min(standard, Math.max(1350, earnedOf('taxpayer') + 450))
  standard += boxCount * (fs === 'single' || fs === 'hoh' ? 2000 : 1600)
  const itemizedFederally = res.deduction.used === 'itemized'
  const it = ret.itemized
  const capFloor = fs === 'mfs' ? 20000 : 40000
  const sa = res.scheduleA
  L['13'] = itemizedFederally ? r(sa.total) : 0
  L['14'] = itemizedFederally ? (sa.saltBeforeCap <= capFloor ? r(pos(it.stateLocalIncomeOrSalesTax)) : r(pos(Math.min(sa.saltBeforeCap, sa.saltCap) - pos(it.realEstateTax) - pos(it.personalPropertyTax)))) : 0
  L['15'] = pos(L['13'] - L['14'])
  L['16'] = fs === 'mfs' && itemizedFederally ? 0 : standard
  const itemize = L['15'] > L['16']
  L['17'] = pos(L['11'] - Math.max(L['15'], L['16']))
  L['18'] = r(pos(f['13a'] ?? 0) + pos(f['13b'] ?? 0))
  L['19'] = pos(L['17'] - L['18'])
  L['20'] = idTax(L['19'], fs)

  // ── Credits ──
  const os = d.otherState
  if (os.tax > 0 && os.income > 0) {
    S['C1'] = L['20']
    S['C2'] = r(pos(os.income))
    S['C3'] = L['11']
    S['C4'] = S['C3'] > 0 ? Math.min(1, S['C2'] / S['C3']) : 0
    S['C5'] = r(S['C1'] * S['C4'])
    S['C6'] = r(pos(os.tax))
    S['C7'] = Math.min(S['C5'], S['C6'])
  } else S['C7'] = 0
  L['21'] = Math.min(S['C7'], L['20'])
  S['D4'] = r(pos(d.partDCredits))
  L['22'] = Math.min(S['D4'], L['20'] - L['21'])
  L['23'] = 0
  const qualifyingChildren = dependentFiler ? 0 : ret.dependents.filter((x) => x.childRelationship && x.age <= 16 && x.monthsLivedWithYou > 6).length
  L['24'] = Math.min(qualifyingChildren * ID_CHILD_CREDIT, pos(L['20'] - L['21'] - L['22'] - L['23']))
  L['25'] = L['21'] + L['22'] + L['23'] + L['24']
  L['26'] = pos(L['20'] - L['25'])

  // ── Other taxes ──
  const grossIncome = r(pos(f['9'] - f['6b']))
  const olds = owners.filter((o) => old[o]).length
  const pbfWaived = d.publicAssistance || blind.taxpayer || blind.spouse || (dependentFiler ? grossIncome <= standard : grossIncome < idFilingThreshold(fs, olds))
  L['27'] = 0
  L['28'] = r(pos(d.useTax))
  L['29'] = 0
  L['30'] = 0
  L['31'] = pbfWaived ? 0 : 10
  L['32'] = L['26'] + L['27'] + L['28'] + L['29'] + L['30'] + L['31']
  for (const k of ['33', '34', '35', '36', '37', '38', '39', '40']) L[k] = r(pos(d.donations[k] ?? 0))
  L['41'] = ['32', '33', '34', '35', '36', '37', '38', '39', '40'].reduce((s, k) => s + L[k], 0)

  // ── Payments and other credits ──
  L['42'] = r(pos(d.parentalChoice))
  const food = { taxpayer: dependentFiler ? 0 : ID_FOOD_CREDIT, spouse: joint && !dependentFiler ? ID_FOOD_CREDIT : 0, dependents: dependentFiler ? 0 : ret.dependents.length * ID_FOOD_CREDIT }
  L['43calc'] = food.taxpayer + food.spouse + food.dependents
  L['43'] = d.donateFoodCredit ? 0 : L['43calc']
  S['E4'] = Math.min(3, d.homeMembers.length) * 100
  L['44'] = S['E4']
  L['45'] = 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['46'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0) + pos(d.withholdingOther))
  L['47'] = r(pos(d.estimatedPayments))
  L['48'] = r(pos(d.passThrough))
  L['49'] = 0
  L['50'] = ['42', '43', '44', '45', '46', '47', '48', '49'].reduce((s, k) => s + L[k], 0)

  // ── Tax due or refund ──
  L['51'] = pos(L['41'] - L['50'])
  L['52'] = 0
  L['53'] = 0
  L['54'] = L['51']
  L['55'] = pos(L['50'] - L['41'] - L['52'])
  L['56applied'] = Math.min(L['55'], r(pos(d.creditForward)))
  L['56'] = L['55'] - L['56applied']

  // ── Notes ──
  if (S['A7'] + S['B24'] > 0 || L['21'] + L['22'] > 0 || S['E4'] > 0 || ret.dependents.length > 4) attach.push('Form 39R (resident supplemental schedule)')
  attach.push('A complete copy of your federal return')
  if (L['46'] > 0) attach.push('State copies of your W-2s and 1099s with Idaho withholding')
  if (L['21'] > 0) attach.push(`A copy of your ${os.name.trim() || 'other state'} return (credit for tax paid to another state)`)
  if (S['B6'] > 0) attach.push('Federal Form 2441')
  if (S['B8f'] > 0) attach.push('Your 1099-Rs for the retirement benefits deduction')
  if (L['48'] > 0) attach.push('Forms ID K-1')
  if (itemize) issues.push('Idaho itemized deductions are your federal Schedule A total less state and local income or sales taxes (line 14); include federal Schedule A.')
  if (itemize && S['B18'] + S['B19'] > 0 && sa.medical > 0) issues.push('You itemize and deducted medical expenses: reduce the health / long-term care premium subtraction with the worksheet on page 35 of the Form 39R instructions.')
  if (pbfWaived && !d.publicAssistance) issues.push('No $10 permanent building fund tax applies to you (blind, or income under the filing requirement): draw a line through the preprinted $10 on line 31.')
  if (d.publicAssistance) issues.push('Line 31: draw a line through the preprinted $10 (you received Idaho public assistance).')
  if (L['43'] > 0 && ret.dependents.some((x) => x.monthsLivedWithYou < 12)) issues.push('The food tax credit is $12.92 per qualified month: a dependent who wasn’t an Idaho resident all year, received food stamps or was incarcerated gets less.')
  if (ret.dependents.some((x) => !(d.dependentBirthDates[x.id] ?? '').trim())) issues.push('Enter each dependent’s birthdate (line 6c asks for it).')
  if (L['51'] > 0) issues.push('If you owe more than a small amount and paid no estimated tax, Idaho may add a penalty and interest (line 52); see tax.idaho.gov/penalties.')
  if (S['B14'] < r(pos(d.collegeSavings))) issues.push('The IDeal college savings subtraction is limited to $6,000 ($12,000 joint).')
  return { lines: L, s39: S, household, boxes: { old, blind, dependent: dependentFiler }, food, qualifyingChildren, itemize, pbfWaived, issues, attach }
}
