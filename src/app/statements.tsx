/**
 * State copies of W-2s and 1099-Rs: the employer or payer IDs, state wages and state tax withheld that a
 * state withholding schedule asks for. Shared by the state steps.
 */
import { ReactElement } from 'react'
import type { StateStatement } from '../engine/model.ts'
import { emptyStatement } from '../engine/model.ts'
import { DigitsField, MoneyField, TextField } from './fields'

export interface StatementItem { id: string; title: string; federal: number }

export function StatementRows({ items, value, onChange, state, kind }: {
  items: StatementItem[]
  value: Record<string, StateStatement>
  onChange: (next: Record<string, StateStatement>) => void
  state: string
  kind: 'w2' | '1099r'
}): ReactElement {
  const w2 = kind === 'w2'
  return (
    <div className="statements">
      {items.map((it) => {
        const s = { ...emptyStatement(), ...(value[it.id] ?? {}) }
        const put = (p: Partial<StateStatement>): void => onChange({ ...value, [it.id]: { ...s, ...p } })
        return (
          <fieldset key={it.id} className="statement">
            <legend>{it.title}</legend>
            <div className="grid">
              <DigitsField label={w2 ? 'Employer ID (box b)' : 'Payer’s TIN'} length={9} groups={[2, 7]} value={s.ein} onChange={(v) => put({ ein: v })} />
              <TextField label={w2 ? `${state} employer ID (box 15)` : `Payer’s ${state} number (box 15)`} autoComplete="off" value={s.stateId} onChange={(v) => put({ stateId: v.toUpperCase() })} />
              {w2 && <MoneyField label={`${state} wages (box 16)`} hint="Usually the same as box 1" value={s.stateIncome ?? it.federal} onChange={(n) => put({ stateIncome: n === it.federal ? null : n })} />}
              <MoneyField label={`${state} tax withheld (${w2 ? 'box 17' : 'box 14'})`} value={s.stateTax} onChange={(n) => put({ stateTax: n })} />
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
