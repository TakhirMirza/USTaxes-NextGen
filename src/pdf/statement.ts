/**
 * Supporting statements: a plain page (public/forms/2025/statement.pdf) with the taxpayer's name and
 * SSN, the form and line it supports, and a table. Used where an official form runs out of rows
 * (dependents after the fourth, more sales, K-1s or passive activities than the form holds, …).
 * Each page is its own FormFill, 36 rows to a page.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { FormFill } from './irs2025.ts'

type Draw = NonNullable<FormFill['draw']>[number]

export interface StatementColumn {
  label: string
  /** Width in points (the table starts at x = 40 and may use up to 532 points). */
  width: number
  right?: boolean
}

export interface StatementSpec {
  /** Unique id prefix, e.g. "st-deps". */
  id: string
  /** Form and line the statement belongs to, e.g. "Form 1040, Dependents (continued)". */
  attachTo: string
  title: string
  columns: StatementColumn[]
  rows: string[][]
  /** Optional closing line (a total), printed under the last row. */
  total?: string[]
  /** Optional explanation printed under the title. */
  note?: string
}

const PER_PAGE = 36
const SIZE = 9

/** Rough Helvetica width, enough to keep text inside its column. */
const fit = (text: string, width: number, size: number): string => {
  const max = Math.floor(width / (size * 0.5))
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text
}

export const money0 = (n: number): string => {
  const v = Math.round(n)
  return v < 0 ? `(${Math.abs(v).toLocaleString('en-US')})` : v.toLocaleString('en-US')
}

export function statementForms(ret: TaxReturnInput, spec: StatementSpec): FormFill[] {
  const tp = ret.taxpayer
  const joint = ret.filingStatus === 'mfj'
  const name = joint ? `${tp.firstName} ${tp.lastName} & ${ret.spouse.firstName} ${ret.spouse.lastName}` : `${tp.firstName} ${tp.lastName}`
  const d = tp.ssn.replace(/\D/g, '')
  const ssn = d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d
  const pages = Math.max(1, Math.ceil(spec.rows.length / PER_PAGE))
  const out: FormFill[] = []
  for (let p = 0; p < pages; p++) {
    const draw: Draw[] = []
    const t = (x: number, y: number, text: string, size = SIZE, right = false): void => { if (text) draw.push({ page: 0, x, y, text, size, right }) }
    t(40, 750, `Statement attached to your 2025 return — ${spec.attachTo}`, 10)
    t(40, 732, name.trim().toUpperCase(), 10)
    t(572, 732, ssn, 10, true)
    t(40, 708, spec.title + (pages > 1 ? ` (page ${p + 1} of ${pages})` : ''), 12)
    let y = 690
    if (spec.note) { t(40, y, spec.note, 8); y -= 16 }
    // Column headings wrap onto two lines when they are wider than the column.
    let x = 40
    for (const c of spec.columns) {
      const max = Math.floor((c.width - 6) / (7 * 0.48))
      const words = c.label.split(' ')
      let first = ''
      while (words.length && (first ? `${first} ${words[0]}` : words[0]).length <= max) first = first ? `${first} ${words.shift()}` : words.shift()!
      const second = words.join(' ')
      const lx = c.right ? x + c.width - 4 : x
      if (second) { t(lx, y + 8, first, 7, c.right); t(lx, y, fit(second, c.width - 6, 7), 7, c.right) } else t(lx, y, first || fit(c.label, c.width - 6, 7), 7, c.right)
      x += c.width
    }
    y -= 6
    draw.push({ page: 0, x: 40, y, text: '_'.repeat(118), size: 8 })
    y -= 14
    const rows = spec.rows.slice(p * PER_PAGE, (p + 1) * PER_PAGE)
    for (const row of rows) {
      x = 40
      spec.columns.forEach((c, i) => { t(c.right ? x + c.width - 4 : x, y, fit(row[i] ?? '', c.width - 6, SIZE), SIZE, c.right); x += c.width })
      y -= 16
    }
    if (spec.total && p === pages - 1) {
      x = 40
      spec.columns.forEach((c, i) => { t(c.right ? x + c.width - 4 : x, y - 4, fit(spec.total![i] ?? '', c.width - 6, SIZE), SIZE, c.right); x += c.width })
    }
    out.push({ id: pages > 1 ? `${spec.id}-${p + 1}` : spec.id, file: 'statement.pdf', title: `${spec.title}${pages > 1 ? ` (${p + 1})` : ''}`, values: {}, draw })
  }
  return out
}

