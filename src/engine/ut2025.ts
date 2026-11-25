/**
 * Utah Form TC-40, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 TC-40, TC-40A and TC-40W and the 2025 TC-40 instructions: federal AGI plus TC-40A Part 1 additions
 * (non-Utah municipal bond interest) less Part 2 subtractions (U.S. interest, railroad retirement); a flat 4.5% tax
 * less the taxpayer tax credit (6% of the $2,111 personal exemptions plus the federal deduction, less any state income
 * tax deducted, phased out at 1.3% above $18,213 / $36,426 / $27,320) or the qualified exempt taxpayer test;
 * apportionable nonrefundable credits (retirement credit for those born before 1953, Social Security benefits credit,
 * military retirement credit, earned income credit at 20% of the federal credit, $1,000 child tax credit for children
 * 5 and younger, my529 credit); the credit for tax paid to another state. Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const UT_RATE = 0.045
export const UT_EXEMPTION = 2111
export const UT_PHASEOUT: Record<TaxReturnInput['filingStatus'], number> = { single: 18213, mfj: 36426, mfs: 18213, hoh: 27320, qss: 36426 }
const FED_STANDARD: Record<TaxReturnInput['filingStatus'], number> = { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625, qss: 31500 }

export interface UtResult {
  /** TC-40S blocks. */
  tc40s: { state: string; lines: Record<string, number> }[]
  lines: Record<string, number>
  dependents: { a: number; b: number; c: number; d: number }
  exempt: boolean
  additions: { code: string; amount: number }[]
  subtractions: { code: string; amount: number }[]
  apportionable: { code: string; amount: number }[]
  nonapportionable: { code: string; amount: number }[]
  statements: { ein: string; stateId: string; employer: string; ssn: string; wages: number; tax: number }[]
  worksheets: Record<string, Record<string, number>>
  issues: string[]
  attach: string[]
}

