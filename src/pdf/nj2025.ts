/**
 * Maps a computed New Jersey return onto the 2025 NJ-1040 fill-in PDF (public/forms/2025/nj1040.pdf).
 * Amounts go into one-digit boxes, right-aligned with "00" in the cents boxes; the box order for each line
 * is in nj2025Boxes.ts.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { NjResult } from '../engine/nj2025.ts'
import { NJ_DONATION_LINES } from '../engine/nj2025.ts'
import { NJ_BOXES } from './nj2025Boxes.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const STATUS: Record<TaxReturnInput['filingStatus'], string> = { single: 'Choice1', mfj: 'Choice2', mfs: 'Choice3', hoh: 'Choice4', qss: 'Choice5' }
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}

/** Put a string into boxes, right-aligned. */
function boxes(values: Record<string, FieldValue>, names: readonly string[], text: string): void {
  const chars = text.split('')
  const start = names.length - chars.length
  if (start < 0) throw new Error(`"${text}" does not fit in ${names.length} boxes`)
  names.forEach((n, i) => { values[n] = i >= start ? chars[i - start] : '' })
}
/** Whole dollars into the line's boxes: digits plus "00" cents; zero leaves the line blank unless keepZero. */
function money(values: Record<string, FieldValue>, line: string, n: number | undefined, keepZero = false): void {
  const names = (NJ_BOXES.rows as Record<string, readonly string[]>)[line]
  if (!names) throw new Error(`no boxes for line ${line}`)
  const v = Math.round(Math.max(0, n ?? 0))
  if (v === 0 && !keepZero) { boxes(values, names, ''); return }
  boxes(values, names, `${v}00`)
}

