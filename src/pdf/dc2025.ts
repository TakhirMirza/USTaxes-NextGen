/**
 * Maps a computed DC return onto the DC Office of Tax and Revenue fill-in Form D-40 (2025),
 * stored as public/forms/2025/dc40.pdf. Amounts are whole dollars; losses fill the "loss" oval.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { DcResult } from '../engine/dc2025.ts'
import { parseBirthDate } from '../engine/va2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(Math.abs(n))
  return v === 0 && !keepZero ? '' : String(v)
}
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const dob = (v: string): string => {
  const d = parseBirthDate(v)
  return d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${d.getUTCFullYear()}` : ''
}
const upper = (s: string): string => s.toUpperCase()

export function formD40(ret: TaxReturnInput, res: TaxReturnResult, dc: DcResult, preparer?: PreparerInfo | null): FormFill {
  const L = dc.lines
  const c = ret.contact
  const joint = dc.status === 2
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const zip = digits(c.zip)
  const values: Record<string, FieldValue> = {
    DAYTIME_PHONE: digits(c.phone).slice(-10),
    'TAX ID_NUM_1': digits(ret.taxpayer.ssn), Primary_DOB: dob(ret.dc.birthDate.taxpayer),
    'TAX ID NUMBER_2': joint || dc.status === 3 ? digits(ret.spouse.ssn) : '', Spouse_DOB: joint ? dob(ret.dc.birthDate.spouse) : '',
    fIRST_NAME: upper(first), MI: upper(mi), LAST_NAME: upper(ret.taxpayer.lastName.trim()),
    SPOUSE_FIRST_NAME: joint ? upper(sFirst) : '', SPOUSE_MI: joint ? upper(sMi) : '', SPOUSE_LAST_NAME: joint ? upper(ret.spouse.lastName.trim()) : '',
    ADDRESS_1: upper([c.street, c.apt].filter((x) => x.trim()).join(' ')), CITY_1: upper(c.city), STATE_1: upper(c.state), ZIP_1: zip.slice(0, 5), 'ZIP plus 4': zip.slice(5, 9),
    'EMAIL ADDRESS': c.email,
    FS: String(dc.status),
    'HSR Coverage': ret.dc.fullYearCoverage ? 'Choice1' : 'Choice2',
    WAGES_SALARY_TIPS: amt(L['a']),
    BUS_INCOME: amt(L['b']), BUS_LOSS: L['b'] < 0,
    LOSS_GAIN: amt(L['c']), LOSS_GAIN_LOSS: L['c'] < 0,
    BUS_HOLDINGS: amt(L['d']), BUS_HOLDINGS_LOSS: L['d'] < 0,
    HFED_ADJ_GORSS: amt(L['4'], true), HFED_ADY_GROSS_LOSS: L['4'] < 0,
    FRANTAXDED: amt(L['5']), 'Other ADD from Sch I, Cal A': amt(L['6']),
    'ADD-FEDAGI': amt(L['7'], true), ADD_FEDAGI_MINUS: L['7'] < 0,
    INCNON_RESI: amt(L['8']), TAXABLE_RCO: amt(L['9']), TAXABLE_SOC: amt(L['10']), TAX_CO_FID: amt(L['11']),
    SURV_BNEFT: amt(L['12']), UI_BNEFT: amt(L['13']), OTH_FROM_B: amt(L['14']), SUB_L_8_14: amt(L['15']),
    ADJUSTED_GROSS_INCOME: amt(L['16'], true), ASJUSTED_GROSS_INCOME_LOSS: L['16'] < 0,
    Deduction_Type: dc.deduction.method === 'itemized' ? 'I' : 'S',
    DED_AMT: amt(L['18'], true), 'DC TAXABLE INCOME': amt(L['19'], true), TAX_INCOME_LOSS: L['19'] < 0,
    'D40_Line 20': amt(L['20'], true),
    CHILDCARCAL: amt(L['21care']), 'Child Care Exp': amt(L['21']),
    NONREFCR: amt(L['22']), TOTAL_NR_CREDIT: amt(L['23']), D40_Line_24: amt(L['24'], true), 'DC HSR': amt(L['25'], true), D40_Line_26: amt(L['26'], true),
    QLFY_CHILD: L['27a'] && L['27d'] ? String(L['27a']) : '', EARNED_INC_AMT: L['27d'] || L['27e'] ? amt(L['27b']) : '',
    FED_EIC: amt(L['27c']), D40_Line_26d: amt(L['27d']), D40_Line_26e: amt(L['27e']), PROP_TX_CR: amt(L['28']),
    REFUNDABLECR: amt(L['29']), TOTALCR: amt(L['30']), DC_TAX_WITHHELD: amt(L['31']), EST_PMT: amt(L['32']), EXTEN: amt(L['33']),
    TOTAL_PAYMENT: amt(L['36'], true), TAX_DUE: amt(L['37']), OVERPAYMENT: amt(L['38']), EST_TAX: amt(L['39']),
    UNDERPAYMENT: amt(L['40']), CONT_AMT_REF: amt(L['41']), 'TOTAL AMOUNT DUE': amt(L['42']), NET_REFUND: amt(L['43'])
  }
  const d = ret.refundDeposit
  if (L['43'] > 0) {
    if (digits(d.routingNumber).length === 9 && digits(d.accountNumber)) {
      values.choice = '1'
      values['Direct Deposit'] = d.accountType === 'savings' ? 'S' : 'C'
      values.DD_ID_BANK = digits(d.routingNumber)
      values.DD_ID_ACCT_ORIG = d.accountNumber.replace(/[^0-9A-Za-z]/g, '')
    } else values.choice = '3'
  }
  if (ret.usePaidPreparer && preparer) {
    values.PREPARER_ID = preparer.ptin.toUpperCase()
    values.Preparer_Telephone = digits(preparer.phone).slice(-10)
  }
  return { id: 'dc40', file: 'dc40.pdf', title: 'DC Form D-40', values }
}

const splitName = (full: string): [string, string] => {
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? [parts.slice(0, -1).join(' '), parts[parts.length - 1]] : [full.trim(), '']
}

/** Schedule S: dependents (page 1) and Calculation G-1, the standard deduction (page 2). */
export function scheduleS(ret: TaxReturnInput, dc: DcResult): FormFill {
  const values: Record<string, FieldValue> = { 'LAST NAME': upper(ret.taxpayer.lastName.trim()), SSN: digits(ret.taxpayer.ssn) }
  ret.dependents.slice(0, 8).forEach((dep, i) => {
    const n = i + 1
    const [f, l] = splitName(dep.name)
    values[`FIRST NAME #${n}`] = upper(f)
    values[`LAST NAME #${n}`] = upper(l)
    values[`SSN #${n}`] = digits(dep.ssn)
    values[`RELATIONSHIP #${n}`] = upper(dep.relationship)
    values[`DOB #${n}`] = dob(ret.dc.dependentBirthDates[dep.id] ?? '')
  })
  if (dc.deduction.method === 'standard') {
    const b = dc.deduction.boxes
    const count = [b.you65, b.youBlind, b.spouse65, b.spouseBlind].filter(Boolean).length
    Object.assign(values, {
      'DEPENDENT OVAL': dc.status === 4 && ret.filingStatus === 'mfs',
      'G1-a': amt(dc.deduction.standard, true),
      'G1-b': b.you65 ? '1' : '', 'G1-c': b.youBlind ? '1' : '', 'G1-d': b.spouse65 ? '1' : '', 'G1-e': b.spouseBlind ? '1' : '',
      'G1-f': count ? String(count) : '', 'G1-g': amt(dc.deduction.additional),
      'G1-h': amt(dc.deduction.standard + dc.deduction.additional, true),
      'G1-i': ret.dependents.length ? String(ret.dependents.length) : ''
    })
  }
  return { id: 'dcschs', file: 'dcschs.pdf', title: 'DC Schedule S', values }
}

