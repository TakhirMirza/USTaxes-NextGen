/**
 * Indiana Form IT-40, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 IT-40 (R24 / 9-25), Schedules 1–7, IN-DEP and the IT-40 booklet (12-25): state tax 3.0% of Indiana
 * AGI (line 8); county tax at the rate of the county you lived in on January 1 (Schedule CT-40, rates in
 * inCounties2025.ts); deductions for rent (up to $3,000), homeowner’s property tax (up to $2,500), state tax refund,
 * U.S. interest, taxable Social Security, active military pay and $1,000 per private school or homeschooled child
 * (Schedule 2); exemptions of $1,000 per filer and dependent, $1,500 per dependent child (and again the first year
 * claimed), $1,000 for 65 or older and for blindness, $500 more at 65 with income under $40,000, and $3,000 per
 * adopted child (Schedule 3); the unified tax credit for the elderly (Tables A and B) and Indiana EIC at 10% of the
 * federal credit when income is under $68,650 (Schedule 5). Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { IN_COUNTIES } from './inCounties2025.ts'

export const IN_RATE = 0.03
const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Schedule 5 line 5: unified tax credit for the elderly. */
export function inElderlyCredit(fagi: number, bothOld: boolean): number {
  if (fagi >= 10000) return 0
  if (fagi < 1000) return bothOld ? 140 : 100
  if (fagi < 3000) return bothOld ? 90 : 50
  return bothOld ? 80 : 40
}

/** A county code’s rate (Schedule CT-40 chart), or undefined if unknown. */
export function inCountyRate(code: string): number | undefined {
  return IN_COUNTIES[code.trim().padStart(2, '0')]?.rate
}

export interface InDependentRow { first: string; last: string; ssn: string; age: number; child: boolean; firstTime: boolean }

export interface InResult {
  lines: Record<string, number>
  s1: Record<string, number>
  s2: Record<string, number>
  s3: Record<string, number>
  s5: Record<string, number>
  s6: Record<string, number>
  county: { codeA: string; rateA: number; incomeA: number; codeB: string; rateB: number; incomeB: number; tax: number }
  dependents: InDependentRow[]
  boxes: { age65: Owner[]; blind: Owner[]; extra65: Owner[] }
  statements: { owner: Owner; employer: string; ein: string; stateId: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeIndiana(ret: TaxReturnInput, res: TaxReturnResult): InResult {
  const d = ret.in
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const mfs = fs === 'mfs'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const S1: Record<string, number> = {}
  const S2: Record<string, number> = {}
  const S3: Record<string, number> = {}
  const S5: Record<string, number> = {}
  const S6: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])

  // ── Schedule 1: add-backs ──
  S1['3'] = r(pos(d.otherStateBondInterest))
  S1['6a'] = r(pos(d.otherAddBacks))
  S1['7'] = S1['3'] + S1['6a']
  // ── Schedule 2: deductions ──
  S2['rent'] = r(pos(d.rentPaid))
  S2['1'] = Math.min(S2['rent'], mfs ? 1500 : 3000)
  S2['tax'] = r(pos(d.propertyTax))
  S2['2'] = Math.min(S2['tax'], mfs ? 1250 : 2500)
  S2['3'] = r(pos(d.stateRefundInFagi))
  S2['4'] = r(pos(d.usObligationInterest))
  S2['5'] = r(pos(f['6b']))
  S2['7'] = r(pos(d.activeMilitaryPay))
  S2['8'] = Math.max(0, Math.floor(d.privateSchoolChildren)) * 1000
  S2['11a'] = r(pos(d.otherDeductions))
  S2['12'] = S2['1'] + S2['2'] + S2['3'] + S2['4'] + S2['5'] + S2['7'] + S2['8'] + S2['11a']

