/**
 * Kentucky Form 740, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form 740 (42A740 10-25) and the 2025 Form 740 instructions packet: federal AGI with the Schedule M
 * modifications (other states’ bond interest added; U.S. government interest, the pension income exclusion of up to
 * $31,110 per person, taxable Social Security and active duty military pay subtracted); the $3,270 standard
 * deduction or Kentucky Schedule A (mortgage and investment interest, gifts, gambling losses and other miscellaneous
 * deductions only); a flat 4% tax; personal tax credits ($40 at 65 or blind, $20 Kentucky National Guard); the Family
 * Size Tax Credit (100% down to 10% of tax as modified gross income rises from 100% to 133% of the 2025 thresholds
 * $15,650 / $21,150 / $26,650 / $32,150), Schedule ITC Section A credits (with Worksheet A for tax paid to another state)
 * and 20% of the federal child and dependent care credit. Married couples who
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
  /** Schedule A lines; Schedule ITC Section A by column (E spouse, F yourself); Worksheet A (null without the credit); pension worksheet line (d) by column. */
  schA: Record<string, number>
  itc: Record<'E' | 'F', Record<string, number>>
  wsA: Record<string, number> | null
  pensionWs: Record<'A' | 'B', number>
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
  const sm = d.schM
  const byLine: Record<string, number> = {
    '1': pos(d.otherStateBondInterest), '2': pos(sm.k1Additions), '3': pos(sm.federalDepreciation), '4': pos(sm.federalNol), '5': pos(d.otherAdditions),
    '7': pos(sm.stateRefund), '8': pos(d.usObligationInterest), '11': pos(sm.k1Subtractions), '12': pos(sm.kyDepreciation), '13': pos(d.militaryPay),
    '14': pos(d.otherSubtractions), '16': pos(sm.knol)
  }
  const pensionWs: Record<'A' | 'B', number> = { A: 0, B: 0 }
  for (const [c, owners] of cols) {
    const m = M[c]
    for (const [k, n] of Object.entries(byLine)) m[k] = split(n)[c === 'A' ? 0 : 1]
    m['6'] = m['1'] + m['2'] + m['3'] + m['4'] + m['5']
    pensionWs[c] = owners.reduce((s, o) => s + r(retirementBy(o)), 0)
    m['9'] = owners.reduce((s, o) => s + Math.min(KY_PENSION_EXCLUSION, r(retirementBy(o))), 0)
    m['10'] = r(owners.reduce((s, o) => s + f['6b'] * ssShare(o), 0))
    m['15'] = ['7', '8', '9', '10', '11', '12', '13', '14'].reduce((s, k) => s + (m[k] ?? 0), 0)
    m['17'] = m['15'] + m['16']
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
  const sa = d.schA
  const S: Record<string, number> = {}
  S['1'] = r(pos(it.mortgageInterest)); S['2'] = r(pos(sa.individualMortgage)); S['3'] = r(pos(sa.points)); S['4'] = 0; S['5'] = r(pos(sa.investmentInterest))
  S['6'] = S['1'] + S['2'] + S['3'] + S['5']
  S['7'] = r(pos(it.charityCash)); S['8'] = r(pos(it.charityNonCash)); S['9'] = r(pos(sa.artistic)); S['10'] = r(pos(sa.carryover))
  S['11'] = S['7'] + S['8'] + S['9'] + S['10']
  S['12'] = r(pos(sa.gambling)); S['13'] = r(pos(it.other)); S['14'] = S['12'] + S['13']
  S['15'] = S['6'] + S['11'] + S['14']
  const itemized = S['15']
  const standardTotal = twoCols ? 2 * KY_STANDARD : KY_STANDARD
  const itemize = itemized > standardTotal
  if (twoCols) {
    const incomeA = pos(A['9'])
    const total = incomeA + pos(B['9'])
    const shareA = itemize ? (total > 0 ? r(itemized * incomeA / total) : r(itemized / 2)) : KY_STANDARD
    A['10'] = shareA
    B['10'] = itemize ? itemized - shareA : KY_STANDARD
    if (itemize) {
      S['16'] = itemized
      S['17'] = total > 0 ? Math.round(incomeA / total * 10000) / 100 : 50
      S['18'] = Math.round((100 - S['17']) * 100) / 100
      S['19'] = A['10']
      S['20'] = B['10']
    }
  } else B['10'] = itemize ? itemized : KY_STANDARD

  // ── Tax and credits by column ──
  const personal = (owners: Owner[]): number => owners.reduce((s, o) => s + ((person(o).age65OrOlder || person(o).age >= 65) ? 40 : 0) + (person(o).blind ? 40 : 0) + (d.nationalGuard[o] ? 20 : 0), 0)
  const colOwners: ['A' | 'B', Record<string, number>, Owner[]][] = [['A', A, ['spouse']], ['B', B, twoCols ? ['taxpayer'] : married ? ['taxpayer', 'spouse'] : ['taxpayer']]]
  // Schedule ITC Section A: column E (spouse, status 2 only) and F (yourself or joint).
  const ITC_LINES = Array.from({ length: 24 }, (_, i) => String(i + 1))
  const itc: Record<'E' | 'F', Record<string, number>> = { E: {}, F: {} }
  const colOf = (o: Owner): 'E' | 'F' => (twoCols && o === 'spouse' ? 'E' : 'F')
  for (const k of ITC_LINES) {
    if (k === '6') continue
    for (const o of ['taxpayer', 'spouse'] as Owner[]) {
      const n = r(pos(d.itc[k]?.[o] ?? 0))
      if (n > 0 && (o === 'taxpayer' || married)) itc[colOf(o)][k] = (itc[colOf(o)][k] ?? 0) + n
    }
  }
  let wsA: Record<string, number> | null = null
  const os = d.otherState
  const wsCol: 'A' | 'B' = twoCols && os.owner === 'spouse' ? 'A' : 'B'
  for (const [c, X, owners] of colOwners) {
    if (c === 'A' && !twoCols) continue
    X['11'] = pos(X['9'] - X['10'])
    X['12'] = r(X['11'] * KY_RATE)
    X['13'] = 0
    X['14'] = X['12'] + X['13']
    if (c === wsCol && pos(os.tax) > 0 && pos(os.income) > 0) {
      // Worksheet A: Kentucky tax saved if the other state’s income were left out, up to the tax paid there.
      const w: Record<string, number> = {}
      w['1'] = X['11']; w['2'] = itemize ? (twoCols ? r(S['12'] / 2) : S['12']) : 0; w['3'] = w['1'] + w['2']
      w['4'] = r(pos(os.income)); w['5'] = pos(w['3'] - w['4']); w['6'] = Math.min(w['2'], w['5']); w['7'] = pos(w['5'] - w['6'])
      w['8'] = r(w['7'] * KY_RATE); w['9'] = r(w['1'] * KY_RATE); w['10'] = pos(w['9'] - w['8']); w['11'] = r(pos(os.tax)); w['12'] = Math.min(w['10'], w['11'])
      wsA = w
      itc[c === 'A' ? 'E' : 'F']['6'] = w['12']
    }
    const col = itc[c === 'A' ? 'E' : 'F']
    col['25'] = ITC_LINES.reduce((s, k) => s + (col[k] ?? 0), 0)
    X['15'] = Math.min(col['25'], X['14'])
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
  if (pensionWs.A > KY_PENSION_EXCLUSION || pensionWs.B > KY_PENSION_EXCLUSION) attach.push('Schedule P, if any retirement income is from a federal, Kentucky or Kentucky local government plan')
  if ((M.A['16'] ?? 0) + (M.B['16'] ?? 0) > 0) attach.push('Schedule KNOL (Kentucky net operating loss)')
  if ((M.A['12'] ?? 0) + (M.B['12'] ?? 0) > 0) attach.push('Kentucky Form 4562 (Kentucky depreciation)')
  if ((M.A['5'] ?? 0) + (M.B['5'] ?? 0) + (M.A['14'] ?? 0) + (M.B['14'] ?? 0) > 0) attach.push('A statement explaining the other additions and subtractions on Schedule M, lines 5 and 14')
  if (itemize && S['8'] > 500) attach.push('Federal Form 8283 (noncash gifts over $500; Schedule A line 8)')
  if (itemize && S['5'] > 0) attach.push('Federal Form 4952, if required (investment interest; Schedule A line 5)')
  if (wsA) attach.push(`A copy of your ${os.state.trim() || 'other state'} return (credit for tax paid to another state)`)
  const itcCreditLines = ITC_LINES.filter((k) => k !== '6' && ((itc.E[k] ?? 0) + (itc.F[k] ?? 0)) > 0)
  if (itcCreditLines.length) attach.push(`The attachment listed on Schedule ITC for each credit (Section A line${itcCreditLines.length > 1 ? 's' : ''} ${itcCreditLines.join(', ')})`)
  if (pos(os.tax) > 0 && !os.state.trim()) issues.push('Schedule ITC Worksheet A: enter the name of the other state.')
  if (pos(os.tax) > 0 && !(pos(os.income) > 0)) issues.push('Schedule ITC Worksheet A: enter the income reported to the other state that is also on your Kentucky return.')
  if (L['23'] > 0) attach.push('Form 8863-K (education tuition credit)')
  if (L['24'] > 0) attach.push('Federal Form 2441')
  if (ret.businesses.length > 0 || ret.rentals.length > 0) attach.push('A complete copy of your federal Form 1040 (business, farm or rental income)')
  if (twoCols) issues.push('Both spouses had income, so the return uses status 2 (married filing separately on a combined return): each spouse gets a $3,270 standard deduction. Income that belongs to both (interest, dividends, gains) is split evenly; adjust if it belongs to one of you.')
  for (const o of owners) if (retirementBy(o) > KY_PENSION_EXCLUSION) issues.push(`${o === 'taxpayer' ? 'Your' : 'Your spouse’s'} retirement income is over $31,110: if any of it is from the federal, Kentucky or Kentucky local government systems (service before 1998), Schedule P may give a larger exclusion.`)
  if (fs === 'hoh' || fs === 'qss') issues.push('Kentucky has no head of household status: the return is filed as single (status 1).')
  if (res.schedule1A.tips + res.schedule1A.overtime + res.schedule1A.carLoanInterest > 0) issues.push('Kentucky does not allow the federal deductions for tips, overtime or car loan interest; they are below federal AGI, so nothing changes here.')
  if (L['36'] > 500 && L['31b'] === 0) issues.push('A balance due over $500 may mean an underpayment penalty (Form 2210-K).')

  return { status, colA: A, colB: B, lines: L, schM: M, schA: S, itc, wsA, pensionWs, itemize, itemized, familySize, mgi, familyRate, issues, attach }
}
