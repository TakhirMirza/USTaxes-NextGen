/**
 * South Carolina SC1040, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 SC1040 (Rev. 4/21/25), the 2025 SC1040 instructions and SC1040TT (Revised 6/17/25) in the 2025 IIT
 * packet: federal taxable income plus the state tax addback worksheet, other states’ bond interest and the QBI
 * deduction (line e); subtractions for the state refund, 44% of net long-term capital gains, U.S. interest, Social
 * Security, the retirement deduction ($3,000, or $10,000 at 65), military retirement, the $15,000 age 65 deduction,
 * $4,930 per dependent (line w) and again per dependent under 6 (line t); tax 0% to $3,560, 3% to $17,830, 6% above
 * (tables below $100,000: $50 rows to $7,000, then $100 rows, at the midpoint); child care credit 7% of federal
 * expenses (at most $210/$420) and the two wage earner credit (0.7% of the lower earned income up to $50,000).
 * Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

export const SC_DEPENDENT_EXEMPTION = 4930
const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

function rateTax(x: number): number {
  return pos(Math.min(x, 17830) - 3560) * 0.03 + pos(x - 17830) * 0.06
}

/** Line 6: the SC1040TT tables below $100,000, then 6% less $642. */
export function scTax(taxable: number): number {
  const t = pos(r(taxable))
  if (t >= 100000) return r(t * 0.06 - 642)
  const width = t < 7000 ? 50 : 100
  const lo = Math.floor(t / width) * width
  return r(rateTax(lo + width / 2))
}

export interface ScTc {
  worksheets: { state: string; l1: number; l2: number; l3: number; l4: number; l5: number; l6: number; l7: number }[]
  lines: Record<string, number>
  other: { description: string; code: string; amount: number }[]
}

export interface ScResult {
  /** SC1040TC (null when only the line 13 total was entered). */
  tc: ScTc | null
  lines: Record<string, number>
  dependents: { count: number; under6: number; age65: number }
  statements: { owner: Owner; employer: string; ein: string; stateId: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeSouthCarolina(ret: TaxReturnInput, res: TaxReturnResult): ScResult {
  const d = ret.sc
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []

  // ── Line 1 and additions ──
  L['1'] = pos(r(f['15']))
  // Line a: the state tax addback worksheet.
  let addback = 0
  if (res.deduction.used === 'itemized') {
    const excess = pos(res.deduction.itemized - (fs === 'mfs' ? 0 : res.deduction.standard))
    const incomeTax = pos(ret.itemized.stateLocalIncomeOrSalesTax)
    const capLeft = pos(res.scheduleA.saltCap - pos(ret.itemized.realEstateTax) - pos(ret.itemized.personalPropertyTax))
    addback = Math.min(excess, incomeTax, capLeft)
  }
  L['a'] = r(addback)
  L['d'] = r(pos(d.otherStateBondInterest))
  L['e'] = r(pos(f['13a'])) + r(pos(d.otherAdditions))
  L['2'] = L['a'] + L['d'] + L['e']
  L['3'] = L['1'] + L['2']

  // ── Subtractions ──
  const sd = res.scheduleD
  L['f'] = r(pos(d.stateRefundInFagi))
  L['g'] = r(pos(d.disabilityRetirement))
  L['i'] = sd.net > 0 && sd.longTerm > 0 ? r(Math.min(sd.longTerm, sd.net) * 0.44) : 0
  L['k'] = r(pos(d.collegeSavings))
  L['m'] = r(pos(d.usObligationInterest))
  L['o'] = r(pos(f['6b']))
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const is65 = (o: Owner): boolean => person(o).age65OrOlder || person(o).age >= 65
  const retirementIncome = (o: Owner): number => pos(ret.retirement.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0))
  const military = (o: Owner): number => Math.min(r(pos(d.militaryRetirement[o])), retirementIncome(o))
  const retirement = (o: Owner): number => Math.min(pos((is65(o) ? 10000 : 3000) - military(o)), pos(retirementIncome(o) - military(o)))
  L['p-1'] = r(retirement('taxpayer'))
  L['p-2'] = joint ? r(retirement('spouse')) : 0
  L['p-4'] = military('taxpayer')
  L['p-5'] = joint ? military('spouse') : 0
  L['q-1'] = is65('taxpayer') ? pos(15000 - L['p-1'] - L['p-4']) : 0
  L['q-2'] = joint && is65('spouse') ? pos(15000 - L['p-2'] - L['p-5']) : 0
  L['s'] = Math.max(0, Math.floor(d.subsistenceDays)) * 16
  const depCount = ret.dependents.length
  const under6 = ret.dependents.filter((x) => x.age < 6).length
  L['t'] = under6 * SC_DEPENDENT_EXEMPTION
  L['v'] = r(pos(d.otherSubtractions))
  L['w'] = depCount * SC_DEPENDENT_EXEMPTION
  L['4'] = ['f', 'g', 'i', 'k', 'm', 'o', 'p-1', 'p-2', 'p-4', 'p-5', 'q-1', 'q-2', 's', 't', 'v', 'w'].reduce((s, k) => s + L[k], 0)
  L['5'] = pos(L['3'] - L['4'])

  // ── Tax and credits ──
  L['6'] = scTax(L['5'])
  L['10'] = L['6']
  const persons = res.form2441.qualifyingPersons
  L['11'] = fs === 'mfs' ? 0 : Math.min(r(pos(res.form2441.expensesUsed) * 0.07), persons >= 2 ? 420 : persons === 1 ? 210 : 0, L['10'])
  if (joint) {
    const earned = (o: Owner): number => {
      const wages = ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0)
      const se = res.scheduleC.filter((x) => x.owner === o).reduce((s, x) => s + x.netProfit, 0)
      const halfSe = res.scheduleSE.filter((x) => x.owner === o).reduce((s, x) => s + x.total / 2, 0)
      return pos(wages + se - halfSe)
    }
    const lower = Math.min(50000, earned('taxpayer'), earned('spouse'))
    L['12'] = Math.min(350, r(lower * 0.007), pos(L['10'] - L['11']))
  } else L['12'] = 0
  // ── SC1040TC ──
  const tcIn = d.tc
  const states = tcIn.otherStates.filter((o) => o.state.trim() && (o.income > 0 || o.tax > 0))
  const others = tcIn.other.filter((o) => o.amount > 0).slice(0, 10)
  const tcUsed = states.length > 0 || others.length > 0 || ['2', '3', '4', '5'].some((k) => (tcIn.lines[k] ?? 0) > 0)
  let tc: ScTc | null = null
  if (tcUsed) {
    // Worksheet line 1: federal total income plus lines b and d, minus lines f–j, m–q, s, t and w.
    const minus = ['f', 'g', 'i', 'm', 'o', 'p-1', 'p-2', 'p-4', 'p-5', 'q-1', 'q-2', 's', 't', 'w'].reduce((s, k) => s + (L[k] ?? 0), 0)
    const gross = pos(r(f['9']) + (L['d'] ?? 0) - minus)
    const ws = states.map((o) => {
      const l2 = Math.min(gross, r(pos(o.income)))
      const l3 = gross > 0 ? Math.min(100, Math.round(l2 / gross * 10000) / 100) : 0
      const l5 = r(L['10'] * l3 / 100)
      const l6 = r(pos(o.tax))
      return { state: o.state.trim(), l1: gross, l2, l3, l4: L['10'], l5, l6, l7: Math.min(l5, l6) }
    })
    const T: Record<string, number> = { '1': ws.reduce((s, w) => s + w.l7, 0) }
    for (const k of ['2', '3', '4', '5']) T[k] = r(pos(tcIn.lines[k] ?? 0))
    T['16'] = T['1'] + T['2'] + T['3'] + T['4'] + T['5'] + others.reduce((s, o) => s + r(o.amount), 0)
    T['17'] = L['10']
    T['18'] = Math.min(T['16'], T['17'])
    tc = { worksheets: ws, lines: T, other: others.map((o) => ({ description: o.description, code: o.code.replace(/\D/g, '').slice(0, 3), amount: r(o.amount) })) }
  }
  L['13'] = Math.min(tc ? tc.lines['18'] : r(pos(d.nonrefundableCredits)), pos(L['10'] - L['11'] - L['12']))
  L['14'] = L['11'] + L['12'] + L['13']
  L['15'] = pos(L['10'] - L['14'])

