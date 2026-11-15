/**
 * Michigan Form MI-1040, full-year resident income tax return, tax year 2025, with the MI-1040CR homestead
 * property tax credit.
 *
 * Source: 2025 MI-1040, Schedule 1, Form 4884 and MI-1040CR, with the 2025 MI-1040 and MI-1040CR
 * instruction books ($5,800 exemptions, flat 4.25%, Michigan EITC at 30% of federal, the retirement and
 * pension subtraction — Section A for those born before 1946, Section D at 75% of $65,897 / $131,794 for
 * those born 1946–1966 — the senior interest and dividend deduction, and the homestead credit with its
 * 3.2% / Table 2 threshold, Table A senior percentages, 60% for other claimants, the $1,900 maximum and
 * Table B phase-out over $62,500). Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

export const MI_RATE = 0.0425
export const MI_EXEMPTION = 5800
export const MI_SPECIAL_EXEMPTION = 3400
export const MI_VETERAN_EXEMPTION = 500
export const MI_DEPENDENT_FILER_EXEMPTION = 1500
export const MI_EITC_RATE = 0.3
export const MI_RETIREMENT_MAX = { single: 65897, joint: 131794 }
export const MI_RETIREMENT_PHASE = 0.75
export const MI_SENIOR_INVESTMENT_MAX = { single: 14688, joint: 29376 }
export const MI_HOMESTEAD = { max: 1900, thrLimit: 71500, phaseStart: 62500, taxableValueLimit: 165400, renterShare: 0.23, otherShare: 0.6, rate: 0.032 }

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Table A: senior percentage by total household resources. */
export function miTableA(thr: number): number {
  if (thr <= 21000) return 1
  const steps = Math.ceil((thr - 21000) / 1000)
  return steps >= 10 ? 0.6 : Math.round((1 - steps * 0.04) * 100) / 100
}
/** Table B: phase-out percentage by total household resources. */
export function miTableB(thr: number): number {
  if (thr <= MI_HOMESTEAD.phaseStart) return 1
  if (thr > MI_HOMESTEAD.thrLimit) return 0
  return Math.round((1 - Math.ceil((thr - MI_HOMESTEAD.phaseStart) / 1000) * 0.1) * 10) / 10
}
/** Table 2: percent of household resources not refundable, for seniors and disabled claimants. */
export function miTable2(thr: number, special: boolean): number {
  if (!special) return MI_HOMESTEAD.rate
  if (thr <= 3000) return 0
  if (thr <= 4000) return 0.01
  if (thr <= 5000) return 0.02
  if (thr <= 6000) return 0.03
  return MI_HOMESTEAD.rate
}

export interface MiResult {
  lines: Record<string, number>
  exemptions: { count: number; special: number; veterans: number; dependentFiler: boolean }
  schedule1: { additions: Record<string, number>; subtractions: Record<string, number> }
  retirement: { section: 'A' | 'D' | ''; benefits: number; publicBenefits: number; deduction: number; olderBirthYear: number }
  homestead: { eligible: boolean; reason: string; thr: number; line13: number; line34: number; line35: number; senior: boolean; tableA: number; tableB: number; line42: number; credit: number; lines: Record<string, number> }
  issues: string[]
  attach: string[]
}