/** Schedule I: additions (Calculation A) and subtractions (Calculation B). */
export function scheduleI(ret: TaxReturnInput, dc: DcResult): FormFill {
  const A = dc.scheduleI.additions
  const B = dc.scheduleI.subtractions
  return {
    id: 'dcschi', file: 'dcschi.pdf', title: 'DC Schedule I',
    values: {
      'LAST NAME': upper(ret.taxpayer.lastName.trim()), TIN: digits(ret.taxpayer.ssn),
      'A_FED BONUS DEP': amt(A['3']), A_OTHER: amt(A['7']), 'A_TOTAL ADD': amt(A['9']),
      'B_TAX INT': amt(B['1']), 'B_COLLEGE SVGS': amt(B['6']), 'B_OTHER AMOUNT': amt(B['13']), 'B_TOTAL SUB': amt(B['16'])
    }
  }
}

/** Schedule H: property tax credit, Section A (rent) or Section B (real property tax owed). */
export function scheduleH(ret: TaxReturnInput, res: TaxReturnResult, dc: DcResult): FormFill {
  const d = ret.dc
  const c = ret.contact
  const joint = dc.status === 2
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const zip = digits(c.zip)
  const fagi = Math.max(0, Math.round(res.f1040['11a']))
  const values: Record<string, FieldValue> = {
    Phone_Number: digits(c.phone).slice(-10),
    SOC_SEC_NUM_1: digits(ret.taxpayer.ssn), Primary_DOB: dob(d.birthDate.taxpayer),
    'SSN_ Secondary': joint ? digits(ret.spouse.ssn) : '', Spouse_DOB: joint ? dob(d.birthDate.spouse) : '',
    FirstName_Primary: upper(first), MI_Primary: upper(mi), LastName_Primary: upper(ret.taxpayer.lastName.trim()),
    FirstName_Secondary: joint ? upper(sFirst) : '', MI_Secondary: joint ? upper(sMi) : '', LastName_Secondary: joint ? upper(ret.spouse.lastName.trim()) : '',
    Address_Line1: upper([c.street, c.apt].filter((x) => x.trim()).join(' ')), Address_City: upper(c.city), Address_State: upper(c.state),
    Address_ZIP: zip.slice(0, 5), '_ZIP plus 4': zip.slice(5, 9), 'EMAIL ADDRESS': c.email,
    'Property_Address#1': upper(d.propertyAddress),
    Property_Type: d.propertyType
  }
  if (d.housing === 'rent') {
    const l = d.landlord
    const lzip = digits(l.zip)
    Object.assign(values, {
      A_TOTAL_GI: amt(fagi, true), A_RENT_PAID: amt(d.housingAmount), A_TOTAL_RENT_PAID: amt(dc.propertyCredit.base, true), A_TAX_CREDIT_ALLOW: amt(dc.lines['28'], true),
      Landlord_Name: upper(l.name), Landlord_Address1: upper(l.street), Landlord_Apt: upper(l.apt), Landlord_Telephone: digits(l.phone).slice(-10),
      Landlord_City: upper(l.city), Landlord_State: upper(l.state), Landlord_ZIP: lzip.slice(0, 5), 'Landlord_ZIP plus 4': lzip.slice(5, 9)
    })
  } else {
    Object.assign(values, {
      B_TOTAL_GI: amt(fagi, true), B_PROP_TAX_PAID: amt(d.housingAmount), 'B-TAX-CREDIT': amt(dc.lines['28'], true),
      Square: d.ssl.square, Suffix: d.ssl.suffix, Lot: d.ssl.lot
    })
  }
  return { id: 'dcschh', file: 'dcschh.pdf', title: 'DC Schedule H', values }
}

export function buildDcPacket(ret: TaxReturnInput, res: TaxReturnResult, dc: DcResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formD40(ret, res, dc, preparer)]
  if (ret.dependents.length || dc.deduction.method === 'standard') forms.push(scheduleS(ret, dc))
  if (dc.lines['6'] > 0 || dc.lines['14'] > 0) forms.push(scheduleI(ret, dc))
  if (dc.lines['28'] > 0) forms.push(scheduleH(ret, res, dc))
  const notIncluded = [...dc.attach]
  forms.push(...dependentsStatement(ret, 8, 'Schedule S, Dependents (continued)', 'st-dc-deps'))
  return { forms, notIncluded }
}