  // ── Schedule 3 and IN-DEP: exemptions ──
  const dependents: InDependentRow[] = ret.canBeClaimedAsDependent ? [] : ret.dependents.map((x) => {
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    const child = x.childRelationship && /son|daughter|child|step|foster|guardian/i.test(x.relationship || 'child') && (x.age < 19 || (x.student && x.age < 24))
    return { first: parts.join(' '), last, ssn: x.ssn, age: x.age, child, firstTime: false }
  })
  let firstLeft = Math.max(0, Math.floor(d.firstTimeChildren))
  for (const x of dependents) if (x.child && firstLeft > 0) { x.firstTime = true; firstLeft-- }
  const people = owners.map((o) => ({ o, p: o === 'taxpayer' ? ret.taxpayer : ret.spouse }))
  const age65 = people.filter(({ p }) => p.age65OrOlder || p.age >= 65).map(({ o }) => o)
  const blind = people.filter(({ p }) => p.blind).map(({ o }) => o)
  const extra65 = fagi < (mfs ? 20000 : 40000) ? age65 : []
  S3['1'] = ret.canBeClaimedAsDependent ? 0 : joint ? 2000 : 1000
  S3['box5'] = dependents.length
  S3['2'] = dependents.length * 1000
  S3['box6'] = dependents.filter((x) => x.child).length + dependents.filter((x) => x.firstTime).length
  S3['3'] = S3['box6'] * 1500
  S3['4n'] = age65.length + blind.length
  S3['4'] = S3['4n'] * 1000
  S3['5n'] = extra65.length
  S3['5'] = S3['5n'] * 500
  S3['6n'] = Math.max(0, Math.floor(d.adoptedChildren))
  S3['6'] = S3['6n'] * 3000
  S3['7'] = S3['1'] + S3['2'] + S3['3'] + S3['4'] + S3['5'] + S3['6']

  // ── IT-40 lines 1–11 ──
  L['1'] = fagi
  L['2'] = S1['7']
  L['3'] = L['1'] + L['2']
  L['4'] = S2['12']
  L['5'] = L['3'] - L['4']
  L['6'] = S3['7']
  L['7'] = L['5'] - L['6']
  L['8'] = L['7'] > 0 ? r(L['7'] * IN_RATE) : 0
  // County tax (Schedule CT-40): the rate of the county each person lived in on January 1.
  const codeA = d.countyLived.taxpayer.trim().padStart(2, '0')
  const codeB = joint ? d.countyLived.spouse.trim().padStart(2, '0') : ''
  const rateA = inCountyRate(codeA) ?? 0
  const sameCounty = !joint || !d.countyLived.spouse.trim() || codeB === codeA
  const rateB = sameCounty ? 0 : inCountyRate(codeB) ?? 0
  let incomeA = pos(L['7'])
  let incomeB = 0
  if (!sameCounty) {
    // Split by each spouse’s W-2 wages; each keeps a $1,000 personal exemption and the higher-rate spouse takes the dependents’.
    const wa = ret.w2s.filter((w) => w.owner === 'taxpayer').reduce((s, w) => s + w.wages, 0)
    const wb = ret.w2s.filter((w) => w.owner === 'spouse').reduce((s, w) => s + w.wages, 0)
    const share = wa + wb > 0 ? wa / (wa + wb) : 0.5
    const before = L['5']
    const depEx = S3['2'] + S3['3'] + S3['6']
    const exA = 1000 + (age65.includes('taxpayer') ? 1000 : 0) + (blind.includes('taxpayer') ? 1000 : 0) + (extra65.includes('taxpayer') ? 500 : 0) + (rateA >= rateB ? depEx : 0)
    const exB = S3['7'] - exA
    incomeA = r(before * share - exA)
    incomeB = r(before * (1 - share) - exB)
    if (incomeA < 0) { incomeB += incomeA; incomeA = 0 }
    if (incomeB < 0) { incomeA += incomeB; incomeB = 0 }
    incomeA = pos(incomeA); incomeB = pos(incomeB)
  }
  const countyTax = r(incomeA * rateA + incomeB * rateB)
  L['9'] = countyTax
  L['10'] = r(pos(d.useTax))
  L['11'] = L['8'] + L['9'] + L['10']

