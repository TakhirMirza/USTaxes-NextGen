/**
 * The "What if" step: the return as entered next to up to three scenarios, with the difference in
 * tax and the effective and marginal rates. Scenarios are saved with the return; the return itself
 * only changes if you save a scenario as a separate return.
 */
import { ReactElement, useMemo } from 'react'
import { applyScenario, emptyScenario, isEmptyScenario, summarize } from '../engine/scenarios.ts'
import type { ScenarioRow } from '../engine/scenarios.ts'
import type { Scenario, TaxReturnInput } from '../engine/model.ts'
import { FILING_STATUS_LABELS } from '../engine/rules2025.ts'
import type { FilingStatus } from '../engine/rules2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { SelectField } from './steps'
import type { StepProps } from './steps'

const MAX_SCENARIOS = 3

const PRESETS: { label: string; make: () => Scenario }[] = [
  { label: 'Put $5,000 more in a 401(k)', make: () => ({ ...emptyScenario('401(k) +$5,000'), pretax401k: 5000 }) },
  { label: 'Contribute $7,000 to a traditional IRA', make: () => ({ ...emptyScenario('IRA $7,000'), ira: 7000 }) },
  { label: 'Give $5,000 more to charity', make: () => ({ ...emptyScenario('Charity +$5,000'), charity: 5000, deductionChoice: 'auto' }) },
  { label: 'Sell stock with a $20,000 long-term gain', make: () => ({ ...emptyScenario('Sell stock, $20,000 gain'), longTermGain: 20000 }) },
  { label: 'Earn $10,000 more freelancing', make: () => ({ ...emptyScenario('Freelance +$10,000'), selfEmployment: 10000 }) }
]

