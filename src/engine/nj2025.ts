/**
 * New Jersey Form NJ-1040, full-year resident income tax return, tax year 2025.
 *
 * Source: 2025 NJ-1040 and its instructions. New Jersey does not start from federal AGI: income is reported
 * by category (lines 15–26), a loss in one category does not reduce another, and Social Security and
 * unemployment are not taxed. Exemptions ($1,000 regular, 65+ and blind/disabled; $6,000 veteran; $1,500 per
 * dependent; $1,000 per college student), the pension exclusion (line 28a) and Worksheet D, medical expenses
 * over 2% of NJ gross income, the Property Tax Deduction (up to $15,000) or $50 credit (Worksheet H), the tax
 * table / rate schedules, NJEITC (40% of federal, or $260 under the expanded age rule), the child and dependent
 * care credit (Worksheet J) and the NJ Child Tax Credit for children 5 or younger.
 *
 * Tax: the 2025 Tax Table is the rate schedule applied to the midpoint of each $50 band, rounded. The printed
 * schedule for joint filers between $70,000 and $80,000 subtracts $1,154.50, but every row of the Tax Table
 * (and continuity with the neighbouring brackets) requires $1,155.00, which is used here.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { k1Activity } from './k1.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

const SINGLE: [number, number, number][] = [[20000, 0.014, 0], [35000, 0.0175, 70], [40000, 0.035, 682.5], [75000, 0.05525, 1492.5], [500000, 0.0637, 2126.25], [1000000, 0.0897, 15126.25], [Infinity, 0.1075, 32926.25]]
const JOINT: [number, number, number][] = [[20000, 0.014, 0], [50000, 0.0175, 70], [70000, 0.0245, 420], [80000, 0.035, 1155], [150000, 0.05525, 2775], [500000, 0.0637, 4042.5], [1000000, 0.0897, 17042.5], [Infinity, 0.1075, 34842.5]]
export const NJ_DONATION_LINES = ['70', '71', '72', '73', '74'] as const

const usesJoint = (fs: TaxReturnInput['filingStatus']): boolean => fs === 'mfj' || fs === 'hoh' || fs === 'qss'

/** Tax rate schedule (Table A single/separate, Table B joint/head of household/surviving spouse). */
export function njSchedule(x: number, joint: boolean): number {
  for (const [lim, rate, sub] of joint ? JOINT : SINGLE) if (x <= lim) return x * rate - sub
  return 0
}

/** Line 43: Tax Table under $100,000 ($50 bands, midpoint), rate schedules above. */
export function njTax(income: number, fs: TaxReturnInput['filingStatus']): number {
  const x = pos(Math.floor(income))
  const joint = usesJoint(fs)
  if (x < 100000) return r(pos(njSchedule(Math.floor(x / 50) * 50 + 25, joint)))
  return r(njSchedule(x, joint))
}

/** Line 28a chart and Worksheet D: maximum pension exclusion by filing status and line 27 income. */
export function njMaxExclusion(fs: TaxReturnInput['filingStatus'], income: number, base: number): number {
  const tier = income <= 100000 ? 0 : income <= 125000 ? 1 : income <= 150000 ? 2 : 3
  if (tier === 3) return 0
  const full = fs === 'mfj' ? 100000 : fs === 'mfs' ? 50000 : 75000
  if (tier === 0) return full
  const pct = (fs === 'mfj' ? [0.5, 0.25] : fs === 'mfs' ? [0.25, 0.125] : [0.375, 0.1875])[tier - 1]
  return r(base * pct)
}

/** Worksheet J percentage by NJ taxable income. */
export function njCarePercent(taxable: number): number {
  if (taxable <= 30000) return 0.5
  if (taxable <= 60000) return 0.4
  if (taxable <= 90000) return 0.3
  if (taxable <= 120000) return 0.2
  if (taxable <= 150000) return 0.1
  return 0
}

/** NJ Child Tax Credit per child 5 or younger, by NJ taxable income. */
export function njChildCreditPer(taxable: number): number {
  if (taxable <= 30000) return 1000
  if (taxable <= 40000) return 800
  if (taxable <= 50000) return 600
  if (taxable <= 60000) return 400
  if (taxable <= 80000) return 200
  return 0
}