  // ── Schedule 5: credits ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  S5['1'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.withholding1099))
  S5['2'] = r(pos(d.countyWithheld))
  S5['4'] = r(pos(d.estimatedPayments))
  S5['5'] = age65.length > 0 && !ret.canBeClaimedAsDependent ? inElderlyCredit(fagi, joint && age65.length === 2) : 0
  S5['6'] = fagi < 68650 ? r(pos(f['27a']) * 0.1) : 0
  S5['11'] = r(pos(d.refundableCredits))
  S5['13'] = S5['1'] + S5['2'] + S5['4'] + S5['5'] + S5['6'] + S5['11']
  // ── Schedule 6: offset credits (limited to the county tax and the state tax) ──
  S6['5'] = r(pos(d.otherStateCredit))
  S6['4'] = r(pos(d.collegeCredit))
  S6['6a'] = r(pos(d.offsetCredits))
  const stateSide = Math.min(S6['4'] + S6['5'] + S6['6a'], L['8'])
  S6['8'] = stateSide
  L['12'] = S5['13']
  L['13'] = S6['8']
  L['14'] = L['12'] + L['13']
  L['15'] = L['11']
  L['16'] = pos(L['14'] - L['15'])
  L['17'] = Math.min(r(pos(d.donations)), L['16'])
  L['18'] = L['16'] - L['17']
  L['19c'] = Math.min(r(pos(d.creditForward)), L['18'])
  L['19d'] = L['19c']
  L['20'] = 0
  L['21'] = pos(L['18'] - L['19d'] - L['20'])
  L['23'] = pos(L['15'] - L['14'])
  L['26'] = L['23']

  // ── Notes ──
  attach.push('Schedule CT-40 (county tax) with your principal residence address on January 1, 2025')
  attach.push('Schedule 7 (additional information and signature authorization)')
  if (S5['6'] > 0) attach.push('Schedule IN-EIC (Indiana earned income credit)')
  if (S3['6'] > 0) attach.push('Schedule IN-DEP-A (adopted dependents)')
  if (S5['1'] + S5['2'] > 0) attach.push('W-2s, 1099s and other statements showing Indiana state and county tax withheld')
  if (S6['5'] > 0) attach.push('A copy of the other state’s return (credit for taxes paid to other states)')
  if (!codeA.trim() || codeA === '00') issues.push('Enter the two-digit code of the county you lived in on January 1, 2025 (back of Schedule CT-40); the county tax depends on it.')
  else if (inCountyRate(codeA) === undefined) issues.push(`County code ${codeA} is not on the 2025 county tax rate chart.`)
  if (!sameCounty) issues.push('You and your spouse lived in different counties on January 1: the county tax splits line 7 between you by wages. Check Schedule CT-40 lines 1A and 1B.')
  if (S2['1'] === 0 && S2['2'] === 0) issues.push('If you rented or paid property tax on your Indiana home, enter it: rent up to $3,000 and property tax up to $2,500 are deductible.')
  if (dependents.some((x) => x.child)) issues.push('If a dependent child is claimed for the additional child exemption for the first time, it counts twice (Schedule IN-DEP box F): enter how many.')
  if (S5['2'] === 0 && L['9'] > 0) issues.push('Enter county tax withheld from your W-2s (box 19) so it counts as a payment.')
  if (dependents.length > 0) issues.push('Schedule IN-DEP asks for each dependent’s date of birth: write it in after printing.')
  if (L['26'] > 1000 && L['12'] === 0) issues.push('A balance due over $1,000 may mean an estimated tax penalty (Schedule IT-2210).')

  return {
    lines: L, s1: S1, s2: S2, s3: S3, s5: S5, s6: S6,
    county: { codeA, rateA, incomeA, codeB: sameCounty ? '' : codeB, rateB, incomeB, tax: countyTax },
    dependents, boxes: { age65, blind, extra65 }, statements, issues, attach
  }
}