type RowKey = keyof ScenarioRow
const ROWS: { key: RowKey; label: string; better?: 'lower' | 'higher'; rate?: boolean }[] = [
  { key: 'totalIncome', label: 'Total income' },
  { key: 'agi', label: 'Adjusted gross income' },
  { key: 'deductions', label: 'Deductions' },
  { key: 'taxableIncome', label: 'Taxable income' },
  { key: 'incomeTax', label: 'Income tax before credits' },
  { key: 'credits', label: 'Nonrefundable credits' },
  { key: 'otherTaxes', label: 'Other taxes (SE, NIIT, AMT…)', better: 'lower' },
  { key: 'totalTax', label: 'Total tax', better: 'lower' },
  { key: 'payments', label: 'Payments and refundable credits', better: 'higher' },
  { key: 'refund', label: 'Refund', better: 'higher' },
  { key: 'owed', label: 'Amount you owe', better: 'lower' },
  { key: 'effectiveRate', label: 'Effective tax rate', rate: true },
  { key: 'marginalRate', label: 'Marginal rate on the next $1,000', rate: true }
]

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`

function Delta({ value, base, better, rate }: { value: number; base: number; better?: 'lower' | 'higher'; rate?: boolean }): ReactElement | null {
  const d = value - base
  if (Math.abs(d) < (rate ? 0.0005 : 0.5)) return null
  const good = better ? (better === 'lower' ? d < 0 : d > 0) : null
  const text = rate ? `${d > 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)} pts` : `${d > 0 ? '+' : '−'}${usd(Math.abs(d))}`
  return <span className={`delta ${good === null ? '' : good ? 'is-good' : 'is-bad'}`}>{text}</span>
}

export function CompareStep({ ret, set, onSaveAsReturn }: StepProps & { onSaveAsReturn: (data: TaxReturnInput, label: string) => void }): ReactElement {
  const scenarios = ret.scenarios
  const base = useMemo(() => summarize({ ...ret, scenarios: [] }), [ret])
  const rows = useMemo(() => scenarios.map((s) => ({ s, row: summarize(applyScenario(ret, s)) })), [ret, scenarios])
  const patch = (id: string, p: Partial<Scenario>): void => set((r) => ({ ...r, scenarios: r.scenarios.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
  const add = (s: Scenario): void => set((r) => ({ ...r, scenarios: [...r.scenarios, s].slice(0, MAX_SCENARIOS) }))
  const remove = (id: string): void => set((r) => ({ ...r, scenarios: r.scenarios.filter((x) => x.id !== id) }))
  const full = scenarios.length >= MAX_SCENARIOS
  const statusOptions = [{ value: '', label: 'Same as the return' }, ...(Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map((k) => ({ value: k, label: FILING_STATUS_LABELS[k] }))]

  return (
    <div className="whatif">
      <p className="lede">Try changes side by side without touching your return: a bigger 401(k) contribution, a donation, selling stock, another filing status. Scenarios are saved with this return and figured with 2025 rules.</p>

      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Line</span></th>
              <th scope="col">As entered</th>
              {rows.map(({ s }) => <th scope="col" key={s.id}>{s.name || 'Scenario'}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className={r.key === 'totalTax' ? 'is-key' : ''}>
                <th scope="row">{r.label}</th>
                <td>{r.rate ? pct(base[r.key]) : usd(base[r.key])}</td>
                {rows.map(({ s, row }) => (
                  <td key={s.id}>
                    {r.rate ? pct(row[r.key]) : usd(row[r.key])}
                    <Delta value={row[r.key]} base={base[r.key]} better={r.better} rate={r.rate} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="is-key">
              <th scope="row">Change in what you pay</th>
              <td>—</td>
              {rows.map(({ s, row }) => {
                const d = (row.owed - row.refund) - (base.owed - base.refund)
                return <td key={s.id}><strong className={d < 0 ? 'good' : d > 0 ? 'bad' : ''}>{d === 0 ? 'No change' : d < 0 ? `You keep ${usd(-d)} more` : `You pay ${usd(d)} more`}</strong></td>
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {!scenarios.length && <p className="empty">No scenarios yet. Start from one of the ideas below or a blank one.</p>}

      {scenarios.map((s) => (
        <Section key={s.id} title={s.name || 'Scenario'} aside={<button type="button" className="link-button is-danger" onClick={() => remove(s.id)}>Remove</button>}>
          <div className="grid">
            <TextField label="Name" value={s.name} onChange={(v) => patch(s.id, { name: v })} />
            <SelectField label="Filing status" value={s.filingStatus} onChange={(v) => patch(s.id, { filingStatus: v as Scenario['filingStatus'] })} options={statusOptions} />
            <MoneyField label="Extra pre-tax 401(k) or 403(b)" hint="Lowers W-2 box 1 wages" value={s.pretax401k} onChange={(n) => patch(s.id, { pretax401k: n })} />
            <MoneyField label="Extra traditional IRA deduction" hint="Limits and phase-outs are not re-checked" value={s.ira} onChange={(n) => patch(s.id, { ira: n })} />
            <MoneyField label="Extra HSA contribution" hint="Needs HSA-eligible health coverage" value={s.hsa} onChange={(n) => patch(s.id, { hsa: n })} />
            <MoneyField label="Extra cash donation" hint="Counts only if you itemize" value={s.charity} onChange={(n) => patch(s.id, { charity: n })} />
            <MoneyField label="Long-term capital gain or loss" allowNegative value={s.longTermGain} onChange={(n) => patch(s.id, { longTermGain: n })} />
            <MoneyField label="Short-term capital gain or loss" allowNegative value={s.shortTermGain} onChange={(n) => patch(s.id, { shortTermGain: n })} />
            <MoneyField label="Extra self-employment profit" allowNegative value={s.selfEmployment} onChange={(n) => patch(s.id, { selfEmployment: n })} />
            <MoneyField label="Other extra income" allowNegative value={s.otherIncome} onChange={(n) => patch(s.id, { otherIncome: n })} />
            <MoneyField label="Extra estimated tax payment" value={s.extraPayments} onChange={(n) => patch(s.id, { extraPayments: n })} />
            <SelectField label="Deduction" value={s.deductionChoice} onChange={(v) => patch(s.id, { deductionChoice: v as Scenario['deductionChoice'] })}
              options={[{ value: '', label: 'Same as the return' }, { value: 'auto', label: 'Whichever is larger' }, { value: 'standard', label: 'Standard deduction' }, { value: 'itemized', label: 'Itemize' }]} />
          </div>
          <div className="button-row">
            <button type="button" className="button is-quiet" disabled={isEmptyScenario(s)} onClick={() => onSaveAsReturn(applyScenario(ret, s), s.name || 'Scenario')}>Save as a separate return</button>
          </div>
        </Section>
      ))}

      {!full && (
        <Section title="Add a scenario">
          <div className="preset-list">
            {PRESETS.map((p) => <button key={p.label} type="button" className="chip" onClick={() => add(p.make())}>{p.label}</button>)}
            <button type="button" className="chip" onClick={() => add(emptyScenario(`Scenario ${scenarios.length + 1}`))}>Blank scenario</button>
          </div>
        </Section>
      )}
      <p className="why">Filing status changes are figured as entered: check that you qualify, and that a married filing separately comparison splits income and deductions in a copy of the return.</p>
    </div>
  )
}
