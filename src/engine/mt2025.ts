/**
 * Montana Form 2, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Montana Form 2 (2025v3, 12/2025) with Schedules I–IV and 2EC, and the 2025 Form 2 instructions.
 *  - Montana starts from federal taxable income without the QBI deduction: federal AGI − (Form 1040 line 12e + 13b).
 *  - Schedule I additions (other states’ bond interest; state income tax deducted as an itemized deduction, Worksheet B)
 *    and subtractions (state refund, U.S. interest, active-duty pay, 529 up to $4,500 / $9,000, ABLE up to $3,000 /
 *    $6,000, Tier I / II railroad retirement); $5,660 subtraction per taxpayer 65 or older.
 *  - Ordinary income: 4.7%, then 5.9% above $21,100 / $42,200 / $31,700 (less $253 / $506 / $380). Net long-term capital
 *    gains: 3% up to the first bracket, 4.1% above.
 *  - Montana EITC 10% of the federal credit (refundable); Schedule 2EC elderly homeowner/renter credit up to $1,150.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
type FS = TaxReturnInput['filingStatus']

/** The first bracket for each filing status (ordinary rate split and the 3% capital gains band). */
export const mtBracket = (fs: FS): number => (fs === 'mfj' || fs === 'qss' ? 42200 : fs === 'hoh' ? 31700 : 21100)

/** Montana ordinary income tax (page 2, line 12). */
export function mtOrdinaryTax(income: number, fs: FS): number {
  const x = pos(Math.floor(income))
  const top = mtBracket(fs)
  const less = fs === 'mfj' || fs === 'qss' ? 506 : fs === 'hoh' ? 380 : 253
  return x < top ? r(x * 0.047) : r(x * 0.059 - less)
}

/** Net long-term capital gains tax (page 2, lines 2–11). */
export function mtCapitalGainsTax(taxable: number, gains: number, fs: FS): { l3: number; l4: number; l6: number; l7: number; l8: number; l9: number; l10: number; l11: number } {
  const l3 = Math.min(pos(taxable), pos(gains))
  const l4 = pos(taxable) - l3
  const l6 = pos(mtBracket(fs) - l4)
  const l7 = Math.min(l3, l6)
  const l8 = r(l7 * 0.03)
  const l9 = pos(l3 - l6)
  const l10 = r(l9 * 0.041)
  return { l3, l4, l6, l7, l8, l9, l10, l11: l8 + l10 }
}

/** Schedule 2EC: household income reduction multiplier for line 20 and credit multiplier for line 18. */
export function mtElderlyReduction(net: number): number {
  const table: [number, number][] = [[2000, 0], [3000, 0.006], [4000, 0.016], [5000, 0.024], [6000, 0.028], [7000, 0.032], [8000, 0.035], [9000, 0.039], [10000, 0.042], [11000, 0.045], [12000, 0.048]]
  for (const [below, m] of table) if (net < below) return m
  return 0.05
}
export function mtElderlyMultiplier(gross: number): number {
  if (gross < 35000) return 1
  if (gross <= 37500) return 0.4
  if (gross <= 40000) return 0.3
  if (gross <= 42500) return 0.2
  if (gross < 45000) return 0.1
  return 0
}

export interface MtResult {
  /** Schedule III Part II lines (null when only the credit amount was entered). */
  s3p2: Record<string, number> | null
  lines: Record<string, number>
  /** Page 2 worksheet. */
  p2: Record<string, number>
  s1: Record<string, number>
  s3: Record<string, number>
  s4: Record<string, number>
  ec: Record<string, number> | null
  issues: string[]
  attach: string[]
}

