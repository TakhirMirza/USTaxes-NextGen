/**
 * A list of other states for a "credit for tax paid to another state" schedule: a two-letter
 * state code and a few dollar amounts per state.
 */
import { ReactElement } from 'react'
import { MoneyField, TextField } from './fields'

export interface OtherStateRow { state: string }

export function OtherStatesList<T extends OtherStateRow>(props: {
  rows: T[]
  max: number
  empty: () => T
  fields: [key: keyof T & string, label: string, hint: string][]
  onChange: (rows: T[]) => void
}): ReactElement {
  const { rows, max, empty, fields, onChange } = props
  return (
    <>
      {rows.map((o, i) => {
        const set1 = (p: Partial<T>): void => onChange(rows.map((y, j) => (j === i ? { ...y, ...p } : y)))
        return (
          <fieldset key={i} className="statement">
            <legend>{o.state.trim().toUpperCase() || `State ${i + 1}`}</legend>
            <div className="grid">
              <TextField label="State (two letters)" autoComplete="off" value={o.state} onChange={(s) => set1({ state: s.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() } as Partial<T>)} />
              {fields.map(([k, label, hint]) => (
                <MoneyField key={k} label={label} hint={hint} value={Number(o[k]) || 0} onChange={(n) => set1({ [k]: n } as Partial<T>)} />
              ))}
            </div>
            <div className="actions"><button type="button" className="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove this state</button></div>
          </fieldset>
        )
      })}
      {rows.length < max && <div className="actions"><button type="button" className="button" onClick={() => onChange([...rows, empty()])}>Add a state</button></div>}
    </>
  )
}
