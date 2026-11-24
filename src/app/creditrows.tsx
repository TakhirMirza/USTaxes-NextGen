/**
 * A short list of rows (a credit schedule's lines): text and dollar fields per row, with add and remove buttons.
 */
import { ReactElement } from 'react'
import { MoneyField, TextField } from './fields'

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