export interface NjResult {
  lines: Record<string, number>
  exemptions: Record<string, { count: number; amount: number }>
  propertyTax: { eligible: boolean; method: 'deduction' | 'credit' | 'none'; deduction: number; benefit: number }
  pensionExclusion: { qualifies: boolean; maximum: number; otherQualifies: boolean }
  childCredit: { children: number; per: number }
  statements: { owner: Owner; employer: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeNewJersey(ret: TaxReturnInput, res: TaxReturnResult): NjResult {
  const d = ret.nj
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const person = (o: Owner): TaxReturnInput['taxpayer'] => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const age = (o: Owner): number => person(o).age || (person(o).age65OrOlder ? 65 : 0)

  // ── Exemptions (lines 6–13) ──
  const children = ret.dependents.filter((x) => x.childRelationship)
  const ex: Record<string, { count: number; amount: number }> = {
    '6': { count: owners.length, amount: owners.length * 1000 },
    '7': { count: owners.filter((o) => age(o) >= 65).length, amount: 0 },
    '8': { count: owners.filter((o) => person(o).blind || d.disabled[o]).length, amount: 0 },
    '9': { count: owners.filter((o) => d.veteran[o]).length, amount: 0 },
    '10': { count: children.length, amount: 0 },
    '11': { count: ret.dependents.length - children.length, amount: 0 },
    '12': { count: Math.min(Math.max(0, Math.floor(d.collegeDependents)), ret.dependents.length), amount: 0 }
  }
  ex['7'].amount = ex['7'].count * 1000
  ex['8'].amount = ex['8'].count * 1000
  ex['9'].amount = ex['9'].count * 6000
  ex['10'].amount = ex['10'].count * 1500
  ex['11'].amount = ex['11'].count * 1500
  ex['12'].amount = ex['12'].count * 1000
  L['13'] = Object.values(ex).reduce((s, x) => s + x.amount, 0)

  // ── Income by category (lines 15–27) ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  L['15'] = statements.reduce((s, x) => s + x.wages, 0)
  L['16a'] = r(pos(f['2b'] - pos(d.usObligationInterest) + pos(d.otherStateBondInterest)))
  L['16b'] = r(pos(f['2a'] - pos(d.otherStateBondInterest)) + pos(d.usObligationInterest))
  L['17'] = r(pos(f['3b']))
  L['18'] = r(pos(res.scheduleC.filter((c) => owners.includes(c.owner)).reduce((s, c) => s + c.netProfit, 0)))
  L['19'] = r(pos(res.scheduleD.net + ret.capitalLossCarryover.shortTerm + ret.capitalLossCarryover.longTerm))
  const retirements = ret.retirement.filter((x) => owners.includes(x.owner))
  const rollover = (code: string): boolean => /^[GH]/i.test(code.trim())
  const taxableBy = (o: Owner | null): number => retirements.filter((x) => o === null || x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0)
  L['20a'] = r(d.pensionTaxable ?? taxableBy(null))
  L['20b'] = r(d.pensionExcludable ?? retirements.filter((x) => !rollover(x.code)).reduce((s, x) => s + pos(x.grossDistribution - x.taxableAmount), 0))
  const k1s = ret.k1s.filter((k) => owners.includes(k.owner))
  L['21'] = r(pos(k1s.filter((k) => k.kind === 'partnership').reduce((s, k) => s + k1Activity(k) + k.guaranteedPayments, 0)))
  L['22'] = r(pos(k1s.filter((k) => k.kind === 'scorp').reduce((s, k) => s + k1Activity(k), 0)))
  L['23'] = r(pos(res.scheduleE.net))
  L['24'] = r(pos(d.gamblingWinnings))
  L['25'] = r(pos(d.alimonyReceived))
  L['26'] = r(pos(d.otherIncome))
  L['27'] = L['15'] + L['16a'] + L['17'] + L['18'] + L['19'] + L['20a'] + L['21'] + L['22'] + L['23'] + L['24'] + L['25'] + L['26']

  // ── Pension exclusion (28a) and other retirement income exclusion (Worksheet D, 28b) ──
  const qualifiers = owners.filter((o) => age(o) >= 62 || person(o).blind || d.disabled[o])
  const qualifies = qualifiers.length > 0 && L['27'] <= 150000
  const lineA = d.pensionTaxable !== null ? (qualifies ? L['20a'] : 0) : r(qualifiers.reduce((s, o) => s + taxableBy(o), 0))
  const maximum = qualifies ? njMaxExclusion(fs, L['27'], L['20a']) : 0
  L['28a'] = qualifies ? Math.min(lineA, maximum) : 0
  const over62 = owners.some((o) => age(o) >= 62)
  const earned = L['15'] + L['18'] + L['21'] + L['22']
  let otherQualifies = false
  L['28b'] = 0
  if (over62 && L['27'] <= 150000) {
    const unclaimed = pos(njMaxExclusion(fs, L['27'], L['27']) - L['28a'])
    if (unclaimed > 0 && earned <= 3000) {
      otherQualifies = true
      L['28b'] = Math.min(unclaimed, pos(L['27'] - L['28a']))
    }
  }
  L['28c'] = L['28a'] + L['28b']
  L['29'] = pos(L['27'] - L['28c'])

  // ── Exemptions and deductions (30–39) ──
  L['30'] = L['13']
  L['31'] = r(pos(pos(d.medicalExpenses) - L['29'] * 0.02))
  L['32'] = r(pos(d.alimonyPaid))
  L['38'] = L['30'] + L['31'] + L['32']
  L['39'] = pos(L['29'] - L['38'])

  // ── Property Tax Deduction or Credit (40a, 41, 56; Worksheet H) ──
  const sameHome = fs === 'mfs'
  const own = d.housing === 'own' || d.housing === 'both'
  const rent = d.housing === 'rent' || d.housing === 'both'
  const paid = r((own ? pos(d.propertyTax) : 0) + (rent ? pos(d.rentPaid) * 0.18 : 0))
  L['40a'] = sameHome ? r(paid / 2) : paid
  const seniorOrDisabled = owners.some((o) => age(o) >= 65 || person(o).blind || d.disabled[o])
  const threshold = fs === 'single' || fs === 'mfs' ? 10000 : 20000
  const eligible = d.housing !== 'none' && L['40a'] > 0
  const ded = Math.min(L['40a'], sameHome ? 7500 : 15000)
  const creditAmount = sameHome ? 25 : 50
  const saved = njTax(L['39'], fs) - njTax(pos(L['39'] - ded), fs)
  let method: 'deduction' | 'credit' | 'none' = 'none'
  if (eligible) method = saved >= creditAmount ? 'deduction' : (L['29'] > threshold || seniorOrDisabled ? 'credit' : 'none')
  L['41'] = method === 'deduction' ? ded : 0
  L['42'] = pos(L['39'] - L['41'])
  L['43'] = njTax(L['42'], fs)
  L['44'] = Math.min(r(pos(d.otherJurisdictionCredit)), L['43'])
  L['45'] = L['43'] - L['44']
  L['49'] = 0
  L['50'] = pos(L['45'] - L['49'])
  L['51'] = r(pos(d.useTax))
  L['52'] = 0
  L['53c'] = 0
  L['54'] = L['50'] + L['51'] + L['52'] + L['53c']

  // ── Withholding, payments and refundable credits (55–66) ──
  L['55'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.otherWithholding))
  L['56'] = method === 'credit' ? creditAmount : 0
  L['57'] = r(pos(d.estimatedPayments))
  const fedEic = r(pos(res.eic.credit))
  const reasons = res.eic.notEligibleBecause
  const ageOnly = reasons.length > 0 && reasons.every((x) => x.startsWith('without a qualifying child'))
  if (fedEic > 0) L['58'] = fs === 'mfs' && res.eic.qualifyingChildren === 0 ? 0 : r(fedEic * 0.4)
  else L['58'] = ageOnly && !ret.canBeClaimedAsDependent && res.eic.earnedIncome > 0 && owners.some((o) => age(o) >= 18) && fs !== 'mfs' ? 260 : 0
  L['64'] = r(pos(res.schedule3.dependentCare) * njCarePercent(L['42']))
  const young = ret.dependents.filter((x) => x.age <= 5).length
  const per = fs === 'mfs' ? 0 : njChildCreditPer(L['42'])
  L['65count'] = young
  L['65'] = young * per
  L['66'] = L['55'] + L['56'] + L['57'] + L['58'] + L['64'] + L['65']
  L['67'] = pos(L['54'] - L['66'])
  L['68'] = pos(L['66'] - L['54'])
  L['69'] = Math.min(r(pos(d.creditForward)), L['68'])
  for (const k of NJ_DONATION_LINES) L[k] = r(pos(d.donations[k] ?? 0))
  L['78'] = L['69'] + NJ_DONATION_LINES.reduce((s, k) => s + L[k], 0)
  L['79'] = L['67'] > 0 ? L['67'] + L['78'] : L['68'] < L['78'] ? L['78'] - L['68'] : 0
  L['80'] = L['68'] > 0 ? pos(L['68'] - L['78']) : 0

  // ── Notes ──
  if (L['18'] > 0 || L['21'] > 0 || L['22'] > 0 || L['23'] > 0) attach.push('Schedule NJ-BUS-1 (business, partnership, S corporation and rental income) with the federal schedules')
  if (L['19'] > 0 || res.scheduleD.net !== 0) attach.push('Schedule NJ-DOP (net gains from disposition of property)')
  if (L['16a'] > 1500) attach.push('Copy of federal Schedule B (interest over $1,500)')
  if (L['55'] > 0) attach.push('W-2s and 1099s showing NJ tax withheld')
  if (L['44'] > 0) attach.push('Schedule NJ-COJ and a copy of the other jurisdiction’s return')
  if (L['64'] > 0) attach.push('Copy of federal Form 2441')
  if (d.missingCoverage) attach.push('Schedule NJ-HCC (health coverage) and the NJ-EZ Enroll form')
  if (ex['7'].count > 0) issues.push('Senior 65+ exemption: enclose proof of age (birth certificate or driver’s license) the first time you claim it.')
  if (ex['9'].count > 0) issues.push('Veteran exemption: provide your discharge documentation (DD-214) the first time you claim it.')
  if (L['20a'] > 0 && d.pensionTaxable === null) issues.push('Line 20a uses the federal taxable amount. New Jersey taxes contributory pensions differently (Worksheets A–C): if you contributed after-tax money that NJ already taxed, enter your NJ figures.')
  if (L['28a'] > 0) issues.push(`Pension exclusion: ${L['28a'].toLocaleString('en-US')} of retirement income is excluded (maximum ${maximum.toLocaleString('en-US')}).`)
  if (otherQualifies) issues.push(`Other retirement income exclusion (Worksheet D): ${L['28b'].toLocaleString('en-US')}.`)
  if (method === 'deduction') issues.push(`Property Tax Deduction of $${L['41'].toLocaleString('en-US')} saves $${saved} — more than the $${creditAmount} credit.`)
  if (method === 'credit') issues.push(`The $${creditAmount} Property Tax Credit is better for you than the deduction.`)
  if (sameHome && eligible) issues.push('Married filing separately: half of the property taxes and the $7,500 limit are used, assuming you and your spouse share the same main home.')
  if (d.housing !== 'none' && eligible) issues.push('Homeowners and renters may also qualify for ANCHOR and Stay NJ benefits, applied for separately.')
  if (L['44'] > 0 && method === 'deduction') issues.push('You claim a credit for taxes paid to other jurisdictions: NJ requires Schedule NJ-COJ and Worksheet I to decide the property tax deduction; check the result.')
  if (res.scheduleD.net < 0) issues.push('Capital losses cannot reduce other New Jersey income and are not carried forward.')
  if (res.schedule1.unemployment > 0 || f['6b'] > 0) issues.push('Social Security and unemployment benefits are not taxed in New Jersey.')
  if (d.missingCoverage) issues.push('Line 53c: figure the shared responsibility payment on Schedule NJ-HCC (Worksheet L) and enter it yourself.')

  return {
    lines: L, exemptions: ex,
    propertyTax: { eligible, method, deduction: ded, benefit: saved },
    pensionExclusion: { qualifies, maximum, otherQualifies },
    childCredit: { children: young, per },
    statements, issues, attach
  }
}
