/**
 * A short list of rows (a credit schedule's lines): text and dollar fields per row, with add and remove buttons.
 */
import { ReactElement } from 'react'
import { MoneyField, TextField } from './fields'
import type { ExplainItem, OtherWithholding, TaxReturnInput } from '../engine/model.ts'

export type RowField<T> = [key: keyof T & string, label: string, kind: 'text' | 'money', hint?: string, clean?: (s: string) => string]

export function RowList<T extends object>(props: {
  rows: T[]
  max: number
  noun: string
  empty: () => T
  fields: RowField<T>[]
  onChange: (rows: T[]) => void
}): ReactElement {
  const { rows, max, noun, empty, fields, onChange } = props
  return (
    <>
      {rows.map((o, i) => {
        const set1 = (p: Partial<T>): void => onChange(rows.map((y, j) => (j === i ? { ...y, ...p } : y)))
        return (
          <fieldset key={i} className="statement">
            <legend>{`${noun[0].toUpperCase()}${noun.slice(1)} ${i + 1}`}</legend>
            <div className="grid">
              {fields.map(([k, label, kind, hint, clean]) => kind === 'money'
                ? <MoneyField key={k} label={label} hint={hint} value={Number(o[k]) || 0} onChange={(n) => set1({ [k]: n } as Partial<T>)} />
                : <TextField key={k} label={label} hint={hint} autoComplete="off" value={String(o[k] ?? '')} onChange={(s) => set1({ [k]: clean ? clean(s) : s } as Partial<T>)} />)}
            </div>
            <div className="actions"><button type="button" className="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove this {noun}</button></div>
          </fieldset>
        )
      })}
      {rows.length < max && <div className="actions"><button type="button" className="button" onClick={() => onChange([...rows, empty()])}>Add a {noun}</button></div>}
    </>
  )
}

/**
 * The items behind an "other additions/subtractions" amount. Listing them fills the supporting statement
 * (or, with `lines`, the form's own lines) and sets the amount to their total.
 */
export function ExplainItems(props: {
  ret: TaxReturnInput
  set: (fn: (r: TaxReturnInput) => TaxReturnInput) => void
  k: string
  /** Store the new total in the state's amount field. */
  setTotal: (r: TaxReturnInput, total: number) => TaxReturnInput
  /** PDF line names to choose from (the last is the catch-all "other" line). */
  lines?: string[]
  lineLabel?: string
  descriptionLabel?: string
  summary?: string
}): ReactElement {
  const { ret, set, k, setTotal, lines } = props
  const rows = ret.explain?.[k] ?? []
  const change = (next: ExplainItem[]): void => set((r) => {
    const withRows = { ...r, explain: { ...(r.explain ?? {}), [k]: next } }
    return next.length ? setTotal(withRows, Math.round(next.reduce((s, x) => s + (Number(x.amount) || 0), 0) * 100) / 100) : withRows
  })
  const short = (s: string): string => (s.length > 70 ? `${s.slice(0, 68).trim()}…` : s)
  return (
    <details className="explain" open={rows.length > 0}>
      <summary>{rows.length ? `Items listed (${rows.length}) — the amount is their total` : (props.summary ?? 'List the items (for the statement the state asks for)')}</summary>
      {rows.map((o, i) => {
        const set1 = (p: Partial<ExplainItem>): void => change(rows.map((y, j) => (j === i ? { ...y, ...p } : y)))
        return (
          <fieldset key={i} className="statement">
            <legend>{`Item ${i + 1}`}</legend>
            <div className="grid">
              {lines && (
                <div className="field">
                  <label htmlFor={`${k}-line-${i}`}><span>{props.lineLabel ?? 'Line on the form'}</span></label>
                  <select id={`${k}-line-${i}`} className="select" value={lines.includes(o.line) ? o.line : lines[lines.length - 1]} onChange={(e) => set1({ line: e.target.value })}>
                    {lines.map((l) => <option key={l} value={l}>{short(l)}</option>)}
                  </select>
                </div>
              )}
              <TextField label={props.descriptionLabel ?? 'Description'} autoComplete="off" value={o.description} onChange={(s) => set1({ description: s })} />
              <MoneyField label="Amount" value={o.amount} onChange={(n) => set1({ amount: n })} />
            </div>
            <div className="actions"><button type="button" className="button" onClick={() => change(rows.filter((_, j) => j !== i))}>Remove this item</button></div>
          </fieldset>
        )
      })}
      {rows.length < 40 && <div className="actions"><button type="button" className="button" onClick={() => change([...rows, { line: lines ? lines[lines.length - 1] : '', description: '', amount: 0 }])}>Add an item</button></div>}
    </details>
  )
}

