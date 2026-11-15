/**
 * Maps a computed Illinois return onto the Illinois Department of Revenue fillable PDFs (2025): Form IL-1040
 * (public/forms/2025/il1040.pdf), Schedule M (ilschm.pdf) and Schedule IL-E/EITC (ilschie.pdf).
 * Amounts are whole dollars.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { eicChild } from '../engine/compute.ts'
import type { IlResult } from '../engine/il2025.ts'
import { parseBirthDate } from '../engine/va2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return String(v)
}
const date = (v: string): string => {
  const d = parseBirthDate(v)
  return d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}` : ''
}
const ssnDashed = (s: string): string => { const x = digits(s); return x.length === 9 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x }
const splitName = (full: string): [string, string] => {
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? [parts.slice(0, -1).join(' '), parts[parts.length - 1]] : [full.trim(), '']
}
const fullName = (p: Person): string => `${p.firstName.trim()} ${p.lastName.trim()}`.trim()
const displayName = (ret: TaxReturnInput): string => ret.filingStatus === 'mfj' && ret.spouse.firstName.trim() ? `${fullName(ret.taxpayer)} & ${fullName(ret.spouse)}` : fullName(ret.taxpayer)
const older = (p: Person): boolean => p.age65OrOlder || p.age >= 65
const STATUS: Record<TaxReturnInput['filingStatus'], string> = { single: 'single', mfj: 'married filing jointly', mfs: 'married filing separately', qss: 'widowed', hoh: 'head of household' }

export function formIL1040(ret: TaxReturnInput, res: TaxReturnResult, il: IlResult, preparer?: PreparerInfo | null): FormFill {
  const L = il.lines
  const d = ret.il
  const c = ret.contact
  const joint = ret.filingStatus === 'mfj'
  const showSpouse = joint || ret.filingStatus === 'mfs'
  const values: Record<string, FieldValue> = {
    'step1-A-firstnamemi': ret.taxpayer.firstName.trim(), 'step1-A-lastname': ret.taxpayer.lastName.trim(), 'Step1-A-dob': date(d.birthDate.taxpayer), 'step1-A-ssn': ssnDashed(ret.taxpayer.ssn),
    'step1-A-spousefirstnamemi': showSpouse ? ret.spouse.firstName.trim() : '', 'step1-A-spouselastname': showSpouse ? ret.spouse.lastName.trim() : '',
    'step1-A-spousedob': joint ? date(d.birthDate.spouse) : '', 'step1-A-spousessn': showSpouse ? ssnDashed(ret.spouse.ssn) : '',
    'step1-A-mailingaddress': c.street.trim(), 'step1-A-aptno': c.apt.trim(), 'step1-A-city': c.city.trim(), 'step1-A-state': c.state.trim().toUpperCase(), 'step1-A-zip': digits(c.zip).slice(0, 9),
    'step1-A-county': d.county.trim(), 'step1-A-email': c.email.trim(),
    filing_status: STATUS[ret.filingStatus], dependent_you: ret.canBeClaimedAsDependent,
    'Federally adjusted income': amt(L['1'], true), 'Federally tax-exempt interest': amt(L['2']), 'Other additions': amt(L['3']), 'Total income': amt(L['4'], true),
    'step3-5': amt(L['5']), 'step3-6': amt(L['6']), 'step3-7': amt(L['7']), 'Total of your subtractions': amt(L['8']), 'Illinois base income': amt(L['9'], true),
    'Exemption amount': amt(L['10a']), 'over_65_you': older(ret.taxpayer), 'over_65_spouse': joint && older(ret.spouse), '65 or older exemption amount': amt(L['10b']),
    blind_you: ret.taxpayer.blind, blind: joint && ret.spouse.blind, 'Legally blind exemption amount': amt(L['10c']), 'Claiming dependents': amt(L['10d']),
    'Exemption allowance': amt(L['10'], true), 'Illinois net income from Schedule NR': amt(L['11'], true), 'Multiply residency rate': amt(L['12'], true),
    'Recapture of investment tax credits': amt(L['13']), 'Income tax': amt(L['14'], true),
    'Income tax paid to another state': amt(L['15']), 'Schedule ICR': amt(L['16']), 'Credit amount from Schedule 1299-C': amt(L['17']), 'Total of your credits': amt(L['18']),
    'Tax after nonrefundable credits': amt(L['19'], true), 'Household employment tax': amt(L['20']), 'Use tax': amt(L['21'], true), 'Compassionate Use of Medical Cannabis Program Act': amt(L['22']), 'Total Tax': amt(L['23'], true),
    'Total tax from Page 1': amt(L['24'], true), 'Illinois Income Tax withheld': amt(L['25']), 'Estimated payments': amt(L['26']), 'Pass-through withholding': amt(L['27']), 'Pass-through entity tax credit': amt(L['28']),
    'Earned Income Tax Credit from Schedule IL-E/EIC': amt(L['29']), 'Child Tax credit from Sch.IL-EITC': amt(L['30']), 'Total payments and refundable credit': amt(L['31'], true),
    'If Line 31 is greater': amt(L['32']), 'If Line 24 is greater': amt(L['33']), 'Late-payment penalty for underpayment': amt(L['34']), 'Voluntary charitable donations': amt(L['35']),
    'Total penalty and donations': amt(L['36']), 'Overpayment amount': amt(L['37']), 'Refunded to you': amt(L['38']), 'Amount to be credited forwarded': amt(L['40']), 'Amount you owe': amt(L['41'])
  }
  const dd = ret.refundDeposit
  if (L['38'] > 0) {
    const deposit = digits(dd.routingNumber).length === 9 && !!digits(dd.accountNumber)
    values.refund = deposit ? 'direct deposit' : 'paper check'
    if (deposit) {
      values['Routing number'] = digits(dd.routingNumber)
      values['Account number'] = dd.accountNumber.replace(/[^0-9A-Za-z]/g, '')
      values.account_type = dd.accountType === 'savings' ? 'savings' : 'checking'
    }
  }
  const phone = digits(c.phone).slice(-10)
  if (phone.length === 10) { values.DaytimeAreaCode_1 = phone.slice(0, 3); values.phone_number_1 = `${phone.slice(3, 6)}-${phone.slice(6)}` }
  if (ret.usePaidPreparer && preparer) {
    Object.assign(values, {
      'PrintType paid preparers namePaid Preparer Use Only': preparer.name, 'Paid Preparers PTINCheck if selfemployed': preparer.ptin.toUpperCase(),
      'Firms name': preparer.firmName, 'Firms address': preparer.firmAddress, 'Firms FEIN': digits(preparer.firmEin), 'Check if': preparer.selfEmployed
    })
  }
  return { id: 'il1040', file: 'il1040.pdf', title: 'Illinois Form IL-1040', values }
}

export function scheduleM(ret: TaxReturnInput, il: IlResult): FormFill {
  const m = il.scheduleM
  const ssn = digits(ret.taxpayer.ssn)
  return {
    id: 'ilschm', file: 'ilschm.pdf', title: 'Illinois Schedule M',
    values: {
      'Your name as shown on Form IL1040': displayName(ret), 'Your SSN-3': ssn.slice(0, 3), 'Your SSN-2': ssn.slice(3, 5), 'Your SSN-4': ssn.slice(5, 9),
      'Other income  Identify each item': m.additions ? 'SEE STATEMENT' : '', 'Other income': amt(m.additions), 'Total Additions. Add Lines 1 through 11': amt(m.additions),
      'Enter the lesser amount from Page 1, Line 13a or $10,000 ($20,000 if married filing a joint return': amt(m.collegeSavings),
      'U.S. Treasury bonds, bills, notes, savings bonds, and U.S. agency interest from federal Form 1040 or 1040-SR': amt(m.usInterest),
      'Add Lines 13 through 31 and enter the amount here': amt(m.collegeSavings + m.usInterest),
      'Enter the amount from Page 2, Line 32': amt(m.collegeSavings + m.usInterest),
      'Add Lines 33 through 41': amt(m.subtractions)
    }
  }
}

export function scheduleILE(ret: TaxReturnInput, res: TaxReturnResult, il: IlResult): FormFill {
  const L = il.lines
  const ssn = digits(ret.taxpayer.ssn)
  const values: Record<string, FieldValue> = {
    'Your name as shown on your Form IL1040': displayName(ret), 'Your SSN3': ssn.slice(0, 3), 'Your SSN2': ssn.slice(3, 5), 'Your SSN4': ssn.slice(5, 9),
    'X 2850': il.exemptions.dependentCount ? String(il.exemptions.dependentCount) : '', 'Mutiplied total number of dependents': amt(il.exemptions.dependents)
  }
  ret.dependents.slice(0, 10).forEach((dep, i) => {
    const n = i + 1
    const [f, l] = splitName(dep.name)
    values[`Dependents first nameRow${n}`] = f
    values[`Dependents last nameRow${n}`] = l
    values[`Social Security number or Individual Taxpayer Identification numberRow${n}`] = ssnDashed(dep.ssn)
    values[`Dependents relationship to youRow${n}`] = dep.relationship
    values[`Dependents date of birth mmddyyyyRow${n}`] = date(ret.il.dependentBirthDates[dep.id] ?? '')
    values[`full_time_${n}`] = dep.student
    values[`disability_${n}`] = dep.disabled
    values[n === 1 ? 'Number of months living with you' : `Number of months living with you_${n}`] = String(Math.min(12, dep.monthsLivedWithYou))
    values[`earned_c_${n}`] = L['29'] > 0 && eicChild(dep)
  })
  if (L['29'] > 0) {
    Object.assign(values, {
      'Wages - Salaries - Tips': amt(res.f1040['1z']), 'Business income/loss': amt(res.schedule1.businessIncome),
      'Statutory employee box marked': 'No',
      'Federal Earned Income Credit amount': amt(il.eitc.federal), 'Multiply L6': amt(L['29']),
      'Residents / Non-Residents rate - 1': '1', 'Residents / Non-Residents rate - 2': '0', 'Multiply L7 - L8': amt(L['29'])
    })
    if (il.eitc.expanded) {
      const earned = Math.round(res.eic.earnedIncome)
      Object.assign(values, {
        "Didn't qualify for federal EITC - Reason 2": true,
        'Federal Form 1040/1040-SR': amt(res.f1040['1z']), 'Subtract Line 2 from Line 1': amt(res.f1040['1z']), 'Add Lines 3 and 4': amt(res.f1040['1z']),
        'Add Lines 5 and 14': amt(earned, true), 'Is the amount on Line 15 less than the amount in Table 1 (below) for your filing statu(1).p3': 'Yes_2',
        'Enter your total earned income from Part 4, Line 15': amt(earned, true),
        'Enter the amount from federal Form 1040 or 1040-SR, Line 11a (AGI)': amt(res.f1040['11a'], true),
        'This is your federal EITC calculation. Enter this amount on Page 2, Step 4, Line': amt(il.eitc.federal)
      })
    }
  }
  if (L['30'] > 0) Object.assign(values, { 'One child is your dependent': true, 'Illinois Income Tax Credit': amt(L['29']), 'Mulitiply L11': amt(L['30']) })
  return { id: 'ilschie', file: 'ilschie.pdf', title: 'Illinois Schedule IL-E/EITC', values }
}

export function buildIlPacket(ret: TaxReturnInput, res: TaxReturnResult, il: IlResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formIL1040(ret, res, il, preparer)]
  if (il.lines['3'] > 0 || il.lines['7'] > 0) forms.push(scheduleM(ret, il))
  if (il.lines['10d'] > 0 || il.lines['29'] > 0) forms.push(scheduleILE(ret, res, il))
  const filled = new Set(['Schedule M, other additions and subtractions', 'Schedule IL-E/EITC, exemptions and earned income credit'])
  const notIncluded = il.attach.filter((a) => !filled.has(a))
  if (il.scheduleM.collegeSavings > 0) notIncluded.push('Schedule M line 13a: list each college savings account number and contribution')
  if (ret.dependents.length > 10) notIncluded.push('Schedule IL-E/EITC: dependents after the tenth')
  return { forms, notIncluded }
}
