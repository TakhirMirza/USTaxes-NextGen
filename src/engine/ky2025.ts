/**
 * Kentucky Form 740, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form 740 (42A740 10-25) and the 2025 Form 740 instructions packet: federal AGI with the Schedule M
 * modifications (other states’ bond interest added; U.S. government interest, the pension income exclusion of up to
 * $31,110 per person, taxable Social Security and active duty military pay subtracted); the $3,270 standard
 * deduction or Kentucky Schedule A (mortgage and investment interest, gifts, gambling losses and other miscellaneous
 * deductions only); a flat 4% tax; personal tax credits ($40 at 65 or blind, $20 Kentucky National Guard); the Family
 * Size Tax Credit (100% down to 10% of tax as modified gross income rises from 100% to 133% of the 2025 thresholds
 * $15,650 / $21,150 / $26,650 / $32,150) and 20% of the federal child and dependent care credit. Married couples who
 * both had income file separately on a combined return (status 2): each spouse’s income and deductions in their own
 * column. Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const KY_RATE = 0.04
export const KY_STANDARD = 3270
export const KY_PENSION_EXCLUSION = 31110
export const KY_FAMILY_THRESHOLDS = [15650, 21150, 26650, 32150]

/** Family Size Tax Table: the share of tax (line 21 decimal) for a family size (1–4) and modified gross income. */
export function kyFamilyCreditRate(size: number, mgi: number): number {
  const t = KY_FAMILY_THRESHOLDS[Math.min(4, Math.max(1, size)) - 1]
  if (mgi <= t) return 1
  const steps: [number, number][] = [[1.04, 0.9], [1.08, 0.8], [1.12, 0.7], [1.16, 0.6], [1.2, 0.5], [1.24, 0.4], [1.28, 0.3], [1.32, 0.2], [1.33, 0.1]]
  for (const [pct, rate] of steps) if (mgi <= r(t * pct)) return rate
  return 0
}

export type KyStatus = 'single' | 'combined' | 'joint' | 'separate'

export interface KyResult {
  status: KyStatus
  /** Lines with two columns: A (spouse) and B (yourself, or joint). */
  colA: Record<string, number>
  colB: Record<string, number>
  lines: Record<string, number>
  schM: Record<'A' | 'B', Record<string, number>>
  itemize: boolean
  itemized: number
  familySize: number
  mgi: number
  familyRate: number
  issues: string[]
  attach: string[]
}