/**
 * The 1099s, W-2Gs, G2s and similar statements behind a state's "other withholding" total. Listing them fills the
 * state's withholding schedule rows and sets the total to their sum.
 */
export function WithholdingItems(props: {
  ret: TaxReturnInput
  set: (fn: (r: TaxReturnInput) => TaxReturnInput) => void
  k: string
  setTotal: (r: TaxReturnInput, total: number) => TaxReturnInput
  kinds: string[]
  /** Ask for the federal amount and federal tax withheld too (Ohio). */
  federal?: boolean
  stateIdLabel: string
  incomeLabel: string
}): ReactElement {
  const { ret, set, k, setTotal, kinds } = props
  const rows = ret.withholdingLists?.[k] ?? []
  const joint = ret.filingStatus === 'mfj'
  const change = (next: OtherWithholding[]): void => set((r) => {
    const withRows = { ...r, withholdingLists: { ...(r.withholdingLists ?? {}), [k]: next } }
    return next.length ? setTotal(withRows, Math.round(next.reduce((s, x) => s + (Number(x.tax) || 0), 0) * 100) / 100) : withRows
  })
  return (
    <details className="explain" open={rows.length > 0}>
      <summary>{rows.length ? `Statements listed (${rows.length}) — the amount is their total` : 'List each statement (fills the withholding schedule)'}</summary>
      {rows.map((o, i) => {
        const set1 = (p: Partial<OtherWithholding>): void => change(rows.map((y, j) => (j === i ? { ...y, ...p } : y)))
        return (
          <fieldset key={i} className="statement">
            <legend>{`Statement ${i + 1}`}</legend>
            <div className="grid">
              <div className="field">
                <label htmlFor={`${k}-kind-${i}`}><span>Form</span></label>
                <select id={`${k}-kind-${i}`} className="select" value={kinds.includes(o.kind) ? o.kind : kinds[0]} onChange={(e) => set1({ kind: e.target.value })}>
                  {kinds.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              {joint && (
                <div className="field">
                  <label htmlFor={`${k}-owner-${i}`}><span>Whose</span></label>
                  <select id={`${k}-owner-${i}`} className="select" value={o.owner} onChange={(e) => set1({ owner: e.target.value === 'spouse' ? 'spouse' : 'taxpayer' })}>
                    <option value="taxpayer">You</option>
                    <option value="spouse">Spouse</option>
                  </select>
                </div>
              )}
              <TextField label="Payer’s federal ID (TIN)" autoComplete="off" value={o.payerId} onChange={(s) => set1({ payerId: s })} />
              <TextField label={props.stateIdLabel} autoComplete="off" value={o.stateId} onChange={(s) => set1({ stateId: s })} />
              {props.federal && <MoneyField label="Federal amount (box 1)" value={o.fedIncome} onChange={(n) => set1({ fedIncome: n })} />}
              {props.federal && <MoneyField label="Federal tax withheld" value={o.federal} onChange={(n) => set1({ federal: n })} />}
              <MoneyField label={props.incomeLabel} value={o.income} onChange={(n) => set1({ income: n })} />
              <MoneyField label="State tax withheld" value={o.tax} onChange={(n) => set1({ tax: n })} />
            </div>
            <div className="actions"><button type="button" className="button" onClick={() => change(rows.filter((_, j) => j !== i))}>Remove this statement</button></div>
          </fieldset>
        )
      })}
      {rows.length < 40 && <div className="actions"><button type="button" className="button" onClick={() => change([...rows, { owner: 'taxpayer', kind: kinds[0], payerId: '', stateId: '', fedIncome: 0, income: 0, federal: 0, tax: 0 }])}>Add a statement</button></div>}
    </details>
  )
}
