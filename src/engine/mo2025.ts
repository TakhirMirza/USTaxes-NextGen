/**
 * Missouri Form MO-1040, full-year resident individual income tax return, tax year 2025, with Form MO-A, the property
 * tax credit (MO-PTS with MO-CRP), the resident credit (MO-CR) and the Working Family Tax Credit (MO-WFTC).
 *
 * Source: 2025 Form MO-1040 fillable packet (revised 12-2025) and the 2025 MO-1040 instructions.
 *  - Married couples filing jointly federally file a combined return: federal AGI is split between the spouses
 *    (Y and S columns) and each column is taxed separately on its share of Missouri taxable income.
 *  - MO-A Part 1: other states’ bond interest added; U.S. interest, state refunds, military retirement, railroad
 *    retirement, 529 and ABLE contributions (up to $8,000 / $16,000), health insurance premiums, 20% of business
 *    income and 100% of capital gains subtracted.
 *  - MO-A Part 3: public pensions up to $47,633, private pensions up to $6,000 each (reduced above $25,000 / $32,000 /
 *    $16,000 of income without Social Security), Social Security at 62 or older and Social Security disability.
 *  - Federal income tax deduction (35%–0% of federal tax by Missouri AGI, up to $5,000 / $10,000), the federal
 *    standard deduction or MO-A Part 2 itemized deductions, $1,400 for head of household / qualifying widow(er).
 *  - Tax: 2% to 4.7% above $1,313, rounded to the dollar.
 *  - MO-PTS: the property tax credit chart (credit = band midpoint − income × k / 1600).
 * Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)

/** Line 30: the tax rate chart, rounded to the nearest dollar. */
export function moTax(taxable: number): number {
  const x = pos(taxable)
  const rows: [number, number, number][] = [[9191, 256, 0.047], [7878, 197, 0.045], [6565, 144, 0.04], [5252, 98, 0.035], [3939, 59, 0.03], [2626, 26, 0.025], [1313, 0, 0.02]]
  for (const [over, base, rate] of rows) if (x > over) return r(base + (x - over) * rate)
  return 0
}

/** MO-PTS line 14 from the 2025 property tax credit chart (pages 50–52 of the instructions). */
export function moPropertyTaxCredit(netIncome: number, allowable: number): number {
  const T = Math.min(1100, r(pos(allowable)))
  if (T <= 0) return 0
  const I = r(netIncome)
  if (I <= 14300) return T
  if (I > 30000) return 0
  const band = Math.ceil(T / 25)
  const mid = 25 * band - 12
  const k = Math.floor((I - 14301) / 300) + 1
  const lo = 14301 + 300 * (k - 1)
  const hi = Math.min(lo + 299, 30000)
  return Math.max(0, Math.floor(mid - ((lo + hi - 1) / 2) * k / 1600 + 1e-9))
}

/** Line 12: federal tax percentage by Missouri AGI. */
export const moFederalTaxPercent = (agi: number): number => (agi <= 25000 ? 35 : agi <= 50000 ? 25 : agi <= 100000 ? 15 : agi <= 125000 ? 5 : 0)

export type MoStatus = 'single' | 'dependent' | 'combined' | 'separate' | 'hoh' | 'widow'
type Col = Record<string, number>

export interface MoResult {
  status: MoStatus
  two: boolean
  Y: Col
  S: Col
  lines: Record<string, number>
  /** MO-A Part 1 (by column), Part 2, Part 3. */
  a: { Y: Col; S: Col }
  part2: Record<string, number> | null
  part3: { A: { Y: Col; S: Col; total: number }; B: Record<string, number>; C: { Y: Col; S: Col; total: number }; D: number }
  /** MO-CR (column of the spouse whose income was taxed), MO-PTS / MO-CRP, MO-WFTC. */
  cr: Record<string, number> | null
  crCol: 'Y' | 'S'
  pts: Record<string, number> | null
  crp: Record<string, number> | null
  wftc: Record<string, number> | null
  itemize: boolean
  issues: string[]
  attach: string[]
}

