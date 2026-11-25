/**
 * Alabama Form 40, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form 40 and schedules (A, B, DS, HOF, W-2, RS) and the 2025 Form 40A booklet (standard deduction
 * chart, dependent exemption chart and tax table, which Form 40 shares), with the 2024 Form 40 booklet for line
 * instructions that did not change: Alabama income (state wages; U.S. obligation interest, Social Security,
 * unemployment, state refunds and defined benefit / government pensions are not taxed; $6,000 retirement exclusion
 * at 65), adjustments, the larger of Schedule A (medical over 4%, real estate, FICA and self-employment tax, mortgage
 * and qualified vehicle loan interest, gifts) and the standard deduction chart, the federal income tax deduction,
 * personal and dependent exemptions, and tax at 2% / 4% / 5% (table below $100,000). Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
type FilingStatus = TaxReturnInput['filingStatus']
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Alabama filing status: no qualifying surviving spouse status (head of family with a dependent, else single). */
export type AlStatus = 'single' | 'mfj' | 'mfs' | 'hof'
export function alStatus(fs: FilingStatus, dependents: number): AlStatus {
  if (fs === 'mfj' || fs === 'mfs' || fs === 'single') return fs
  return dependents > 0 ? 'hof' : 'single'
}

/** Line 11 standard deduction chart (Alabama AGI, line 10). */
export function alStandardDeduction(status: AlStatus, agi: number): number {
  const [full, start, step, cut] = { mfj: [8500, 26000, 500, 175], mfs: [4250, 13000, 250, 88], hof: [5200, 26000, 500, 135], single: [3000, 26000, 500, 25] }[status]
  if (agi < start) return full
  return Math.max(status === 'mfj' ? 5000 : 2500, full - cut * (Math.floor((agi - start) / step) + 1))
}

export function alDependentExemption(agi: number): number {
  return agi <= 50000 ? 1000 : agi <= 100000 ? 500 : 300
}

function rateTax(x: number, mfj: boolean): number {
  const [a, b] = mfj ? [1000, 6000] : [500, 3000]
  return Math.min(x, a) * 0.02 + pos(Math.min(x, b) - a) * 0.04 + pos(x - b) * 0.05
}

/** Line 17: the tax table below $100,000 (rows of $50 to $100, then $100, at the midpoint), then the worksheet. */
export function alTax(taxable: number, mfj: boolean): number {
  const t = pos(r(taxable))
  if (t >= 100000) return r((mfj ? 4918 : 4958) + (t - 100000) * 0.05)
  if (t < 100) return Math.floor(rateTax(t < 50 ? 25 : 75, mfj))
  const lo = Math.floor(t / 100) * 100
  return r(rateTax(lo + 50, mfj))
}

/** Schedule A line 11c: qualified vehicle loan interest worksheet. */
export function alVehicleInterest(interest: number, agi: number, mfj: boolean): number {
  const line2 = Math.min(r(pos(interest)), 10000)
  const over = pos(agi - (mfj ? 200000 : 100000))
  return pos(line2 - Math.ceil(over / 1000) * 200)
}

export interface AlRetirementRow { id: string; owner: Owner; payer: string; ira: boolean; code: string; gross: number; taxable: number; stateId: string; fein: string; stateTax: number; reason: string }

export interface AlScheduleDRow { kind: string; acquired: string; sold: string; received: number; depreciation: number; basis: number; improvements: number; net: number }
export interface AlScheduleEProperty { description: string; personalUse: boolean; lines: Record<string, number> }
export interface AlScheduleEEntity { name: string; kind: 'partnership' | 'scorp'; ein: string; amount: number }

export interface AlResult {
  status: AlStatus
  lines: Record<string, number>
  /** Page 2 Part I (other income) and Part II (adjustments). */
  partI: Record<string, number>
  partII: Record<string, number>
  schA: Record<string, number>
  /** Schedule D rows (line 1 = partI['3']) and Schedule E (line 25 = partI['5']). */
  schD: AlScheduleDRow[]
  schE: { properties: AlScheduleEProperty[]; entities: AlScheduleEEntity[]; line23: number; line24: number; line25: number }
  itemize: boolean
  /** Schedule B rows: payer, exempt and taxable amounts. */
  interestRows: { payer: string; exempt: number; taxable: number }[]
  dividendRows: { payer: string; amount: number }[]
  /** Schedule RS: exempt rows (Part I) and taxable rows by owner (Parts II/III), lines 9–11 by owner. */
  rsExempt: AlRetirementRow[]
  rsTaxable: Record<Owner, AlRetirementRow[]>
  rs: Record<Owner, { taxable: number; exclusion: number; net: number; withheld: number }>
  statements: { owner: Owner; ssn: string; employer: string; ein: string; stateId: string; tax: number; federal: number; state: number }[]
  fit: Record<string, number>
  issues: string[]
  attach: string[]
}