  // ── Payments ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  L['16'] = statements.reduce((s, x) => s + x.tax, 0)
  L['17'] = r(pos(d.estimatedPayments))
  L['18'] = r(pos(d.extensionPayment))
  L['20'] = r(pos(d.withholding1099))
  L['21'] = r(pos(d.tuitionCredit))
  L['22'] = r(pos(d.refundableCredits))
  L['23'] = L['16'] + L['17'] + L['18'] + L['20'] + L['21'] + L['22']
  L['24'] = pos(L['23'] - L['15'])
  L['25'] = pos(L['15'] - L['23'])
  L['26'] = r(pos(d.useTax))
  L['27'] = Math.min(r(pos(d.creditForward)), L['24'])
  L['28'] = r(pos(d.checkoffs))
  L['29'] = L['26'] + L['27'] + L['28']
  L['30'] = L['29'] <= L['24'] ? L['24'] - L['29'] : 0
  L['31'] = L['29'] > L['24'] ? L['25'] + L['29'] - L['24'] : L['25']
  L['34'] = L['31']

  // ── Notes ──
  if (L['16'] + L['20'] > 0) attach.push('W-2s and 1099s showing South Carolina tax withheld')
  if (L['13'] > 0) attach.push('SC1040TC and the credit schedules (and other state returns for that credit)')
  if (L['21'] > 0) attach.push('I-319 (tuition tax credit)')
  if (L['28'] > 0) attach.push('I-330 (check-off contributions)')
  if (L['e'] > 0) attach.push('An explanation of other additions (line e)')
  if (res.deduction.used === 'itemized' || ret.businesses.length > 0 || sd.net !== 0) attach.push('A complete copy of your federal return')
  if (L['e'] > 0 && f['13a'] > 0) issues.push(`South Carolina adds back the federal QBI deduction (${r(f['13a']).toLocaleString('en-US')}, line e).`)
  if (L['a'] > 0) issues.push(`State tax addback (line a): ${L['a'].toLocaleString('en-US')} of the income or sales tax on Schedule A.`)
  if (!d.countyCode.trim()) issues.push('Enter your county code (SC1040 instructions).')
  if (under6 > 0) issues.push('Dependents under 6 are deducted again on line t; the SC1040 asks for each dependent’s date of birth.')
  if (ret.retirement.some((x) => x.code === '1')) issues.push('Retirement income with an early withdrawal penalty does not qualify for the retirement deduction: check lines p-1 and p-2.')
  if (L['34'] > 500 && L['17'] === 0) issues.push('A balance due may mean an underpayment penalty (SC2210).')

  return { tc, lines: L, dependents: { count: depCount, under6, age65: owners.filter(is65).length }, statements, issues, attach }
}