export function computeMissouri(ret: TaxReturnInput, res: TaxReturnResult): MoResult {
  const d = ret.mo
  const f = res.f1040
  const fs = ret.filingStatus
  const two = fs === 'mfj'
  const status: MoStatus = ret.canBeClaimedAsDependent ? 'dependent' : fs === 'mfj' ? 'combined' : fs === 'mfs' ? 'separate' : fs === 'hoh' ? 'hoh' : fs === 'qss' ? 'widow' : 'single'
  const owners: Owner[] = two ? ['taxpayer', 'spouse'] : ['taxpayer']
  const colOf: Record<Owner, 'Y' | 'S'> = { taxpayer: 'Y', spouse: 'S' }
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const issues: string[] = []
  const attach: string[] = []
  const Y: Col = {}
  const S: Col = {}
  const C = { Y, S }
  const cols: ('Y' | 'S')[] = two ? ['Y', 'S'] : ['Y']
  const agi = r(f['11a'])

  // ── Line 1: federal AGI by spouse ──
  const wagesBy = (o: Owner): number => sum(ret.w2s.filter((w) => w.owner === o).map((w) => w.wages))
  const bizBy = (o: Owner): number => sum(res.scheduleC.filter((x) => x.owner === o).map((x) => x.netProfit))
  const seHalfBy = (o: Owner): number => sum(res.scheduleSE.filter((x) => x.owner === o).map((x) => x.total / 2))
  const retBy = (o: Owner): number => sum(ret.retirement.filter((x) => x.owner === o).map((x) => pos(x.taxableAmount)))
  const ssGross = sum(ret.socialSecurity.map((x) => pos(x.netBenefits)))
  const ssShare = (o: Owner): number => (ssGross > 0 ? sum(ret.socialSecurity.filter((x) => x.owner === o).map((x) => pos(x.netBenefits))) / ssGross : o === 'taxpayer' ? 1 : 0)
  const rentalNet = new Map(res.scheduleE.properties.map((p) => [p.id, p.net]))
  const rentBy = (o: Owner): number => sum(ret.rentals.filter((p) => p.owner === o).map((p) => rentalNet.get(p.id) ?? 0))
  const own = (o: Owner): number => wagesBy(o) + bizBy(o) - seHalfBy(o) + retBy(o) + f['6b'] * ssShare(o) + rentBy(o)
  const spouseAgi = two ? (d.spouseAgi !== null ? r(d.spouseAgi) : r(own('spouse') + (agi - own('taxpayer') - own('spouse')) / 2)) : 0
  Y['1'] = agi - spouseAgi
  S['1'] = spouseAgi
  // A negative federal AGI counts as $0. On a combined return with a positive total, the spouse with positive
  // income takes the whole joint amount and the other enters $0 (instructions, page 6).
  if (!two) Y['1'] = pos(agi)
  else if (agi <= 0) { Y['1'] = 0; S['1'] = 0 } else if (Y['1'] < 0) { Y['1'] = 0; S['1'] = agi } else if (S['1'] < 0) { Y['1'] = agi; S['1'] = 0 }
  const half = (n: number, c: 'Y' | 'S'): number => (two ? (c === 'Y' ? n - r(n / 2) : r(n / 2)) : c === 'Y' ? n : 0)
  const byOwner = (rec: Record<Owner, number>, c: 'Y' | 'S'): number => (c === 'Y' ? r(pos(rec.taxpayer ?? 0)) : two ? r(pos(rec.spouse ?? 0)) : 0)

  // ── MO-A Part 1 ──
  const A: { Y: Col; S: Col } = { Y: {}, S: {} }
  const cap529 = two ? 16000 : 8000
  const gain = r(pos(f['7a']))
  for (const c of cols) {
    const a = A[c]
    const o: Owner = c === 'Y' ? 'taxpayer' : 'spouse'
    a['1'] = byOwner(d.muniInterest, c)
    a['2'] = byOwner(d.otherAdditions, c)
    a['7'] = a['1'] + a['2']
    a['8'] = byOwner(d.usInterest, c)
    a['9'] = byOwner(d.stateRefund, c)
    a['10'] = byOwner(d.militaryRetirement, c)
    a['11'] = byOwner(d.railroad, c) + byOwner(d.otherSubtractions, c)
    a['12'] = byOwner(d.tuition529, c)
    a['13'] = Math.min(byOwner(d.healthPremiums, c), pos(r(f['15'])))
    a['15'] = byOwner(d.able, c)
    a['17'] = r(pos(bizBy(o)) * 0.2)
    a['18'] = half(gain, c)
    a['19'] = ['8', '9', '10', '11', '12', '13', '15', '17', '18'].reduce((s, k) => s + (a[k] ?? 0), 0)
  }
  // Combined 529 / ABLE limits.
  const over529 = pos(A.Y['12'] + (A.S['12'] ?? 0) - cap529)
  if (over529 > 0) { const t = Math.min(over529, A.Y['12']); A.Y['12'] -= t; A.Y['19'] -= t; if (two) { A.S['12'] -= over529 - t; A.S['19'] -= over529 - t } }
  const overAble = pos(A.Y['15'] + (A.S['15'] ?? 0) - cap529)
  if (overAble > 0) { const t = Math.min(overAble, A.Y['15']); A.Y['15'] -= t; A.Y['19'] -= t; if (two) { A.S['15'] -= overAble - t; A.S['19'] -= overAble - t } }
  for (const c of cols) {
    const X = C[c]
    X['2'] = A[c]['7']
    X['3'] = X['1'] + X['2']
    X['4'] = A[c]['19']
    X['5'] = X['3'] - X['4']
  }
  const L: Record<string, number> = {}
  L['6'] = Y['5'] + (two ? S['5'] : 0)
  if (two) {
    if (Y['5'] <= 0 && S['5'] > 0) { Y['7'] = 0; S['7'] = 100 } else if (S['5'] <= 0) { Y['7'] = 100; S['7'] = 0 } else { Y['7'] = r(Y['5'] / L['6'] * 100); S['7'] = 100 - Y['7'] }
  } else Y['7'] = 100

  // ── MO-A Part 3 ──
  const age = (o: Owner): number => person(o).age
  const C3: { Y: Col; S: Col; total: number } = { Y: {}, S: {}, total: 0 }
  for (const o of owners) {
    const c = colOf[o]
    const ss = r(f['6b'] * ssShare(o))
    const eligible62 = age(o) >= 62 || person(o).age65OrOlder
    C3[c]['1'] = eligible62 ? ss : 0
    C3[c]['2'] = !eligible62 && d.ssDisability[o] ? ss : 0
    C3[c]['3'] = C3[c]['1'] || C3[c]['2']
  }
  C3.total = sum(owners.map((o) => C3[colOf[o]]['3']))
  const A3: { Y: Col; S: Col; total: number } = { Y: {}, S: {}, total: 0 }
  for (const o of owners) {
    const c = colOf[o]
    A3[c]['1'] = r(pos(d.publicPension[o] ?? 0))
    A3[c]['2'] = Math.min(A3[c]['1'], 47633)
    A3[c]['3'] = C3[c]['3']
    A3[c]['4'] = pos(A3[c]['2'] - A3[c]['3'])
  }
  A3.total = sum(owners.map((o) => A3[colOf[o]]['4']))
  const B3: Record<string, number> = {}
  B3['1'] = L['6']
  B3['2'] = r(pos(f['6b']))
  B3['3'] = B3['1'] - B3['2']
  B3['4'] = two ? 32000 : status === 'separate' ? 16000 : 25000
  B3['5'] = pos(B3['3'] - B3['4'])
  for (const o of owners) {
    const c = colOf[o]
    const priv = r(pos(retBy(o) - pos(d.publicPension[o] ?? 0) - pos(d.militaryRetirement[o] ?? 0) - pos(d.railroad[o] ?? 0)))
    B3[`6${c}`] = priv
    B3[`7${c}`] = Math.min(priv, 6000)
  }
  B3['8'] = (B3['7Y'] ?? 0) + (B3['7S'] ?? 0)
  B3['9'] = pos(B3['8'] - B3['5'])
  const D3 = A3.total + B3['9'] + C3.total
  L['8'] = D3

  // ── Lines 9–15 ──
  L['9'] = r(pos(f['22'] - f['27a'] - f['29'] - res.schedule2.amt))
  // Schedule 2 lines 3 (AMT) and 8 (Form 5329 additional taxes).
  L['10'] = r(pos(res.schedule2.amt) + pos(res.schedule2.earlyDistributionTax) + pos(res.schedule2.hsaExcessTax))
  L['11'] = L['9'] + L['10']
  L['12'] = moFederalTaxPercent(L['6'])
  L['13'] = Math.min(r(L['11'] * L['12'] / 100), two ? 10000 : 5000)
  // MO-A Part 2 (only when itemizing federally).
  let part2: MoResult['part2'] = null
  const standard = r(res.deduction.standard)
  let itemize = false
  if (res.deduction.used === 'itemized') {
    const P: Record<string, number> = {}
    const ssTax = (o: Owner): number => Math.min(10918, r(sum(ret.w2s.filter((w) => w.owner === o).map((w) => pos(w.socialSecurityWithheld)))))
    P['1'] = r(res.deduction.itemized)
    P['2'] = ssTax('taxpayer')
    P['3'] = two ? ssTax('spouse') : 0
    P['6'] = r(sum(ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => pos(w.medicareWithheld))))
    P['7'] = r(pos(res.schedule2.selfEmploymentTax) - pos(res.schedule1.adjustments.deductibleHalfOfSeTax ?? 0))
    P['8'] = P['1'] + P['2'] + P['3'] + P['6'] + P['7']
    const it = ret.itemized
    const incomeTax = r(pos(it.stateLocalIncomeOrSalesTax))
    const sa = res.scheduleA
    if (sa.saltBeforeCap > sa.saltCap) {
      P.w1 = r(sa.saltBeforeCap); P.w2 = incomeTax; P.w3 = r(pos(d.earningsTax)); P.w4 = pos(P.w2 - P.w3)
      P.w5 = P.w1 > 0 ? P.w4 / P.w1 : 0; P.w6 = r(sa.taxes); P.w7 = r(P.w6 * P.w5)
      P['9'] = 0; P['10'] = 0; P['11'] = P.w7
    } else {
      P['9'] = incomeTax
      P['10'] = Math.min(P['9'], r(pos(d.earningsTax)))
      P['11'] = P['9'] - P['10']
    }
    P['12'] = pos(P['8'] - P['11'])
    part2 = P
    itemize = P['12'] > standard
  }
  L['14'] = itemize ? part2!['12'] : standard
  L['15'] = status === 'hoh' || status === 'widow' ? 1400 : 0
  L['16'] = r(pos(d.ltcInsurance))
  L['17'] = r(pos(d.healthShare))
  L['18'] = r(pos(d.activeDuty))
  L['19'] = r(pos(d.inactiveDuty))
  L['21'] = r(pos(d.farmland))
  L['24'] = r(pos(d.foster))
  L['25'] = L['8'] + ['13', '14', '15', '16', '17', '18', '19', '21', '24'].reduce((s, k) => s + L[k], 0)
  L['26'] = pos(L['6'] - L['25'])

  // ── Tax by column ──
  let cr: MoResult['cr'] = null
  const crCol: 'Y' | 'S' = two && d.otherState.owner === 'spouse' ? 'S' : 'Y'
  for (const c of cols) {
    const X = C[c]
    X['27'] = r(L['26'] * X['7'] / 100)
    X['28'] = 0
    X['29'] = X['27'] - X['28']
    X['30'] = moTax(X['29'])
    X['31'] = 0
    if (c === crCol && pos(d.otherState.tax) > 0 && pos(d.otherState.income) > 0) {
      const K: Record<string, number> = {}
      K['1'] = X['5']; K['2'] = X['30']; K['3'] = r(pos(d.otherState.income)); K['4'] = 0; K['5'] = K['3'] + K['4']; K['6'] = 0; K['7'] = K['5'] - K['6']
      K['8'] = K['1'] > 0 ? Math.min(100, r(K['7'] / K['1'] * 100)) : 0
      K['9'] = r(K['2'] * K['8'] / 100)
      K['10'] = r(pos(d.otherState.tax))
      K['11'] = Math.min(K['9'], K['10'])
      cr = K
      X['31'] = K['11']
    }
    X['32'] = 100
    X['33'] = pos(X['30'] - X['31'])
    X['34'] = c === 'Y' ? r(pos(d.otherTaxes)) : 0
    X['35'] = X['33'] + X['34']
  }
  L['36'] = Y['35'] + (two ? S['35'] : 0)

  // ── Payments and credits ──
  L['37'] = r(sum(ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => pos(d.w2[w.id]?.stateTax ?? 0)))
    + sum(ret.retirement.filter((x) => owners.includes(x.owner)).map((x) => pos(d.r1099[x.id]?.stateTax ?? 0))))
  L['38'] = r(pos(d.estimatedPayments))
  L['41'] = r(pos(d.extensionPayment))
  L['42'] = r(pos(d.miscCredits))

  // MO-PTS / MO-CRP.
  let pts: MoResult['pts'] = null
  let crp: MoResult['crp'] = null
  const p = d.pts
  if (p.claim) {
    const Pt: Record<string, number> = {}
    Pt['1'] = L['6']
    Pt['2'] = r(pos(ssGross - f['6b']) + pos(p.nontaxableRrb))
    Pt['3'] = r(pos(f['2a']) + sum(owners.map((o) => pos(d.usInterest[o] ?? 0))) + pos(f['4a'] - f['4b']) + pos(f['5a'] - f['5b']) + pos(p.otherIncome))
    Pt['4'] = r(sum(owners.map((o) => pos(d.railroad[o] ?? 0))))
    Pt['5'] = r(pos(p.veteransBenefits))
    Pt['6'] = r(pos(p.publicAssistance))
    Pt['7'] = r(pos(-f['7a']))
    Pt['8'] = ['1', '2', '3', '4', '5', '6', '7'].reduce((s, k) => s + Pt[k], 0)
    Pt['9'] = two ? (p.owner ? 4000 : 2000) : 0
    Pt['10'] = Pt['8'] - Pt['9']
    Pt['11'] = p.owner ? Math.min(1100, r(pos(p.propertyTax))) : 0
    if (!p.owner && pos(p.rent) > 0) {
      crp = {}
      crp['6'] = r(pos(p.rent))
      crp['7'] = p.rentPercent
      crp['8'] = r(crp['6'] * p.rentPercent / 100)
      crp['9'] = r(crp['8'] * 0.2)
    }
    Pt['12'] = crp ? Math.min(750, crp['9']) : 0
    Pt['13'] = Math.min(1100, Pt['11'] + Pt['12'])
    const limit = p.owner ? 30000 : 27200
    Pt['14'] = Pt['10'] > limit ? 0 : moPropertyTaxCredit(Pt['10'], Pt['13'])
    pts = Pt
    if (Pt['10'] > limit) issues.push(`MO-PTS: net household income of ${'$'}${Pt['10'].toLocaleString('en-US')} is over ${'$'}${limit.toLocaleString('en-US')}, so no property tax credit is allowed.`)
  }
  L['43'] = pts?.['14'] ?? 0

  // MO-WFTC.
  let wftc: MoResult['wftc'] = null
  const eic = r(pos(f['27a']))
  if (eic > 0 && status !== 'separate' && status !== 'dependent' && res.eic.investmentIncome <= 4400) {
    const W: Record<string, number> = {}
    W['5'] = eic
    W['6'] = r(eic * 0.2)
    W['7'] = L['36']
    W['8'] = L['42'] + L['43']
    W['9'] = pos(W['7'] - W['8'])
    W['10'] = Math.min(W['6'], W['9'])
    wftc = W
  }
  L['44'] = wftc?.['10'] ?? 0
  L['45'] = L['37'] + L['38'] + L['41'] + L['42'] + L['43'] + L['44']
  L['49'] = pos(L['45'] - L['36'])
  L['54'] = pos(L['36'] - L['45'])
  const funds = sum('abcdefghijkl'.split('').map((k) => r(pos(d.trustFunds[k] ?? 0))))
  if (L['49'] > 0) {
    L['50'] = Math.min(r(pos(d.creditForward)), L['49'])
    L['51'] = Math.min(funds, L['49'] - L['50'])
    L['52'] = Math.min(r(pos(d.mostDeposit)), L['49'] - L['50'] - L['51'])
    L['53'] = L['49'] - L['50'] - L['51'] - L['52']
    L['56'] = 0
  } else {
    L['50'] = 0; L['51'] = 0; L['52'] = 0; L['53'] = 0
    L['55'] = 0
    L['56'] = L['54'] + L['55']
  }

  // ── Notes ──
  attach.push('Pages 1 and 2 of your federal return (and federal schedules)')
  if (L['37'] > 0) attach.push('W-2s and 1099s showing Missouri tax withheld')
  if (L['8'] > 0) attach.push('Forms 1099-R and SSA-1099 for the pension / Social Security exemption')
  if (cr) attach.push(`A copy of your ${d.otherState.state.trim() || 'other state'} return (Form MO-CR)`)
  if (pts) attach.push('Form SSA-1099 or the disability / VA letter for MO-PTS; paid property tax receipts or Form 5674 (verification of rent paid)')
  if (wftc) attach.push('Federal Schedule EIC (Form MO-WFTC)')
  if (L['42'] > 0) attach.push('Form MO-TC with the credit certificates (not prepared here)')
  if (A.Y['13'] + (A.S['13'] ?? 0) > 0) attach.push('Form 5695 (qualified health insurance premiums worksheet)')
  if (two) issues.push(`Combined return: federal AGI split ${'$'}${Y['1'].toLocaleString('en-US')} (you) / ${'$'}${S['1'].toLocaleString('en-US')} (spouse). Shared income (interest, dividends, gains) is split evenly; change the spouse’s share if it isn’t.`)
  if (gain > 0) issues.push('MO-A line 18: all of your net capital gain is subtracted (new for 2025).')
  if (!d.county) issues.push('Choose your county of residence.')
  if (L['54'] > 0 && L['36'] - L['37'] > 100) issues.push('If you underpaid estimated tax you may owe a penalty (Form MO-2210, not prepared here).')
  return { status, two, Y, S: two ? S : {}, lines: L, a: A, part2, part3: { A: A3, B: B3, C: C3, D: D3 }, cr, crCol, pts, crp, wftc, itemize, issues, attach }
}