export function computeUtah(ret: TaxReturnInput, res: TaxReturnResult): UtResult {
  const d = ret.ut
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const W: Record<string, Record<string, number>> = {}
  const agi = r(f['11a'])

  // ── Dependents (box 2) ──
  const ctcKids = ret.dependents.filter((x) => x.childRelationship && x.age < 17)
  const dep = { a: ctcKids.length, b: ret.dependents.length - ctcKids.length, c: ctcKids.filter((x) => x.age < 1).length, d: 0 }
  dep.d = dep.a + dep.b + dep.c

  // ── Income ──
  L['4'] = agi
  const additions: { code: string; amount: number }[] = []
  if (d.otherStateBondInterest > 0) additions.push({ code: '57', amount: r(d.otherStateBondInterest) })
  L['5'] = additions.reduce((s, x) => s + x.amount, 0)
  L['6'] = L['4'] + L['5']
  L['7'] = 0
  const kind = (id: string): string => d.retirementKind[id] ?? 'standard'
  const ofKind = (k: string): number => r(ret.retirement.filter((x) => owners.includes(x.owner) && kind(x.id) === k).reduce((s, x) => s + pos(x.taxableAmount), 0))
  const subtractions: { code: string; amount: number }[] = []
  if (d.usObligationInterest > 0) subtractions.push({ code: '71', amount: r(d.usObligationInterest) })
  const railroad = ofKind('railroad')
  if (railroad > 0) subtractions.push({ code: '78', amount: railroad })
  L['8'] = subtractions.reduce((s, x) => s + x.amount, 0)
  L['9'] = L['6'] - L['7'] - L['8']
  L['10'] = r(pos(L['9']) * UT_RATE)

  // ── Taxpayer tax credit ──
  L['11'] = dep.d * UT_EXEMPTION
  L['12'] = r(res.deduction.used === 'itemized' ? res.deduction.itemized : res.deduction.standard)
  L['13'] = L['11'] + L['12']
  L['14'] = res.deduction.used === 'itemized' && ret.itemized.stateLocalIncomeOrSalesTax > 0 ? pos(r(res.scheduleA.taxes) - r(pos(ret.itemized.realEstateTax)) - r(pos(ret.itemized.personalPropertyTax))) : 0
  L['15'] = L['13'] - L['14']
  L['16'] = r(L['15'] * 0.06)
  L['17'] = UT_PHASEOUT[fs]
  L['18'] = pos(L['9'] - L['17'])
  L['19'] = r(L['18'] * 0.013)
  L['20'] = pos(L['16'] - L['19'])
  const qe: Record<string, number> = { '1': agi, '2': fs === 'mfs' && res.deduction.used !== 'standard' ? 0 : FED_STANDARD[fs], '3': r(pos(res.schedule1A.senior)) }
  qe['4'] = qe['2'] + qe['3']
  qe['5'] = pos(qe['1'] - qe['4'])
  W['exempt'] = qe
  const exempt = qe['5'] === 0
  L['22'] = exempt ? 0 : pos(L['10'] - L['20'])

  // ── Apportionable nonrefundable credits (TC-40A Part 3) ──
  const apportionable: { code: string; amount: number }[] = []
  const add = (code: string, amount: number): void => { if (r(amount) > 0) apportionable.push({ code, amount: r(amount) }) }
  const bornBy1952 = (o: Owner): boolean => {
    const y = Number((d.birthDate[o].match(/(\d{4})\s*$/) ?? [])[1])
    return y > 0 ? y <= 1952 : (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age >= 73
  }
  const exemptInterest = r(pos(f['2a']))
  // Social Security benefits credit (AH) or retirement credit (18) — whichever is larger.
  const ss: Record<string, number> = {}
  ss['1'] = r(pos(f['6b']))
  ss['4'] = r(ss['1'] * 0.045)
  ss['9'] = L['9'] - L['5'] + exemptInterest
  ss['10'] = { single: 54000, mfj: 90000, mfs: 45000, hoh: 90000, qss: 90000 }[fs]
  ss['11'] = pos(ss['9'] - ss['10'])
  ss['13'] = pos(ss['4'] - r(ss['11'] * 0.025))
  const military = ofKind('military')
  const mil = r(military * 0.045)
  const rc: Record<string, number> = {}
  const eligible = owners.filter(bornBy1952).length
  rc['1'] = eligible * 450
  rc['6'] = L['6'] - L['5'] + exemptInterest
  rc['7'] = { single: 25000, mfj: 32000, mfs: 16000, hoh: 32000, qss: 32000 }[fs]
  rc['10'] = pos(rc['1'] - r(pos(rc['6'] - rc['7']) * 0.025))
  W['ss'] = ss
  W['retirement'] = rc
  if (rc['10'] > ss['13'] + mil) add('18', rc['10'])
  else { add('AH', ss['13']); add('AJ', mil) }
  // Earned income credit (AM).
  const utWages = r(ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + pos(d.w2[w.id]?.stateIncome ?? w.wages), 0))
  add('AM', Math.min(r(pos(f['27a']) * 0.2), utWages))
  // Child tax credit (AT).
  const young = ret.dependents.filter((x) => x.childRelationship && x.age <= 5).length
  const ctc: Record<string, number> = { '1': young, '2': young * 1000, '7': L['6'] - L['5'] + exemptInterest, '8': { single: 43000, mfj: 54000, mfs: 27000, hoh: 43000, qss: 54000 }[fs] }
  ctc['9'] = pos(ctc['7'] - ctc['8'])
  ctc['10'] = r(ctc['9'] * 0.1)
  ctc['11'] = pos(ctc['2'] - ctc['10'])
  W['ctc'] = ctc
  add('AT', ctc['11'])
  add('20', pos(d.my529Credit))
  L['24'] = apportionable.reduce((s, x) => s + x.amount, 0)
  L['23'] = L['22']
  L['25'] = pos(L['23'] - L['24'])
  const nonapportionable: { code: string; amount: number }[] = []
  // ── TC-40S: one block per state ──
  const tc40s = d.otherStates.filter((o) => o.state.trim() && pos(o.tax) > 0 && pos(o.income) > 0).map((o) => {
    const c: Record<string, number> = { '1': r(pos(o.income)), '2': L['4'] }
    c['3'] = c['2'] > 0 ? Math.min(1, Math.round(c['1'] / c['2'] * 10000) / 10000) : 1
    c['4'] = L['22']
    c['5'] = r(c['4'] * c['3'])
    c['6'] = r(pos(o.tax))
    c['7'] = Math.min(c['5'], c['6'])
    return { state: o.state.trim().toUpperCase().slice(0, 2), lines: c }
  })
  const credit17 = Math.min(tc40s.reduce((s, x) => s + x.lines['7'], 0), L['25'])
  if (credit17 > 0) nonapportionable.push({ code: '17', amount: credit17 })
  if (d.otherCredit.amount > 0 && /^[0-9A-Z]{2}$/.test(d.otherCredit.code.toUpperCase())) nonapportionable.push({ code: d.otherCredit.code.toUpperCase(), amount: r(d.otherCredit.amount) })
  L['26'] = nonapportionable.reduce((s, x) => s + x.amount, 0)
  L['27'] = pos(L['25'] - L['26'])
  L['28'] = 0
  L['29'] = 0
  L['30'] = 0
  L['31'] = r(pos(d.useTax))
  L['32'] = L['27'] + L['28'] + L['29'] + L['30'] + L['31']

  // ── Payments ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { ein: x?.ein ?? '', stateId: x?.stateId ?? '', employer: w.employer, ssn: (w.owner === 'taxpayer' ? ret.taxpayer : ret.spouse).ssn, wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  }).filter((x) => x.tax > 0)
  L['33'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.withholding1099))
  L['34'] = r(pos(d.prepayments))
  L['35'] = 0
  L['36'] = 0
  L['37'] = 0
  L['38'] = L['33'] + L['34'] + L['35'] + L['36'] + L['37']
  L['39'] = pos(L['32'] - L['38'])
  L['40'] = 0
  L['41'] = L['39'] + L['40']
  L['42'] = pos(L['38'] - L['32'])
  L['43'] = 0
  L['44'] = L['42'] - L['43']

  // ── Notes ──
  if (L['33'] > 0) attach.push('TC-40W (withholding schedule); keep your W-2s and 1099s')
  if (L['5'] + L['8'] + L['24'] + L['26'] > 0) attach.push('TC-40A, page 1 (supplemental schedule)')
  if (tc40s.length) attach.push('A copy of each other state’s return (TC-40S)')
  if (exempt) issues.push('Federal AGI is not more than the federal standard deduction: you are a qualified exempt taxpayer and owe no Utah income tax.')
  if (apportionable.some((x) => x.code === '18')) issues.push('Retirement credit (code 18): enter your birthdate on TC-40A, Part 3; it cannot be combined with the Social Security or military retirement credit.')
  if (ret.retirement.some((x) => owners.includes(x.owner)) && Object.keys(d.retirementKind).length === 0) issues.push('Mark military or railroad retirement among your 1099-Rs: military retirement gets a 4.5% credit and railroad retirement is subtracted.')
  if (L['39'] > 0 && L['34'] === 0 && L['39'] > L['32'] * 0.1) issues.push('A balance due over 10% of your tax may mean a prepayment penalty.')

  return { tc40s, lines: L, dependents: dep, exempt, additions, subtractions, apportionable, nonapportionable, statements, worksheets: W, issues, attach }
}