export function computeMichigan(ret: TaxReturnInput, res: TaxReturnResult): MiResult {
  const d = ret.mi
  const f = res.f1040
  const s1 = res.schedule1
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner): TaxReturnInput['taxpayer'] => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const birthYear = (o: Owner): number => d.birthYear[o] || (person(o).age ? 2025 - person(o).age : 0)

  // ── Exemptions (line 9) ──
  const dependentFiler = ret.canBeClaimedAsDependent
  const count = dependentFiler ? 0 : owners.length + ret.dependents.length
  L['9a'] = count * MI_EXEMPTION
  L['9b'] = r(pos(d.specialExemptions)) * MI_SPECIAL_EXEMPTION
  L['9c'] = r(pos(d.disabledVeterans)) * MI_VETERAN_EXEMPTION
  L['9d'] = 0
  L['9e'] = dependentFiler ? MI_DEPENDENT_FILER_EXEMPTION : 0
  L['9f'] = L['9a'] + L['9b'] + L['9c'] + L['9d'] + L['9e']

  // ── Schedule 1 additions ──
  const additions: Record<string, number> = { '1': r(pos(d.otherStateBondInterest)), '8': r(pos(d.otherAdditions)) }
  additions['9'] = additions['1'] + additions['8']

  // ── Retirement and pension subtraction (Form 4884) ──
  const years = owners.map(birthYear).filter((y) => y > 0)
  const olderBirthYear = years.length ? Math.min(...years) : 0
  const benefits = r(ret.retirement.filter((x) => owners.includes(x.owner)).reduce((s, x) => s + pos(x.taxableAmount), 0) - pos(d.militaryRetirement))
  const publicBenefits = Math.min(pos(benefits), r(owners.reduce((s, o) => s + pos(d.publicPensions[o]), 0)))
  const max = joint ? MI_RETIREMENT_MAX.joint : MI_RETIREMENT_MAX.single
  let section: 'A' | 'D' | '' = ''
  let retirementDeduction = 0
  if (benefits > 0 && olderBirthYear > 0 && olderBirthYear < 1946) {
    section = 'A'
    const line11 = pos(max - r(pos(d.militaryRetirement)))
    const line13 = pos(line11 - publicBenefits)
    retirementDeduction = publicBenefits + Math.min(line13, pos(benefits - publicBenefits))
  } else if (benefits > 0 && olderBirthYear > 0 && olderBirthYear < 1967) {
    section = 'D'
    const line4 = r(pos(max - r(pos(d.militaryRetirement))) * MI_RETIREMENT_PHASE)
    retirementDeduction = Math.min(line4, pos(benefits))
  }
  // Senior investment income deduction (born before 1946).
  let seniorInvestment = 0
  if (olderBirthYear > 0 && olderBirthYear < 1946) {
    const investment = r(pos(f['2b']) + pos(f['3b']) + pos(f['7a']))
    seniorInvestment = Math.min(investment, pos((joint ? MI_SENIOR_INVESTMENT_MAX.joint : MI_SENIOR_INVESTMENT_MAX.single) - retirementDeduction))
  }

  const subtractions: Record<string, number> = {
    '10': r(pos(d.usObligationInterest)), '11': r(pos(d.militaryRetirement)), '14': r(f['6b']), '16': r(pos(d.stateRefundInFagi)),
    '23': r(pos(d.otherSubtractions)), '27': retirementDeduction, '28': seniorInvestment
  }
  subtractions['29'] = subtractions['10'] + subtractions['11'] + subtractions['14'] + subtractions['16'] + subtractions['23'] + subtractions['27'] + subtractions['28']
  subtractions['31'] = subtractions['29']

  // ── Tax ──
  L['10'] = fagi
  L['11'] = additions['9']
  L['12'] = L['10'] + L['11']
  L['13'] = subtractions['31']
  L['14'] = pos(L['12'] - L['13'])
  L['15'] = L['9f']
  L['16'] = pos(L['14'] - L['15'])
  L['17'] = r(L['16'] * MI_RATE)
  L['18b'] = Math.min(r(pos(d.otherStateCredit)), L['17'])
  L['21'] = pos(L['17'] - L['18b'])
  L['22'] = r(pos(d.contributions))
  L['23'] = 0
  L['24'] = r(pos(d.useTax))
  L['25'] = L['21'] + L['22'] + L['23'] + L['24']

  // ── Homestead property tax credit (MI-1040CR) ──
  const older65 = owners.some((o) => person(o).age65OrOlder || person(o).age >= 65)
  const special = d.specialExemptions > 0
  const H: Record<string, number> = {}
  const ssGross = r(f['6a'])
  H['14'] = r(f['1z'])
  H['15'] = r(pos(f['2b']) + pos(f['2a']) + pos(f['3b']))
  H['16'] = r(pos(s1.businessIncome))
  H['17'] = r(pos(s1.rentalIncome))
  H['18'] = r(pos(f['4b']) + pos(f['5b']))
  H['19'] = r(pos(f['7a']))
  H['21'] = ssGross
  H['23'] = r(s1.unemployment)
  H['25'] = r(pos(d.otherHouseholdResources))
  H['28'] = H['14'] + H['15'] + H['16'] + H['17'] + H['18'] + H['19'] + H['21'] + H['23'] + H['25']
  H['30'] = r(pos(s1.totalAdjustments))
  H['31'] = r(pos(d.medicalPremiums))
  H['33'] = pos(H['28'] - H['30'] - H['31'])
  const thr = H['33']
  H['10'] = d.housing === 'own' ? r(pos(d.propertyTax)) : 0
  H['11'] = d.housing === 'rent' ? r(pos(d.rentPaid)) : 0
  H['12'] = r(H['11'] * MI_HOMESTEAD.renterShare)
  H['13'] = H['10'] + H['12']
  let reason = ''
  if (d.housing === 'none') reason = 'No property tax or rent entered.'
  else if (d.housing === 'own' && d.taxableValue > MI_HOMESTEAD.taxableValueLimit) reason = 'The taxable value of your home is over $165,400.'
  else if (thr > MI_HOMESTEAD.thrLimit) reason = 'Total household resources are over $71,500.'
  else if (dependentFiler) reason = 'Not available to someone who can be claimed as a dependent.'
  H['34'] = r(thr * miTable2(thr, older65 || special))
  H['35'] = pos(H['13'] - H['34'])
  if (!reason && H['35'] === 0) reason = 'Your property tax (or 23% of rent) is not more than the share of household resources you pay yourself.'
  const tableA = miTableA(thr)
  let line42 = 0
  if (!reason) {
    if (special) line42 = Math.min(MI_HOMESTEAD.max, H['35'])
    else if (older65) line42 = Math.min(MI_HOMESTEAD.max, r(H['35'] * tableA))
    else line42 = Math.min(MI_HOMESTEAD.max, r(H['35'] * MI_HOMESTEAD.otherShare))
  }
  const tableB = miTableB(thr)
  let credit = r(line42 * tableB)
  if (!reason && older65 && d.housing === 'rent') {
    // Worksheet 5: alternate credit for renters 65 or older.
    const alt = pos(H['11'] - r(thr * 0.4))
    credit = Math.min(MI_HOMESTEAD.max, Math.max(credit, alt))
  }
  H['37'] = older65 && !special ? r(tableA * 100) : 0
  H['42'] = line42
  H['43'] = r(tableB * 100)
  H['44'] = credit
  L['26'] = credit

  // ── Refundable credits and payments ──
  L['27'] = 0
  L['28a'] = r(res.eic.credit)
  L['28b'] = r(L['28a'] * MI_EITC_RATE)
  L['29'] = 0
  L['30'] = 0
  L['31'] = r(pos(d.withholding))
  L['32'] = r(pos(d.estimatedPayments))
  L['33c'] = 0
  L['34'] = L['26'] + L['27'] + L['28b'] + L['29'] + L['30'] + L['31'] + L['32'] + L['33c']
  L['36'] = pos(L['25'] - L['34'])
  L['37'] = pos(L['34'] - L['25'])
  L['38'] = Math.min(r(pos(d.creditForward)), L['37'])
  L['39'] = L['37'] - L['38']

  // ── Notes ──
  if (L['11'] > 0 || L['13'] > 0) attach.push('Schedule 1, additions and subtractions')
  if (retirementDeduction > 0) attach.push('Form 4884, retirement and pension schedule')
  if (L['26'] > 0) attach.push('MI-1040CR, homestead property tax credit claim')
  if (L['31'] > 0) attach.push('Schedule W, withholding tax schedule (do not send W-2s)')
  if (L['22'] > 0) attach.push('Form 4642, voluntary contributions')
  if (subtractions['14'] > 0) issues.push('Michigan does not tax Social Security; the taxable part is subtracted on Schedule 1, line 14.')
  if (section === 'D') issues.push(`Retirement subtraction (Form 4884, Section D): up to 75% of $${max.toLocaleString('en-US')} for people born before 1967 — ${retirementDeduction.toLocaleString('en-US')}.`)
  if (section === 'A') issues.push(`Retirement subtraction (Form 4884, Section A, born before 1946): ${retirementDeduction.toLocaleString('en-US')}.`)
  if (benefits > 0 && !section && olderBirthYear === 0) issues.push('Enter your year of birth so the Michigan retirement subtraction can be figured.')
  if (benefits > 0 && !section && olderBirthYear >= 1967) issues.push('Retirement benefits are taxed in Michigan for people born in 1967 or later (the subtraction reaches them in 2026).')
  if (olderBirthYear >= 1953 && olderBirthYear <= 1959 && owners.some((o) => person(o).age >= 67)) issues.push('You may instead qualify for the Tier 3 Michigan Standard Deduction (Schedule 1 line 26); compare it with the retirement subtraction in the MI-1040 instructions.')
  if (d.housing !== 'none' && reason) issues.push(`Homestead property tax credit: ${reason}`)
  if (L['28b'] > 0) issues.push(`Michigan EITC: 30% of your federal credit (${L['28b'].toLocaleString('en-US')}).`)
  if (!d.schoolDistrictCode.trim()) issues.push('Enter your five-digit school district code (MI-1040 instructions); Michigan requires it.')
  issues.push('Some Michigan cities (Detroit, Grand Rapids, Lansing and others) also tax income on their own city return.')

  return {
    lines: L,
    exemptions: { count, special: r(pos(d.specialExemptions)), veterans: r(pos(d.disabledVeterans)), dependentFiler },
    schedule1: { additions, subtractions },
    retirement: { section, benefits: pos(benefits), publicBenefits, deduction: retirementDeduction, olderBirthYear },
    homestead: { eligible: !reason, reason, thr, line13: H['13'], line34: H['34'], line35: H['35'], senior: older65, tableA, tableB, line42, credit, lines: H },
    issues, attach
  }
}