export function computeMontana(ret: TaxReturnInput, res: TaxReturnResult): MtResult {
  const d = ret.mt
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const isOld = (o: Owner): boolean => person(o).age >= 65 || person(o).age65OrOlder
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []

  // ── Schedule I ──
  const S1: Record<string, number> = {}
  S1['1'] = r(pos(d.otherStateBondInterest))
  if (res.deduction.used === 'itemized') {
    // Worksheet B: state income tax deducted, after the other state and local taxes, limited to the excess over the standard deduction.
    const it = ret.itemized
    const w5 = pos(r(res.scheduleA.taxes) - r(pos(it.realEstateTax)) - r(pos(it.personalPropertyTax)))
    const w8 = pos(r(res.scheduleA.total) - r(res.deduction.standard))
    S1['4'] = Math.min(w5, w8)
  } else S1['4'] = 0
  S1['6'] = r(pos(d.otherAdditions))
  S1['7'] = S1['1'] + S1['4'] + S1['6']
  S1['8'] = r(pos(d.stateRefund))
  S1['9'] = r(pos(d.usObligationInterest))
  S1['12'] = r(pos(d.activeDutyPay))
  S1['13'] = r(pos(d.workingMilitaryRetirement))
  S1['16'] = Math.min(r(pos(d.tuition529)), joint ? 9000 : 4500)
  S1['17'] = Math.min(r(pos(d.ableDeposits)), joint ? 6000 : 3000)
  S1['21'] = r(pos(d.otherSubtractions))
  S1['22'] = r(pos(d.tier1Railroad))
  S1['23'] = r(pos(d.tier2Railroad))
  S1['24'] = ['8', '9', '12', '13', '16', '17', '21', '22', '23'].reduce((s, k) => s + S1[k], 0)

  // ── Page 1, lines 1–7 ──
  L['1'] = r(f['11a'])
  L['2'] = r(pos(f['12e']) + pos(f['13b']))
  L['3'] = pos(L['1'] - L['2'])
  L['4'] = S1['7']
  L['5'] = S1['24']
  const olds = owners.filter(isOld).length
  L['6'] = 5660 * olds
  L['7'] = pos(L['3'] + L['4'] - L['5'] - L['6'])

  // ── Page 2: tax ──
  const P: Record<string, number> = {}
  const sd = res.scheduleD
  const ltcg = r(pos(Math.min(sd.longTerm, sd.net)))
  P['1'] = L['7']
  if (ltcg > 0 && L['7'] > 0) {
    const cg = mtCapitalGainsTax(L['7'], ltcg, fs)
    P['2'] = ltcg
    P['3'] = cg.l3; P['4'] = cg.l4; P['5'] = mtBracket(fs); P['6'] = cg.l6; P['7'] = cg.l7; P['8'] = cg.l8; P['9'] = cg.l9; P['10'] = cg.l10; P['11'] = cg.l11
    P['12'] = mtOrdinaryTax(cg.l4, fs)
  } else {
    P['11'] = 0
    P['12'] = mtOrdinaryTax(L['7'], fs)
  }
  P['13'] = P['11'] + P['12']
  L['8'] = P['13']

  // ── Schedule III ──
  const S3: Record<string, number> = {}
  // Part II: credit for income tax paid to another state or country (full-year resident).
  const oc = d.otherStateCredit
  let s3p2: Record<string, number> | null = null
  if (oc.income > 0 || oc.ltcgIncome > 0 || oc.tax > 0 || oc.ltcgTax > 0) {
    const Q: Record<string, number> = {}
    const ratio = (a: number, b: number): number => (b > 0 ? Math.min(1, Math.round(a / b * 1e6) / 1e6) : 0)
    Q['1'] = r(pos(oc.income)); Q['2'] = r(pos(oc.stateIncome))
    Q['3a'] = pos(r(f['9']) - ltcg); Q['3b'] = r(pos(oc.expenses)); Q['3'] = pos(Q['3a'] - Q['3b'])
    Q['4'] = r(pos(oc.tax)); Q['5'] = P['12']
    Q['6'] = ratio(Q['1'], Q['2']); Q['7'] = r(Q['4'] * Q['6'])
    Q['8'] = ratio(Q['1'], Q['3']); Q['9'] = r(Q['5'] * Q['8'])
    Q['10'] = Math.min(Q['4'], Q['7'], Q['9'])
    Q['11'] = r(pos(oc.ltcgIncome))
    if (Q['11'] > 0) {
      Q['12'] = Q['2']; Q['13'] = ltcg; Q['14'] = r(pos(oc.ltcgTax)); Q['15'] = P['11']
      Q['16'] = ratio(Q['11'], Q['12']); Q['17'] = r(Q['14'] * Q['16'])
      Q['18'] = ratio(Q['11'], Q['13']); Q['19'] = r(Q['15'] * Q['18'])
      Q['20'] = Math.min(Q['14'], Q['17'], Q['19'])
    } else Q['20'] = 0
    Q['21'] = Q['10'] + Q['20']
    s3p2 = Q
  }
  S3['1'] = s3p2 ? s3p2['21'] : r(pos(oc.amount))
  S3['13'] = r(pos(d.otherNonrefundableCredits))
  S3['14'] = S3['1'] + S3['13']
  S3['17'] = r(pos(d.refundableCredits))
  L['9'] = Math.min(S3['14'], L['8'])
  L['10'] = L['8'] - L['9']

  // ── Payments ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['11a'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0))
  L['11b'] = r(pos(d.withholding1099))
  L['11c'] = r(pos(d.passThroughCredit))
  L['11d'] = r(pos(d.k1Withholding))
  L['11'] = L['11a'] + L['11b'] + L['11c'] + L['11d']
  L['12'] = r(pos(d.estimatedPayments))
  L['13'] = r(pos(d.priorYearApplied))
  L['14'] = r(pos(d.extensionPayment))
  L['15eic'] = r(pos(f['27a']))
  L['15'] = r(L['15eic'] * 0.1)

  // ── Schedule 2EC ──
  let ec: Record<string, number> | null = null
  const age62 = owners.some((o) => person(o).age >= 62)
  if (d.elderly.claim && age62) {
    const e = d.elderly
    ec = {}
    ec['1'] = r(pos(f['1z']))
    ec['2'] = r(pos(f['2a']) + pos(f['2b']))
    ec['3'] = r(pos(f['3b']))
    ec['4'] = r(pos(f['4a']))
    ec['5'] = r(pos(f['5a']))
    ec['6'] = r(pos(f['6a']))
    ec['7'] = r(pos(f['7a']))
    ec['8'] = r(pos(f['27a']) + pos(f['28']) + L['15'])
    ec['10'] = r(res.scheduleC.reduce((s, b) => s + pos(b.netProfit), 0))
    ec['12'] = r(pos(res.scheduleE.net))
    ec['14'] = r(pos(res.schedule1.unemployment))
    ec['15'] = r(pos(res.schedule1.otherIncome))
    ec['16'] = r(pos(e.governmentAssistance))
    ec['17'] = r(pos(e.otherHouseholdIncome))
    ec['18'] = ['1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '14', '15', '16', '17'].reduce((s, k) => s + ec![k], 0)
    ec['19'] = 12600
    ec['20'] = pos(ec['18'] - 12600)
    ec['21'] = mtElderlyReduction(ec['20'])
    ec['22'] = r(ec['20'] * ec['21'])
    ec['23'] = r(pos(e.propertyTaxBilled))
    ec['24'] = r(pos(e.rentPaid))
    ec['25'] = r(ec['24'] * 0.15)
    ec['26'] = ec['23'] + ec['25']
    ec['27'] = pos(ec['26'] - ec['22'])
    ec['28'] = Math.min(ec['27'], 1150)
    ec['29'] = mtElderlyMultiplier(ec['18'])
    ec['30'] = r(ec['28'] * ec['29'])
  }
  L['16'] = ec?.['30'] ?? 0
  L['17'] = S3['17']

  // ── Schedule IV ──
  const S4: Record<string, number> = {}
  for (const k of ['1a', '1b', '1c', '1d']) S4[k] = r(pos(d.contributions[k] ?? 0))
  S4['1'] = S4['1a'] + S4['1b'] + S4['1c'] + S4['1d']
  S4['8'] = S4['1']
  L['19'] = S4['8']
  L['21'] = L['11'] + L['12'] + L['13'] + L['14'] + L['15'] + L['16'] + L['17'] - L['19']
  L['22'] = pos(L['10'] - L['21'])
  L['23'] = pos(L['21'] - L['10'])
  L['24'] = Math.min(L['23'], r(pos(d.creditForward)))
  L['26'] = L['23'] - L['24']

  // ── Notes ──
  attach.push('A complete copy of your federal return')
  if (L['11'] > 0) attach.push('W-2s, 1099s and Montana K-1s showing Montana withholding')
  if (S3['1'] > 0) attach.push(`A copy of your ${d.otherStateCredit.state.trim() || 'other state'} return`)
  if (ec && L['16'] > 0) attach.push('Your 2025 property tax bill and/or signed rent receipts (Schedule 2EC)')
  if (S3['1'] > 0 && !s3p2) issues.push('Enter the income and tax figures for the other state in the Schedule III section to work out Part II; the credit you entered is used as is.')
  if (d.elderly.claim && !age62) issues.push('The elderly homeowner/renter credit needs you (or your spouse) to be 62 or older by December 31, 2025.')
  if (ec && ec['18'] >= 45000) issues.push('Gross household income is $45,000 or more, so no elderly homeowner/renter credit is allowed.')
  if (S1['4'] > 0) issues.push('Schedule I line 4: state income tax deducted as an itemized deduction is added back (Worksheet B). Local income taxes are treated as zero here.')
  if (S1['6'] > 0 && !d.otherAdditionsCode.trim()) issues.push('Schedule I line 6 needs an addition code (see the instructions).')
  if (S1['21'] > 0 && !d.otherSubtractionsCode.trim()) issues.push('Schedule I line 21 needs a subtraction code (see the instructions).')
  if (L['26'] > 0 && !ret.refundDeposit.accountNumber.trim()) issues.push('Direct deposit isn’t available on a first Montana return; you’ll get a check.')
  return { s3p2, lines: L, p2: P, s1: S1, s3: S3, s4: S4, ec, issues, attach }
}