export function computeKentucky(ret: TaxReturnInput, res: TaxReturnResult): KyResult {
  const d = ret.ky
  const f = res.f1040
  const fs = ret.filingStatus
  const married = fs === 'mfj'
  const issues: string[] = []
  const attach: string[] = []
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const agi = r(f['11a'])

  // ── What each spouse brought in (status 2) ──
  const earnedBy = (o: Owner): number => ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0)
    + res.scheduleC.filter((x) => x.owner === o).reduce((s, x) => s + x.netProfit, 0) - res.scheduleSE.filter((x) => x.owner === o).reduce((s, x) => s + x.total / 2, 0)
  const retirementBy = (o: Owner): number => ret.retirement.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0)
  const ssGross = ret.socialSecurity.reduce((s, x) => s + pos(x.netBenefits), 0)
  const ssShare = (o: Owner): number => (ssGross > 0 ? ret.socialSecurity.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.netBenefits), 0) / ssGross : o === 'taxpayer' ? 1 : 0)
  const own = (o: Owner): number => earnedBy(o) + retirementBy(o) + f['6b'] * ssShare(o)
  const status: KyStatus = fs === 'mfs' ? 'separate' : !married ? 'single' : !d.forceJoint && own('spouse') > 0 && own('taxpayer') > 0 ? 'combined' : 'joint'
  const twoCols = status === 'combined'
  const shared = agi - own('taxpayer') - own('spouse')
  const agiA = twoCols ? r(own('spouse') + shared / 2) : 0
  const A: Record<string, number> = {}
  const B: Record<string, number> = {}
  A['5'] = agiA
  B['5'] = agi - agiA

  // ── Schedule M ──
  const M: Record<'A' | 'B', Record<string, number>> = { A: {}, B: {} }
  const split = (n: number): [number, number] => (twoCols ? [r(n / 2), r(n) - r(n / 2)] : [0, r(n)])
  const cols: ['A' | 'B', Owner[]][] = twoCols ? [['A', ['spouse']], ['B', ['taxpayer']]] : [['B', married ? ['taxpayer', 'spouse'] : ['taxpayer']]]
  const [muniA, muniB] = split(pos(d.otherStateBondInterest))
  const [addA, addB] = split(pos(d.otherAdditions))
  const [usA, usB] = split(pos(d.usObligationInterest))
  const [milA, milB] = split(pos(d.militaryPay))
  const [subA, subB] = split(pos(d.otherSubtractions))
  for (const [c, owners] of cols) {
    const m = M[c]
    m['1'] = c === 'A' ? muniA : muniB
    m['5'] = c === 'A' ? addA : addB
    m['6'] = m['1'] + m['5']
    m['8'] = c === 'A' ? usA : usB
    m['9'] = owners.reduce((s, o) => s + Math.min(KY_PENSION_EXCLUSION, r(retirementBy(o))), 0)
    m['10'] = r(owners.reduce((s, o) => s + f['6b'] * ssShare(o), 0))
    m['13'] = c === 'A' ? milA : milB
    m['14'] = c === 'A' ? subA : subB
    m['15'] = ['8', '9', '10', '13', '14'].reduce((s, k) => s + (m[k] ?? 0), 0)
    m['17'] = m['15']
  }
  if (!twoCols) M.A = {}
  for (const [c, X] of [['A', A], ['B', B]] as const) {
    if (c === 'A' && !twoCols) continue
    X['6'] = M[c]['6'] ?? 0
    X['7'] = X['5'] + X['6']
    X['8'] = M[c]['17'] ?? 0
    X['9'] = X['7'] - X['8']
  }

  // ── Deductions ──
  const it = ret.itemized
  const itemized = r(pos(it.mortgageInterest) + pos(it.charityCash) + pos(it.charityNonCash) + pos(it.other))
  const standardTotal = twoCols ? 2 * KY_STANDARD : KY_STANDARD
  const itemize = itemized > standardTotal
  if (twoCols) {
    const incomeA = pos(A['9'])
    const total = incomeA + pos(B['9'])
    const shareA = itemize ? (total > 0 ? r(itemized * incomeA / total) : r(itemized / 2)) : KY_STANDARD
    A['10'] = shareA
    B['10'] = itemize ? itemized - shareA : KY_STANDARD
  } else B['10'] = itemize ? itemized : KY_STANDARD

  // ── Tax and credits by column ──
  const personal = (owners: Owner[]): number => owners.reduce((s, o) => s + ((person(o).age65OrOlder || person(o).age >= 65) ? 40 : 0) + (person(o).blind ? 40 : 0) + (d.nationalGuard[o] ? 20 : 0), 0)
  const colOwners: ['A' | 'B', Record<string, number>, Owner[]][] = [['A', A, ['spouse']], ['B', B, twoCols ? ['taxpayer'] : married ? ['taxpayer', 'spouse'] : ['taxpayer']]]
  for (const [c, X, owners] of colOwners) {
    if (c === 'A' && !twoCols) continue
    X['11'] = pos(X['9'] - X['10'])
    X['12'] = r(X['11'] * KY_RATE)
    X['13'] = 0
    X['14'] = X['12'] + X['13']
    X['15'] = c === 'B' ? Math.min(r(pos(d.itcCredits)), X['14']) : 0
    X['16'] = pos(X['14'] - X['15'])
    X['17'] = personal(owners)
    X['18'] = pos(X['16'] - X['17'])
  }

  // ── Page 2 ──
  const L: Record<string, number> = {}
  L['19'] = (twoCols ? A['18'] : 0) + B['18']
  const kids = ret.dependents.filter((x) => x.childRelationship && (x.age < 19 || (x.student && x.age < 24) || x.disabled)).length
  const familySize = Math.min(4, 1 + (married ? 1 : 0) + kids)
  const kyAgi = (twoCols ? pos(A['9']) : 0) + pos(B['9'])
  const exemptMuni = r(pos(f['2a']))
  const mgi = Math.max(pos(agi) + exemptMuni, kyAgi)
  const familyRate = kyFamilyCreditRate(familySize, mgi)
  L['20'] = familySize
  L['21'] = r(L['19'] * familyRate)
  L['22'] = L['19'] - L['21']
  L['23'] = Math.min(r(pos(d.tuitionCredit)), L['22'])
  L['24'] = r(pos(res.schedule3.dependentCare) * 0.2)
  L['26'] = pos(L['22'] - L['23'] - L['24'])
  L['27'] = r(pos(d.useTax))
  L['28'] = L['26'] + L['27']
  L['30'] = L['28']
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  L['31a'] = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + r(pos(d.w2[w.id]?.stateTax ?? 0)), 0) + r(pos(d.withholdingOther))
  L['31b'] = r(pos(d.estimatedPayments))
  L['32'] = L['31a'] + L['31b']
  L['33'] = pos(L['30'] - L['32'])
  L['35'] = 0
  L['36'] = pos(L['30'] + L['35'] - L['32'])
  L['37'] = pos(L['32'] - L['30'] - L['35'])
  L['39'] = 0
  L['40'] = Math.min(r(pos(d.creditForward)), L['37'])
  L['41'] = L['37'] - L['39'] - L['40']

  // ── Notes ──
  attach.push('Schedule KW-2 (Kentucky withholding statements) with your W-2s and 1099s')
  if ([M.A, M.B].some((m) => (m['6'] ?? 0) + (m['17'] ?? 0) > 0)) attach.push('Schedule M (modifications) — not filled in here; copy the amounts from the Schedule M table in the app')
  if (itemize) attach.push('Kentucky Schedule A — not filled in here')
  if (L['21'] > 0 || A['17'] > 0 || B['17'] > 0 || B['15'] > 0) attach.push('Schedule ITC (Family Size and personal tax credits) — not filled in here')
  if (L['23'] > 0) attach.push('Form 8863-K (education tuition credit)')
  if (L['24'] > 0) attach.push('Federal Form 2441')
  if (ret.businesses.length > 0 || ret.rentals.length > 0) attach.push('A complete copy of your federal Form 1040 (business, farm or rental income)')
  if (twoCols) issues.push('Both spouses had income, so the return uses status 2 (married filing separately on a combined return): each spouse gets a $3,270 standard deduction. Income that belongs to both (interest, dividends, gains) is split evenly; adjust if it belongs to one of you.')
  for (const o of owners) if (retirementBy(o) > KY_PENSION_EXCLUSION) issues.push(`${o === 'taxpayer' ? 'Your' : 'Your spouse’s'} retirement income is over $31,110: if any of it is from the federal, Kentucky or Kentucky local government systems (service before 1998), Schedule P may give a larger exclusion.`)
  if (fs === 'hoh' || fs === 'qss') issues.push('Kentucky has no head of household status: the return is filed as single (status 1).')
  if (res.schedule1A.tips + res.schedule1A.overtime + res.schedule1A.carLoanInterest > 0) issues.push('Kentucky does not allow the federal deductions for tips, overtime or car loan interest; they are below federal AGI, so nothing changes here.')
  if (L['36'] > 500 && L['31b'] === 0) issues.push('A balance due over $500 may mean an underpayment penalty (Form 2210-K).')

  return { status, colA: A, colB: B, lines: L, schM: M, itemize, itemized, familySize, mgi, familyRate, issues, attach }
}