/** Dependents after the ones the form holds: name, SSN, relationship and date of birth or age. */
export function dependentsStatement(ret: TaxReturnInput, from: number, attachTo: string, id = 'st-deps', birth?: (depId: string) => string): FormFill[] {
  const rest = ret.dependents.slice(from)
  if (!rest.length) return []
  const ssn = (s: string): string => { const d = s.replace(/\D/g, ''); return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d }
  return statementForms(ret, {
    id, attachTo, title: `Dependents ${from + 1} and up`,
    columns: [{ label: 'Name', width: 170 }, { label: 'SSN or ITIN', width: 90 }, { label: 'Relationship', width: 100 }, { label: birth ? 'Date of birth' : 'Age', width: 80 }, { label: 'Months lived with you', width: 92, right: true }],
    rows: rest.map((x) => [x.name, ssn(x.ssn), x.relationship, birth ? birth(x.id) : String(x.age), String(x.monthsLivedWithYou)])
  })
}

/** Child and dependent care providers after the first `from`, for state care-credit forms that have fewer rows. */
export function careProvidersStatement(ret: TaxReturnInput, from: number, attachTo: string, id: string): FormFill[] {
  const rest = ret.dependentCare.providers.slice(from)
  if (!rest.length) return []
  return statementForms(ret, {
    id, attachTo, title: `Care providers ${from + 1} and up`,
    columns: [{ label: 'Care provider', width: 150 }, { label: 'Address', width: 200 }, { label: 'SSN or EIN', width: 80 }, { label: 'Amount paid', width: 82, right: true }],
    rows: rest.map((x) => [x.name, x.address, x.tin, money0(x.amountPaid)]),
    total: ['Total', '', '', money0(rest.reduce((s, x) => s + x.amountPaid, 0))]
  })
}

/** People listed by name and SSN after the first `from` (qualifying persons, children, individuals). */
export function peopleStatement(ret: TaxReturnInput, people: { name: string; ssn: string; extra?: string }[], from: number, o: { id: string; attachTo: string; title: string; extraLabel?: string; note?: string }): FormFill[] {
  const rest = people.slice(from)
  if (!rest.length) return []
  const ssn = (s: string): string => { const d = s.replace(/\D/g, ''); return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d }
  return statementForms(ret, {
    id: o.id, attachTo: o.attachTo, title: o.title,
    columns: [{ label: 'Name', width: 230 }, { label: 'SSN or ITIN', width: 110 }, ...(o.extraLabel ? [{ label: o.extraLabel, width: 150 }] : [])],
    rows: rest.map((x) => [x.name, ssn(x.ssn), ...(o.extraLabel ? [x.extra ?? ''] : [])]),
    ...(o.note ? { note: o.note } : {})
  })
}

/**
 * Statement listing the items behind an "other" amount (ret.explain[key]). Empty when no items were listed.
 * If the items do not add up to the amount on the form, the difference shows as "Other (not listed)".
 */
export function explainStatement(ret: TaxReturnInput, key: string, amount: number, o: { id: string; attachTo: string; title: string }): FormFill[] {
  const items = (ret.explain?.[key] ?? []).filter((x) => x.description.trim() || x.amount)
  if (!items.length || !(amount > 0)) return []
  const rows = items.map((x) => [x.line ? `${x.line}: ${x.description}` : x.description, money0(Math.round(x.amount))])
  const listed = items.reduce((s, x) => s + Math.round(x.amount), 0)
  if (Math.round(amount) !== listed) rows.push(['Other (not listed)', money0(Math.round(amount) - listed)])
  return statementForms(ret, {
    id: o.id, attachTo: o.attachTo, title: o.title,
    columns: [{ label: 'Description', width: 400 }, { label: 'Amount', width: 110, right: true }],
    rows, total: ['Total', money0(Math.round(amount))]
  })
}