export function formNj1040(ret: TaxReturnInput, res: TaxReturnResult, nj: NjResult, preparer?: PreparerInfo | null): FormFill {
  const L = nj.lines
  const d = ret.nj
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const last = upper(ret.taxpayer.lastName)
  const sLast = upper(ret.spouse.lastName)
  const name = joint
    ? `${last}, ${upper(first)}${mi ? ` ${mi}` : ''} & ${upper(sFirst)}${sMi ? ` ${sMi}` : ''}${sLast && sLast !== last ? ` ${sLast}` : ''}`
    : `${last}, ${upper(first)}${mi ? ` ${mi}` : ''}`
  const values: Record<string, FieldValue> = {
    'Last Name First Name Initial Joint Filers enter first name and middle initial of each Enter spousesCU partners last name ONLY if different': name,
    'SpousesCU Partners SSN if filing jointly': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')),
    'CountyMunicipality Code See Table page 50': upper(c.city),
    State: upper(c.state).slice(0, 2), 'ZIP Code': digits(c.zip).slice(0, 9),
    Group1: STATUS[fs],
    Groupda: ret.digitalAssets ? '#0' : '#1',
    'Check Box39': joint, 'Check Box41': nj.exemptions['7'].count > 0 && (ret.taxpayer.age >= 65 || ret.taxpayer.age65OrOlder),
    'Check Box42': joint && (ret.spouse.age >= 65 || ret.spouse.age65OrOlder),
    'Check Box43': ret.taxpayer.blind || d.disabled.taxpayer, 'Check Box44': joint && (ret.spouse.blind || d.disabled.spouse),
    'Check Box45': d.veteran.taxpayer, 'Check Box46': joint && d.veteran.spouse,
    Domestic: String(nj.exemptions['6'].count), 'x  1000': String(nj.exemptions['6'].amount),
    'Your Social Security Number': digits(ret.taxpayer.ssn), 'Names as shown on Form NJ1040': name,
    'Your Social Security Number_2': digits(ret.taxpayer.ssn), 'Names as shown on Form NJ1040_2': name,
    'Your Social Security Number_3': digits(ret.taxpayer.ssn), 'Names as shown on Form NJ1040_3': name
  }
  const ex: [string, string, readonly string[]][] = [['7', 'x  1000_2', ['undefined_9']], ['8', 'x  1000_3', ['undefined_10']], ['9', 'x  6000', ['undefined_11']], ['10', 'x  1500', ['Text47', 'undefined_12']], ['11', 'x  1500_2', ['Text48', 'undefined_13']], ['12', 'x  1000_4', ['Text49', 'undefined_14']]]
  for (const [line, amountField, countBoxes] of ex) {
    const e = nj.exemptions[line]
    if (e.count > 0) { values[amountField] = String(e.amount); boxes(values, countBoxes, String(e.count)) }
  }
  boxes(values, NJ_BOXES.ssn, digits(ret.taxpayer.ssn).slice(0, 9))
  if (joint) boxes(values, NJ_BOXES.spouseSsn, digits(ret.spouse.ssn).slice(0, 9))
  if (fs === 'mfs') boxes(values, NJ_BOXES.mfsSsn, digits(ret.spouse.ssn).slice(0, 9))
  boxes(values, NJ_BOXES.municipality, digits(d.municipalityCode).slice(0, 4))
  ret.dependents.slice(0, 4).forEach((x, i) => {
    const parts = x.name.trim().split(/\s+/)
    const lastName = parts.length > 1 ? parts.pop() ?? '' : ''
    values[`Last Name First Name Middle Initial ${i + 1}`] = upper(lastName ? `${lastName}, ${parts.join(' ')}` : x.name)
    boxes(values, NJ_BOXES.dependents[i].ssn, digits(x.ssn).slice(0, 9))
    const year = digits(d.dependentBirthYears[x.id] ?? '') || (x.age > 0 || x.age === 0 ? String(2025 - x.age) : '')
    boxes(values, NJ_BOXES.dependents[i].year, year.slice(0, 4))
  })
  money(values, '13', L['13'], true)
  for (const k of ['15', '16a', '16b', '17', '18', '19', '20a', '20b', '21', '22', '23', '24', '25', '26', '28a', '28b', '28c', '30', '31', '32', '40a', '41', '44', '51', '55', '56', '57', '58', '64', '65', '69', '78', '79', '80']) money(values, k, L[k])
  for (const k of ['27', '29', '38', '39', '42', '43', '45', '50', '54', '66']) money(values, k, L[k], true)
  if (L['67'] > 0) money(values, '67', L['67'])
  if (L['68'] > 0) money(values, '68', L['68'])
  for (const k of NJ_DONATION_LINES) money(values, k, L[k])
  if (L['65'] > 0) values[NJ_BOXES.count65] = String(L['65count'])
  if (d.housing !== 'none' && L['40a'] > 0) values.Group182 = d.housing === 'own' ? 'Choice1' : d.housing === 'rent' ? 'Choice2' : 'Choice3'
  if (d.missingCoverage) values['Check Box146aabb'] = true
  // Lines 70–74: the "Other" oval with the amount.
  const groups: Record<string, string> = { '70': 'Group168', '71': 'Group1681', '72': 'Group168170', '73': 'Group1681701', '74': 'Group16817012' }
  for (const k of NJ_DONATION_LINES) if (L[k] > 0) values[groups[k]] = '#2'
  if (d.electionFund.taxpayer) values.Group245 = 'Choice1'
  if (joint && d.electionFund.spouse) values.Group246 = 'Choice1'
  if (ret.usePaidPreparer && preparer) values['Firms Name'] = upper(preparer.firmName)
  return { id: 'nj1040', file: 'nj1040.pdf', title: 'New Jersey Form NJ-1040', values }
}

export function buildNjPacket(ret: TaxReturnInput, res: TaxReturnResult, nj: NjResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formNj1040(ret, res, nj, preparer)]
  const notIncluded = [...nj.attach]
  if (ret.dependents.length > 4) notIncluded.push('A statement listing the dependents beyond the first four')
  if (ret.nj.collegeDependents > 0) notIncluded.push('Line 12: the names of the dependents attending college are not filled in; check the instructions')
  notIncluded.push('Driver’s license number (voluntary) and signatures on page 4')
  return { forms, notIncluded }
}