export function computeAlabama(ret: TaxReturnInput, res: TaxReturnResult): AlResult {
  const d = ret.al
  const f = res.f1040
  const fs = ret.filingStatus
  const status = alStatus(fs, ret.dependents.length)
  const joint = status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const P1: Record<string, number> = {}
  const P2: Record<string, number> = {}
  const A: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const ssnOf = (o: Owner): string => person(o).ssn

  // ── Schedule W-2 ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, ssn: ssnOf(w.owner), employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', tax: r(pos(x?.stateTax ?? 0)), federal: r(w.wages), state: r(x?.stateIncome ?? w.wages) }
  })

  // ── Schedule RS ──
  const rows: AlRetirementRow[] = ret.retirement.filter((x) => owners.includes(x.owner)).map((x) => {
    const i = d.retirement[x.id]
    return { id: x.id, owner: x.owner, payer: x.payer, ira: x.ira, code: x.code, gross: r(pos(x.grossDistribution)), taxable: r(pos(x.taxableAmount)), stateId: i?.stateId ?? '', fein: i?.fein ?? '', stateTax: r(pos(i?.stateTax ?? 0)), reason: i?.reason ?? '' }
  })
  const rsExempt = rows.filter((x) => d.retirement[x.id]?.exempt)
  const rsTaxable: Record<Owner, AlRetirementRow[]> = { taxpayer: [], spouse: [] }
  for (const x of rows) if (!d.retirement[x.id]?.exempt && !/G/.test(x.code)) rsTaxable[x.owner].push(x)
  const is65 = (o: Owner): boolean => person(o).age65OrOlder || person(o).age >= 65
  const rs = { taxpayer: { taxable: 0, exclusion: 0, net: 0, withheld: 0 }, spouse: { taxable: 0, exclusion: 0, net: 0, withheld: 0 } }
  for (const o of owners) {
    const t = rsTaxable[o].reduce((s, x) => s + x.taxable, 0)
    const exclusion = is65(o) ? Math.min(6000, t) : 0
    rs[o] = { taxable: t, exclusion, net: t - exclusion, withheld: rsTaxable[o].reduce((s, x) => s + x.stateTax, 0) }
  }
  const rsExemptWithheld = rsExempt.reduce((s, x) => s + x.stateTax, 0)

  // ── Schedule B ──
  const interestRows = ret.interest.map((x) => {
    const i = d.interest[x.id]
    const us = Math.min(r(pos(i?.usObligation ?? 0)), r(pos(x.interest)))
    const muni = Math.min(r(pos(i?.taxableMuni ?? 0)), r(pos(x.taxExemptInterest)))
    return { payer: x.payer, exempt: us + r(pos(x.taxExemptInterest)) - muni, taxable: r(pos(x.interest)) - us + muni }
  })
  const dividendRows = ret.dividends.map((x) => ({ payer: x.payer, amount: r(pos(x.ordinaryDividends)) }))

  // ── Income ──
  L['5a'] = statements.reduce((s, x) => s + x.tax, 0)
  L['5b'] = statements.reduce((s, x) => s + x.state, 0)
  L['6'] = interestRows.reduce((s, x) => s + x.taxable, 0) + dividendRows.reduce((s, x) => s + x.amount, 0)
  const s1 = res.schedule1
  P1['1'] = 0
  P1['2'] = r(s1.businessIncome)
  // ── Schedule D: every sale, gain or loss in full (no $3,000 loss limit or carryover in Alabama) ──
  const schD: AlScheduleDRow[] = ret.capitalTransactions.map((t) => ({
    kind: t.description, acquired: t.dateAcquired, sold: t.dateSold, received: r(t.proceeds), depreciation: 0, basis: r(t.costBasis - (t.adjustment || 0)), improvements: 0,
    net: r(t.proceeds) - r(t.costBasis - (t.adjustment || 0))
  }))
  const capDist = r(ret.dividends.reduce((s, x) => s + pos(x.capitalGainDistributions), 0))
  if (capDist) schD.push({ kind: 'Capital gain distributions (1099-DIV box 2a)', acquired: '', sold: '', received: capDist, depreciation: 0, basis: 0, improvements: 0, net: capDist })
  const k1Gains = r(ret.k1s.reduce((s, k) => s + k.shortTermGain + k.longTermGain, 0))
  if (k1Gains) schD.push({ kind: 'Capital gain or (loss) from Schedules K-1', acquired: '', sold: '', received: k1Gains, depreciation: 0, basis: 0, improvements: 0, net: k1Gains })
  if (r(s1.otherGains)) schD.push({ kind: 'Gain or (loss) from Form 4797 (business property)', acquired: '', sold: '', received: r(s1.otherGains), depreciation: 0, basis: 0, improvements: 0, net: r(s1.otherGains) })
  P1['3'] = schD.reduce((s, x) => s + x.net, 0)
  P1['4'] = rs.taxpayer.net + (joint ? rs.spouse.net : 0)
  // ── Schedule E: rentals and royalties property by property (Part I) and pass-through entities (Part II) ──
  const schEProps: AlScheduleEProperty[] = ret.rentals.map((p) => {
    const e = p.expenses
    const rr = res.scheduleE.properties.find((x) => x.id === p.id)
    const lines: Record<string, number> = {
      '3': r(p.rents), '4': r(p.royalties), '5': r(e.advertising), '6': r(e.auto), '7': r(e.cleaning), '8': r(e.commissions), '9': r(e.insurance),
      '10': r(e.legal), '11': r(e.management), '12': r(e.mortgageInterest), '13': r(e.otherInterest), '14': r(e.repairs), '15': r(e.supplies),
      '16': r(e.taxes), '17': r(e.utilities), '18': r(e.other)
    }
    lines['19'] = ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18'].reduce((s, k) => s + lines[k], 0)
    lines['20'] = r(e.depreciation + (rr?.assetDepreciation ?? 0))
    lines['21'] = lines['19'] + lines['20']
    lines['22'] = lines['3'] + lines['4'] - lines['21']
    return { description: `${({ single: 'Single family', multi: 'Multi-family', vacation: 'Vacation/short-term', commercial: 'Commercial', land: 'Land', royalties: 'Royalties', selfrental: 'Self-rental', other: 'Other' } as Record<string, string>)[p.type] ?? p.type} — ${p.address}`.trim(), personalUse: p.personalUseDays > Math.max(14, p.fairRentalDays * 0.1), lines }
  })
  const schEEntities: AlScheduleEEntity[] = ret.k1s.map((k) => ({
    name: k.entityName, kind: k.kind, ein: k.ein,
    amount: r(k.ordinary + k.rentalRealEstate + k.otherRental + k.guaranteedPayments + k.royalties)
  })).filter((x) => x.amount !== 0)
  const e23 = schEProps.reduce((s, x) => s + x.lines['22'], 0)
  const e24 = schEEntities.reduce((s, x) => s + x.amount, 0)
  const schE = { properties: schEProps, entities: schEEntities, line23: e23, line24: e24, line25: e23 + e24 }
  P1['5'] = schE.line25
  P1['6'] = 0
  P1['7'] = r(s1.additionalIncome - s1.businessIncome - s1.otherGains - s1.rentalIncome - s1.unemployment)
  P1['8'] = P1['1'] + P1['2'] + P1['3'] + P1['4'] + P1['5'] + P1['6'] + P1['7']
  L['7'] = P1['8']
  L['8'] = L['5b'] + L['6'] + L['7']

  // ── Adjustments (Part II) ──
  const adj = s1.adjustments
  P2['1a'] = r(pos(adj.iraDeduction ?? 0))
  P2['1b'] = 0
  P2['7'] = r(pos(adj.selfEmployedHealthInsurance ?? 0))
  P2['8'] = Math.min(r(pos(d.collegeSavings)), joint ? 10000 : 5000)
  P2['9'] = r(pos(d.smallEmployerHealth))
  P2['10'] = r(pos(d.homeRetrofit))
  P2['11'] = r(pos(d.catastropheSavings))
  P2['12'] = r(pos(adj.hsaDeduction ?? 0))
  P2['13'] = r(pos(d.homeBuyerSavings))
  P2['14'] = r(pos(d.firefighterInsurance))
  P2['15'] = r(pos(d.ableContributions))
  P2['16'] = ['1a', '1b', '7', '8', '9', '10', '11', '12', '13', '14', '15'].reduce((s, k) => s + P2[k], 0)
  L['9'] = P2['16']
  L['10'] = L['8'] - L['9']
  const agi = L['10']

  // ── Schedule A ──
  const it = ret.itemized
  A['1'] = r(pos(it.medical))
  A['2'] = agi
  A['3'] = r(pos(agi) * 0.04)
  A['4'] = pos(A['1'] - A['3'])
  A['5'] = r(pos(it.realEstateTax))
  const ssWithheld = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + w.socialSecurityWithheld + w.medicareWithheld, 0)
  const seTax = res.scheduleSE.filter((x) => owners.includes(x.owner)).reduce((s, x) => s + x.total, 0)
  A['6'] = r(pos(ssWithheld - res.schedule3.excessSocialSecurity + seTax))
  A['7'] = 0
  A['8'] = r(pos(it.personalPropertyTax))
  A['9'] = A['5'] + A['6'] + A['7'] + A['8']
  A['10a'] = r(pos(it.mortgageInterest))
  A['11a'] = r(pos(ret.schedule1A.carLoanInterest))
  A['11c'] = alVehicleInterest(A['11a'], agi, joint)
  A['14'] = A['10a'] + A['11c']
  A['15'] = r(pos(it.charityCash))
  A['16'] = r(pos(it.charityNonCash))
  A['18'] = A['15'] + A['16']
  A['25'] = r(pos(it.other))
  A['27'] = A['4'] + A['9'] + A['14'] + A['18'] + A['25']
  const standard = alStandardDeduction(status, agi)
  const itemize = A['27'] > standard
  L['11'] = itemize ? A['27'] : standard

  // ── Federal income tax deduction worksheet ──
  const F: Record<string, number> = {}
  F['1'] = r(pos(f['22']))
  F['2'] = r(pos(res.schedule2.netInvestmentIncomeTax))
  F['3'] = F['1'] + F['2']
  F['4a'] = r(pos(f['27a']))
  F['4b'] = r(pos(f['28']))
  F['4c'] = r(pos(f['29']))
  F['4d'] = r(pos(f['30'] ?? 0))
  F['5'] = F['4a'] + F['4b'] + F['4c'] + F['4d']
  F['6'] = pos(F['3'] - F['5'])
  L['12'] = F['6']
  L['13'] = status === 'mfj' || status === 'hof' ? 3000 : 1500
  L['14'] = ret.dependents.length * alDependentExemption(agi)
  L['15'] = L['11'] + L['12'] + L['13'] + L['14']
  L['16'] = pos(L['10'] - L['15'])
  L['17'] = alTax(L['16'], joint)
  L['18'] = pos(L['17'] - r(pos(d.nonrefundableCredits)))
  L['19'] = r(pos(d.useTax))
  L['21'] = L['18'] + L['19']
  L['22'] = L['5a'] + rs.taxpayer.withheld + (joint ? rs.spouse.withheld : 0) + rsExemptWithheld + r(pos(d.withholdingOther))
  L['23'] = r(pos(d.estimatedPayments))
  L['25'] = r(pos(d.refundableCredits))
  L['27'] = L['22'] + L['23'] + L['25']
  L['29'] = L['27']
  L['30'] = pos(L['21'] - L['29'])
  L['32'] = pos(L['29'] - L['21'])
  L['33'] = Math.min(r(pos(d.creditForward)), L['32'])
  L['35'] = L['32'] - L['33']

  // ── Notes ──
  if (L['22'] > 0) attach.push('W-2s and 1099s showing Alabama tax withheld')
  if (res.deduction.used === 'itemized' || L['12'] > 0) attach.push('Pages 1 and 2 and Schedule 1 of your federal Form 1040 (federal tax deduction, line 12)')
  if (P1['2'] !== 0) attach.push('Federal Schedule C (business income)')
  if (schEEntities.length) issues.push('Schedule E Part II uses the federal Schedule K-1 amounts; if the entity gave you an Alabama Schedule K-1 with different amounts, use those.')
  if (res.scheduleE.disallowed > 0) issues.push('Your federal rental loss is limited by the passive activity rules; Alabama Schedule E shows each property’s full income or loss. Check whether the limit also applies for Alabama.')
  if (ret.rentals.some((p) => p.assets.length > 0) || ret.capitalTransactions.length > 0) issues.push('Alabama did not adopt federal bonus depreciation for some years; if your Alabama depreciation or basis differs, adjust Schedule D column (e) or Schedule E line 20.')
  if (L['18'] < L['17']) attach.push('Schedule OC (credits)')
  if (L['19'] > 0) attach.push('Schedule ATP (use tax)')
  if (fs === 'qss') issues.push(`Alabama has no surviving spouse status: the return is filed as ${status === 'hof' ? 'head of family' : 'single'}.`)
  if (itemize) issues.push(`Itemizing saves ${(A['27'] - standard).toLocaleString('en-US')} over the Alabama standard deduction (${standard.toLocaleString('en-US')}); Alabama lets you deduct FICA and self-employment tax (${A['6'].toLocaleString('en-US')}).`)
  if (rows.some((x) => !(x.id in d.retirement))) issues.push('Mark each 1099-R that is exempt in Alabama (defined benefit pension, Alabama or federal government, military, TVA): those are not taxed.')
  if (s1.unemployment > 0) issues.push('Unemployment compensation is not taxed in Alabama.')
  if (A['11a'] > 0 && !d.vehiclePurchaseDate.trim()) issues.push('Enter the date the new vehicle was bought for the vehicle loan interest deduction (Schedule A line 11).')
  if (L['30'] > 500 && L['23'] === 0) issues.push('A balance due may mean an underpayment penalty (Form 2210AL).')

  return { schD, schE, status, lines: L, partI: P1, partII: P2, schA: A, itemize, interestRows, dividendRows, rsExempt, rsTaxable, rs, statements, fit: F, issues, attach }
}
