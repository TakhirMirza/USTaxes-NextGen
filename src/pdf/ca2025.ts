/**
 * Maps a computed California return onto the Franchise Tax Board fillable PDFs (2025): Form 540
 * (public/forms/2025/ca540.pdf), Schedule CA (540) (ca540ca.pdf), FTB 3514 (ca3514.pdf) and
 * FTB 3506 (ca3506.pdf). Amounts are whole dollars; negative amounts go in parentheses.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { caQualifyingChild } from '../engine/ca2025.ts'
import type { CaResult } from '../engine/ca2025.ts'
import { careQualifyingPerson } from '../engine/compute.ts'
import { parseBirthDate } from '../engine/va2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { careProvidersStatement, dependentsStatement, explainStatement, peopleStatement } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return v < 0 ? `(${-v})` : String(v)
}
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const splitName = (full: string): [string, string] => {
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? [parts.slice(0, -1).join(' '), parts[parts.length - 1]] : [full.trim(), '']
}
/** MM/DD/YYYY, as the FTB forms print dates. */
const date = (v: string): string => {
  const d = parseBirthDate(v)
  return d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}` : ''
}
const upper = (s: string): string => s.toUpperCase()
const displayName = (ret: TaxReturnInput): string => {
  const t = `${ret.taxpayer.firstName.trim()} ${ret.taxpayer.lastName.trim()}`.trim()
  return ret.filingStatus === 'mfj' && ret.spouse.firstName.trim() ? `${t} & ${ret.spouse.firstName.trim()} ${ret.spouse.lastName.trim()}`.trim() : t
}

const STATUS_OPTION: Record<number, string> = {
  1: '1 . Single.',
  2: '2 . Married/R D P filing jointly (even if only one spouse / R D P had income). See instructions.',
  3: '3 . Married or R D P filing separately.',
  4: '4 . Head of household (with qualifying person). See instructions.',
  5: '5 . Qualifying surviving spouse or R D P .'
}
const CONTRIBUTION_FIELD: Record<string, string> = {
  400: '540_form_4006', 401: '540_form_4007', 403: '540_form_4008', 405: '540_form_4009', 406: '540_form_4010', 407: '540_form_4011',
  408: '540_form_4012', 413: '540_form_4013', 422: '540_form_4014', 423: '540_form_4015', 424: '540_form_4016', 431: '540_form_4017',
  438: '540_form_4018', 439: '540_form_4019', 445: '540_form_4020', 447: '540_form_4021', 448: '540_form_4022', 449: '540_form_4023'
}
export const CA_CONTRIBUTION_CODES = Object.keys(CONTRIBUTION_FIELD)

export function form540(ret: TaxReturnInput, res: TaxReturnResult, ca: CaResult, preparer?: PreparerInfo | null): FormFill {
  const L = ca.lines
  const d = ret.ca
  const c = ret.contact
  const joint = ca.status === 2
  const showSpouse = joint || ca.status === 3
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const zip = digits(c.zip)
  const values: Record<string, FieldValue> = {
    '540_form_1003': upper(first), '540_form_1004': upper(mi), '540_form_1005': upper(ret.taxpayer.lastName.trim()), '540_form_1007': digits(ret.taxpayer.ssn),
    '540_form_1008': joint ? upper(sFirst) : '', '540_form_1009': joint ? upper(sMi) : '', '540_form_1010': joint ? upper(ret.spouse.lastName.trim()) : '',
    '540_form_1012': showSpouse ? digits(ret.spouse.ssn) : '',
    '540_form_1015': upper(c.street.trim()), '540_form_1016': upper(c.apt.trim()), '540_form_1018': upper(c.city.trim()), '540_form_1019': upper(c.state.trim()),
    '540_form_1020': zip.length > 5 ? `${zip.slice(0, 5)}-${zip.slice(5, 9)}` : zip,
    '540_form_1024': date(d.birthDate.taxpayer), '540_form_1025': joint ? date(d.birthDate.spouse) : '',
    '540_form_1028': upper(d.county.trim()), '540_form_1029 CB': true,
    '540_form_1036 RB': STATUS_OPTION[ca.status],
    '540_form_1037': ca.status === 3 ? upper(`${ret.spouse.firstName.trim()} ${ret.spouse.lastName.trim()}`.trim()) : '',
    '540_form_1040 CB': ret.canBeClaimedAsDependent,
    '540_form_1041': String(L['7box']), '540_form_1042': amt(L['7']),
    '540_form_1043': L['8box'] ? String(L['8box']) : '', '540_form_1044': amt(L['8']),
    '540_form_1045': L['9box'] ? String(L['9box']) : '', '540_form_1046': amt(L['9']),
    '540_form_2001': displayName(ret), '540_form_2002': digits(ret.taxpayer.ssn),
    '540_form_2015': L['10box'] ? String(L['10box']) : '', '540_form_2016': amt(L['10']), '540_form_2017': amt(L['11']),
    '540_form_2018': amt(L['12']), '540_form_2019': amt(L['13'], true), '540_form_2020': amt(L['14']), '540_form_2021': amt(L['15'], true),
    '540_form_2022': amt(L['16']), '540_form_2023': amt(L['17'], true), '540_form_2024': amt(L['18'], true), '540_form_2025': amt(L['19'], true),
    '540_form_2026 CB': ca.taxMethod === 'table', '540_form_2027 CB': ca.taxMethod === 'schedule',
    '540_form_2030': amt(L['31'], true), '540_form_2031': amt(L['32']), '540_form_2032': amt(L['33'], true), '540_form_2035': amt(L['34']), '540_form_2036': amt(L['35'], true),
    '540_form_2037': amt(L['40']),
    '540_form_2038': L['43'] ? upper(d.specialCredit.name) : '', '540_form_2039': L['43'] ? digits(d.specialCredit.code) : '', '540_form_2040': amt(L['43']),
    '540_form_3003': amt(L['45']), '540_form_3004': amt(L['46']), '540_form_3005': amt(L['47']), '540_form_3006': amt(L['48'], true),
    '540_form_3007': amt(L['61']), '540_form_3008': amt(L['62']), '540_form_3009': amt(L['63']), '540_form_3010': amt(L['64'], true),
    '540_form_3011': amt(L['71']), '540_form_3012': amt(L['72']), '540_form_3013': amt(L['73']), '540_form_3014': amt(L['74']),
    '540_form_3015': amt(L['75']), '540_form_3016': amt(L['76']), '540_form_3017': amt(L['77']), '540_form_3018': amt(L['78'], true),
    '540_form_3019': amt(L['91'], true),
    '540_form_3021 CB': d.fullYearCoverage, '540_form_3022': amt(L['92']),
    '540_form_3023': amt(L['93']), '540_form_3024': amt(L['94']), '540_form_3025': amt(L['95']), '540_form_3026': amt(L['96']), '540_form_3027': amt(L['97']),
    '540_form_4003': amt(L['98']), '540_form_4004': amt(L['99']), '540_form_4005': amt(L['100']), '540_form_4024': amt(L['110']),
    '540_form_5002': amt(L['111']), '540_form_5003': amt(L['112']), '540_form_5005': amt(L['113']), '540_form_5006': amt(L['114']), '540_form_5007': amt(L['115']),
    '540_form_6002': c.email.trim(), '540_form_6003': digits(c.phone).slice(-10)
  }
  if (L['91'] === 0) values['540_form_3020 RB'] = d.useTaxPaidDirectly ? 'You paid your use tax obligation directly to  California Department of Tax and Fee Administration ' : 'No use tax is owed.'
  ret.dependents.slice(0, 3).forEach((dep, i) => {
    const [f, l] = splitName(dep.name)
    const base = 2003 + i * 4
    values[`540_form_${base}`] = upper(f)
    values[`540_form_${base + 1}`] = upper(l)
    values[`540_form_${base + 2}`] = digits(dep.ssn)
    values[`540_form_${base + 3}`] = upper(dep.relationship)
  })
  const field = CONTRIBUTION_FIELD[d.contribution.code]
  if (field && L['110'] > 0) values[field] = amt(L['110'])
  const dd = ret.refundDeposit
  if (L['115'] > 0 && digits(dd.routingNumber).length === 9 && digits(dd.accountNumber)) {
    values['540_form_5008'] = digits(dd.routingNumber)
    values['540_form_5010'] = dd.accountNumber.replace(/[^0-9A-Za-z]/g, '')
    values[dd.accountType === 'savings' ? '540_form_5009B CB' : '540_form_5009A CB'] = true
    values['540_form_5011'] = amt(L['115'])
  }
  if (ret.usePaidPreparer && preparer) {
    Object.assign(values, {
      '540_form_6003B': upper(preparer.name), '540_form_6003C': digits(preparer.phone).slice(-10), '540_form_6004': upper(preparer.firmName),
      '540_form_6005': preparer.ptin.toUpperCase(), '540_form_6006': upper(preparer.firmAddress), '540_form_6007': digits(preparer.firmEin)
    })
  }
  return { id: 'ca540', file: 'ca540.pdf', title: 'California Form 540', values }
}

/** Schedule CA (540): Part I adjustments to income and, when itemizing, Part II. */
export function scheduleCA(ret: TaxReturnInput, res: TaxReturnResult, ca: CaResult): FormFill {
  const f = res.f1040
  const S = ca.scheduleCA.subtractions
  const A = ca.scheduleCA.additions
  const N = ca.scheduleCA.notAllowed
  const s1 = res.schedule1
  const F = (n: number): string => amt(n)
  const incomeB = Object.entries(S).reduce((t, [, n]) => t + n, 0)
  const incomeC = Object.values(A).reduce((t, n) => t + n, 0)
  const line8B = S.hsaDistributions + S.other
  const line8C = A.other
  const sectionCA = (N.educator ?? 0) + (N.hsaDeduction ?? 0)
  const values: Record<string, FieldValue> = {
    '540ca_form - 1000': displayName(ret), '540ca_form - 1001': digits(ret.taxpayer.ssn),
    // Section A
    '540ca_form - 1002': F(f['1a']),
    '540ca_form - 1023': A.hsaEmployer ? 'HSA' : '', '540ca_form - 1025': F(A.hsaEmployer),
    '540ca_form - 1027': F(f['1z']), '540ca_form - 1029': F(A.hsaEmployer),
    '540ca_form - 1031': F(f['2b']), '540ca_form - 1032': F(S.usInterest), '540ca_form - 1033': F(A.otherStateBonds),
    '540ca_form - 1035': F(f['3b']), '540ca_form - 1039': F(f['4b']), '540ca_form - 1043': F(f['5b']),
    '540ca_form - 1046': F(f['6a']), '540ca_form - 1047': F(f['6b']), '540ca_form - 1048': F(S.socialSecurity),
    '540ca_form - 1049': F(f['7a']),
    // Section B
    '540ca_form - 1052': F(S.stateRefund), '540ca_form - 1053': F(S.stateRefund),
    '540ca_form - 1056': F(s1.businessIncome), '540ca_form - 1059': F(s1.otherGains), '540ca_form - 1062': F(s1.rentalIncome),
    '540ca_form - 1068': F(s1.unemployment), '540ca_form - 1069': F(S.unemployment),
    '540ca_form - 2012': F(s1.hsaTaxable), '540ca_form - 2013': F(S.hsaDistributions),
    '540ca_form - 2037': S.other || A.other ? 'OTHER CA ADJUSTMENTS (STATEMENT)' : '', '540ca_form - 2039': F(S.other), '540ca_form - 2040': F(A.other),
    '540ca_form - 3002': F(line8B), '540ca_form - 3003': F(line8C),
    '540ca_form - 3007': F(f['9']), '540ca_form - 3008': F(incomeB), '540ca_form - 3009': F(incomeC),
    // Section C
    '540ca_form - 3010': F(N.educator), '540ca_form - 3011': F(N.educator),
    '540ca_form - 3015': F(N.hsaDeduction), '540ca_form - 3016': F(N.hsaDeduction),
    '540ca_form - 3019': F(res.schedule1.adjustments.deductibleHalfOfSeTax ?? 0), '540ca_form - 3022': F(res.schedule1.adjustments.selfEmployedHealthInsurance ?? 0),
    '540ca_form - 3029': F(res.schedule1.adjustments.iraDeduction ?? 0), '540ca_form - 3032': F(res.schedule1.adjustments.studentLoanInterest ?? 0),
    '540ca_form - 4029': F(s1.totalAdjustments), '540ca_form - 4030': F(sectionCA),
    '540ca_form - 4032': F(f['11a']), '540ca_form - 4033': amt(ca.lines['14']), '540ca_form - 4034': amt(ca.lines['16'])
  }
  if (ca.deduction.method === 'itemized') {
    const it = ret.itemized
    const sa = res.scheduleA
    const fagi = Math.round(f['11a'])
    const taxesA = sa.taxes
    const line5d = Math.round(it.stateLocalIncomeOrSalesTax + it.realEstateTax + it.personalPropertyTax)
    const line5eC = Math.max(0, line5d - taxesA)
    const line7B = Math.round(it.stateLocalIncomeOrSalesTax)
    const line17A = sa.medical + taxesA + sa.interest + sa.charity + sa.other
    const line18 = line17A - line7B + line5eC
    Object.assign(values, {
      '540ca_form - 5000 CB': res.deduction.used !== 'itemized',
      '540ca_form - 5001': F(it.medical), '540ca_form - 5002': F(fagi), '540ca_form - 5003': F(fagi * 0.075), '540ca_form - 5004': F(sa.medical),
      '540ca_form - 5006': F(it.stateLocalIncomeOrSalesTax), '540ca_form - 5007': F(line7B), '540ca_form - 5008': F(it.realEstateTax), '540ca_form - 5009': F(it.personalPropertyTax),
      '540ca_form - 5010': F(line5d), '540ca_form - 5011': F(taxesA), '540ca_form - 5012': F(line7B), '540ca_form - 5013': F(line5eC),
      '540ca_form - 5018': F(taxesA), '540ca_form - 5019': F(line7B), '540ca_form - 5020': F(line5eC),
      '540ca_form - 5021': F(sa.interest), '540ca_form - 5027': F(sa.interest), '540ca_form - 5033': F(sa.interest),
      '540ca_form - 6001': F(it.charityCash), '540ca_form - 6004': F(it.charityNonCash), '540ca_form - 6010': F(sa.charity),
      '540ca_form - 6016': F(sa.other),
      '540ca_form - 6019': F(line17A), '540ca_form - 6020': F(line7B), '540ca_form - 6021': F(line5eC),
      '540ca_form - 6022': F(line18), '540ca_form - 6031': F(line18),
      '540ca_form - 6032': ret.ca.itemizedAdjustment ? 'SEE STATEMENT' : '', '540ca_form - 6033': amt(ret.ca.itemizedAdjustment),
      '540ca_form - 6034': F(ca.deduction.itemizedBeforeLimit ?? 0), '540ca_form - 6035': F(ca.deduction.itemized ?? 0),
      '540ca_form - 6036': F(ca.lines['18'])
    })
  }
  return { id: 'ca540ca', file: 'ca540ca.pdf', title: 'California Schedule CA (540)', values }
}

/** FTB 3514: California EITC and Young Child Tax Credit. */
export function form3514(ret: TaxReturnInput, res: TaxReturnResult, ca: CaResult): FormFill {
  const L = ca.lines
  const e = ca.eitc
  const c = ret.contact
  const wages = Math.round(res.f1040['1a'])
  const business = e.earned - wages
  const values: Record<string, FieldValue> = {
    '3514_Form_1000': displayName(ret), '3514_Form_1001': digits(ret.taxpayer.ssn),
    '3514_Form_1002 CB': ret.filingStatus === 'mfs' && ret.ca.separatedSpouse,
    '3514_Form_1005': amt(res.f1040['11a'], true), '3514_Form_1006': amt(res.eic.credit), '3514_Form_1007': amt(e.investment, true),
    '3514_Form_2013': amt(wages), '3514_Form_2016': amt(wages), '3514_Form_2018': amt(business),
    '3514_Form_2027': amt(e.earned, true), '3514_Form_2028': amt(L['75'])
  }
  const kids = ret.dependents.filter(caQualifyingChild).slice(0, 3)
  const cols = [[1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015], [1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023], [1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031]]
  const addr = [[2001, 2002, 2003, 2004], [2005, 2006, 2007, 2008], [2009, 2010, 2011, 2012]]
  kids.forEach((k, i) => {
    const [fn, ln] = splitName(k.name)
    const [first, last, ssn, dob, q9a, q9b, rel, days] = cols[i]
    const born = parseBirthDate(ret.ca.dependentBirthDates[k.id] ?? '')
    const young = born ? born.getUTCFullYear() > 2006 : k.age < 19
    values[`3514_Form_${first}`] = upper(fn)
    values[`3514_Form_${last}`] = upper(ln)
    values[`3514_Form_${ssn}`] = digits(k.ssn)
    values[`3514_Form_${dob}`] = date(ret.ca.dependentBirthDates[k.id] ?? '')
    if (!young) {
      values[`3514_Form_${q9a} RB`] = k.student && k.age < 24 ? 'Yes' : 'No'
      if (!(k.student && k.age < 24)) values[`3514_Form_${q9b} RB`] = k.disabled ? 'Yes' : 'No'
    }
    values[`3514_Form_${rel}`] = upper(k.relationship)
    values[`3514_Form_${days}`] = String(Math.min(365, Math.round(k.monthsLivedWithYou * 365 / 12)))
    const [street, city, st, zip] = addr[i]
    values[`3514_Form_${street}`] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
    values[`3514_Form_${city}`] = upper(c.city)
    values[`3514_Form_${st}`] = upper(c.state)
    values[`3514_Form_${zip}`] = digits(c.zip).slice(0, 5)
  })
  if (L['76'] > 0) {
    values['3514_Form_3003'] = amt(e.earned, true)
    if (e.earned > 27425) {
      const l25 = e.earned - 27425
      const l26 = Math.floor(l25) / 100
      const l27 = Math.floor(Math.floor(l26 * 100 + 1e-6) / 100 * 21.71 * 100 + 1e-6) / 100
      values['3514_Form_3007'] = amt(l25)
      values['3514_Form_3008'] = String(Math.floor(l26))
      values['3514_Form_3009'] = String(Math.round((l26 % 1) * 100)).padStart(2, '0')
      values['3514_Form_3010'] = String(Math.floor(l27))
      values['3514_Form_3011'] = String(Math.round((l27 % 1) * 100)).padStart(2, '0')
    }
    values['3514_Form_3012'] = amt(L['76'])
  }
  return { id: 'ca3514', file: 'ca3514.pdf', title: 'California FTB 3514', values }
}

const DECIMAL = (n: number): string => String(Math.round(n * 100)).padStart(2, '0')

/** FTB 3506: Child and Dependent Care Expenses Credit (Parts 2 and 3). */
export function form3506(ret: TaxReturnInput, res: TaxReturnResult, ca: CaResult): FormFill {
  const f = res.form2441
  const values: Record<string, FieldValue> = {
    '3506 - 1000': displayName(ret), '3506 - 1001': digits(ret.taxpayer.ssn),
    '3506 - 1049': amt(f.line3), '3506 - 1050': amt(f.line4), '3506 - 1051': ret.filingStatus === 'mfj' ? amt(f.line5) : '',
    '3506 - 1052': amt(ca.care.expenses), '3506 - 1053': DECIMAL(ca.care.federalRate), '3506 - 1054': amt(Math.round(ca.care.expenses * ca.care.federalRate)),
    '3506 - 1055': DECIMAL(ca.care.percent), '3506 - 1056': amt(ca.care.credit), '3506 - 1058': amt(ca.care.credit)
  }
  const providers = ret.dependentCare.providers.slice(0, 2)
  const pf = [[1014, 1015, 1017, 1018, 1020], [1021, 1022, 1024, 1025, 1027]]
  providers.forEach((p, i) => {
    const [name, address, kind, id, paid] = pf[i]
    values[`3506 - ${name}`] = upper(p.name)
    values[`3506 - ${address}`] = upper(p.address)
    const isOrg = digits(p.tin).length === 9 && /^\d{2}-/.test(p.tin.trim())
    values[`3506 - ${kind} RB`] = isOrg ? (i === 0 ? 'Organization.\r' : 'Organization\r.') : 'Person\r.'
    values[`3506 - ${id}`] = digits(p.tin)
    values[`3506 - ${paid}`] = amt(p.amountPaid)
  })
  const persons = ret.dependents.filter(careQualifyingPerson).slice(0, 3)
  const pc = [[1028, 1029, 1030, 1031, 1032, 1034], [1035, 1036, 1037, 1038, 1039, 1041], [1042, 1043, 1044, 1045, 1046, 1048]]
  persons.forEach((p, i) => {
    const [fn, ln, ssn, dob, disabled, exp] = pc[i]
    const [first, last] = splitName(p.name)
    values[`3506 - ${fn}`] = upper(first)
    values[`3506 - ${ln}`] = upper(last)
    values[`3506 - ${ssn}`] = digits(p.ssn)
    values[`3506 - ${dob}`] = date(ret.ca.dependentBirthDates[p.id] ?? '')
    values[`3506 - ${disabled} CB`] = p.disabled
    if (persons.length === 1) values[`3506 - ${exp}`] = amt(ca.care.expenses)
  })
  return { id: 'ca3506', file: 'ca3506.pdf', title: 'California FTB 3506', values }
}

export function buildCaPacket(ret: TaxReturnInput, res: TaxReturnResult, ca: CaResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [form540(ret, res, ca, preparer)]
  if (ca.lines['14'] !== 0 || ca.lines['16'] !== 0 || ca.deduction.method === 'itemized') forms.push(scheduleCA(ret, res, ca))
  if (ca.lines['75'] > 0 || ca.lines['76'] > 0) forms.push(form3514(ret, res, ca))
  if (ca.lines['40'] > 0) forms.push(form3506(ret, res, ca))
  const filled = new Set(['Schedule CA (540), California adjustments', 'FTB 3514, California Earned Income Tax Credit', 'FTB 3506, Child and Dependent Care Expenses Credit'])
  const notIncluded = ca.attach.filter((a) => !filled.has(a))
  if (ca.lines['75'] > 0 || ca.lines['76'] > 0) notIncluded.push('FTB 3514 line 1a and 1b: tick whether the IRS or the FTB ever disallowed your earned income credit')
  if (ca.lines['40'] > 0) {
    notIncluded.push('FTB 3506: the care provider’s phone number and the address where care was given (Part 2), and each person’s percentage of physical custody (Part 3)')
    if (ret.dependentCare.employerBenefits > 0) notIncluded.push('FTB 3506 Part 4 (dependent care benefits) — fill it in from your federal Form 2441 Part III')
  }
  if (ca.deduction.method === 'itemized') {
  {
    const st = explainStatement(ret, 'ca.itemizedAdjustment', Math.abs(ret.ca.itemizedAdjustment), { id: 'st-ca-itemizedAdjustment', attachTo: 'Schedule CA (540), Part II, line 27', title: 'Other itemized deduction adjustments' })
    if (st.length) forms.push(...st)
    else if (Math.abs(ret.ca.itemizedAdjustment) > 0) notIncluded.push('A statement explaining the other itemized deduction adjustments (Schedule CA, Part II, line 27)')
  }
  }
  {
    const st = explainStatement(ret, 'ca.otherSubtractions', ret.ca.otherSubtractions, { id: 'st-ca-otherSubtractions', attachTo: 'Schedule CA (540), Part I, line 8z, column B', title: 'Other subtractions (column B)' })
    if (st.length) forms.push(...st)
    else if (ret.ca.otherSubtractions > 0) notIncluded.push('A statement explaining the other Schedule CA subtractions (line 8z, column B)')
  }
  {
    const st = explainStatement(ret, 'ca.otherAdditions', ret.ca.otherAdditions, { id: 'st-ca-otherAdditions', attachTo: 'Schedule CA (540), Part I, line 8z, column C', title: 'Other additions (column C)' })
    if (st.length) forms.push(...st)
    else if (ret.ca.otherAdditions > 0) notIncluded.push('A statement explaining the other Schedule CA additions (line 8z, column C)')
  }
  forms.push(...dependentsStatement(ret, 3, 'Form 540, Dependents (continued)', 'st-ca-deps'))
  if (forms.some((f) => f.id === 'ca3514')) forms.push(...peopleStatement(ret, ret.dependents.filter(caQualifyingChild).map((k) => ({ name: k.name, ssn: k.ssn, extra: ret.ca.dependentBirthDates[k.id] ?? '' })), 3, { id: 'st-ca-3514', attachTo: 'FTB 3514, Part III qualifying children (continued)', title: 'Qualifying children after the third', extraLabel: 'Date of birth' }))
  if (forms.some((f) => f.id === 'ca3506')) {
    forms.push(...careProvidersStatement(ret, 2, 'FTB 3506, Part II (continued)', 'st-ca-3506-prov'))
    forms.push(...peopleStatement(ret, ret.dependents.filter(careQualifyingPerson).map((k) => ({ name: k.name, ssn: k.ssn, extra: ret.ca.dependentBirthDates[k.id] ?? '' })), 3, { id: 'st-ca-3506-persons', attachTo: 'FTB 3506, Part III (continued)', title: 'Qualifying persons after the third', extraLabel: 'Date of birth' }))
  }
  return { forms, notIncluded }
}
