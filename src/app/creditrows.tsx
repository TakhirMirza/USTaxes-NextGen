/**
 * A short list of rows (a credit schedule's lines): text and dollar fields per row, with add and remove buttons.
 */
import { ReactElement } from 'react'
import { MoneyField, TextField } from './fields'
import type { ExplainItem, TaxReturnInput } from '../engine/model.ts'

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
      <summary>{rows.length ? `Items listed (${rows.length}) — the amount is their total` : 'List the items (for the statement the state asks for)'}</summary>
      {rows.map((o, i) => {
        const set1 = (p: Partial<ExplainItem>): void => change(rows.map((y, j) => (j === i ? { ...y, ...p } : y)))
        return (
          <fieldset key={i} className="statement">
            <legend>{`Item ${i + 1}`}</legend>
            <div className="grid">
              {lines && (
                <div className="field">
                  <label htmlFor={`${k}-line-${i}`}><span>Line on the form</span></label>
                  <select id={`${k}-line-${i}`} className="select" value={lines.includes(o.line) ? o.line : lines[lines.length - 1]} onChange={(e) => set1({ line: e.target.value })}>
                    {lines.map((l) => <option key={l} value={l}>{short(l)}</option>)}
                  </select>
                </div>
              )}
              <TextField label="Description" autoComplete="off" value={o.description} onChange={(s) => set1({ description: s })} />
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
