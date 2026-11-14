/**
 * State tax estimate for states not yet prepared in full: the figures, what they leave out, and the
 * few inputs the federal return does not hold (state withholding, estimated payments, local rate).
 */
import { ReactElement, useMemo } from 'react'
import type { StateGenericInput } from '../engine/model.ts'
import { estimateStateTax } from '../engine/stateEstimate.ts'
import { stateInfo } from '../engine/states.ts'
import { MoneyField, NumberField, Section, usd } from './fields'
import type { StepProps } from './steps'

export function StateEstimateView({ ret, set, result }: StepProps): ReactElement | null {
  const est = useMemo(() => estimateStateTax(ret, result), [ret, result])
  const info = stateInfo(ret.residentState)
  if (!est || !info) return null
  const g = ret.stateGeneric
  const put = (p: Partial<StateGenericInput>): void => set((r) => ({ ...r, stateGeneric: { ...r.stateGeneric, ...p } }))
  const owes = est.owed > 0
  const rows: [string, number, boolean?][] = [
    [est.startLabel, est.start],
    ['Social Security not taxed by the state', -est.socialSecurity],
    ['Your other state adjustments', est.otherAdjustments],
    [est.deductionLabel, -est.deduction],
    ['Exemptions', -est.exemptions],
    ['State taxable income', est.taxable, true],
    ['Tax', est.tax],
    ['Credits', -est.credits],
    ['Minimum tax', est.minimumTax],
    ['Local income tax', est.local],
    ['Total state tax', est.totalTax, true],
    ['Withholding and estimated payments', -est.payments]
  ]
  return (
    <>
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? `${est.name}: you owe` : `${est.name} refund`} <span className="pill">Estimate</span></p>
          <p className="va-result-amount">{usd(owes ? est.owed : est.refund)}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(est.taxable)}</dd></div>
          <div><dt>Total state tax</dt><dd>{usd(est.totalTax)}</dd></div>
          <div><dt>Effective rate</dt><dd>{result.f1040['11a'] > 0 ? `${((est.totalTax / result.f1040['11a']) * 100).toFixed(1)}%` : '—'}</dd></div>
        </dl>
      </div>

      <Section title={`${info.name} tax withheld and paid`} intro="State tax withheld shows in W-2 box 17 and in the state boxes of 1099 forms.">
        <div className="grid">
          <MoneyField label={`${info.name} income tax withheld`} value={g.withholding} onChange={(n) => put({ withholding: n })} />
          <MoneyField label="2025 estimated payments" hint="Include a 2024 overpayment applied to 2025" value={g.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Adjustments you know of" intro="Optional. The estimate does not know your state’s own subtractions and credits; add them here if you have them.">
        <div className="grid">
          <NumberField label="Local income tax rate" suffix="%" decimal max={15} hint="County or city rate, applied to state taxable income" value={g.localRate} onChange={(n) => put({ localRate: n })} />
          <MoneyField label="State additions or subtractions" allowNegative hint="Negative for a subtraction" value={g.adjustments} onChange={(n) => put({ adjustments: n })} />
          <MoneyField label="State credits" value={g.otherCredits} onChange={(n) => put({ otherCredits: n })} />
        </div>
      </Section>

      <Section title={`How ${info.name} tax is estimated`} intro={`${info.name}’s resident return is ${info.form} from the ${info.agency}. This app estimates the tax; it does not fill in the form yet.`}>
        <table className="lines">
          <tbody>
            {rows.filter(([, v, key]) => key || v !== 0).map(([label, v, key]) => (
              <tr key={label} className={key ? 'is-key' : ''}><th scope="row">{label}</th><td>{v < 0 ? `−${usd(-v)}` : usd(v)}</td></tr>
            ))}
          </tbody>
        </table>
        {(est.notes.length > 0 || info.note) && (
          <ul className="issues" style={{ marginTop: 16 }}>
            {info.note && !/local income tax|county income tax/i.test(est.notes.join(' ')) && <li className="issue is-warning"><span className="issue-kind">Note</span><span>{info.note}</span></li>}
            {est.notes.map((n) => <li key={n} className="issue is-warning"><span className="issue-kind">Note</span><span>{n}</span></li>)}
          </ul>
        )}
        <p className="why">Rates, brackets, standard deductions and exemptions are 2025 figures from the Tax Foundation’s state table, updated for changes enacted during 2025. State credits, retirement exclusions and itemized deductions are not figured. Check the result against your state’s instructions before you file.</p>
      </Section>
    </>
  )
}
