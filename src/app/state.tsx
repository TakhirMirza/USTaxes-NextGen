/**
 * The State step: choose the state you lived in all of 2025, then prepare its return if the app supports
 * it, or see what that state requires. Each supported state has its own step body (Virginia: virginia.tsx).
 */
import { ReactElement } from 'react'
import { STATES, stateInfo } from '../engine/states.ts'
import type { StateInfo } from '../engine/states.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Section, usd } from './fields'
import type { StepProps } from './steps'
import { VirginiaStep } from './virginia'

const GROUPS: { label: string; support: StateInfo['support'] }[] = [
  { label: 'Prepared by this app', support: 'supported' },
  { label: 'No state income tax', support: 'no-tax' },
  { label: 'Other states (not prepared yet)', support: 'not-yet' }
]

/** Short label for the step list and summary. */
export const stateStepTitle = (code: string): string => stateInfo(code)?.name ?? 'State'

export function StateStep(props: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const { ret, set, result } = props
  const info = stateInfo(ret.residentState)
  const addressState = stateInfo(ret.contact.state ?? '')
  const choose = (code: string): void => set((r) => ({ ...r, residentState: code, virginia: { ...r.virginia, enabled: code === 'VA' } }))
  const ltcg = result.scheduleD.longTerm

  return (
    <div className="state-step">
      <Section title="Your state" intro="Pick the state you lived in for all of 2025. Its return starts from your federal return, so finish the federal steps first.">
        <div className="grid">
          <div className="field">
            <label htmlFor="resident-state"><span>State of residence</span></label>
            <select id="resident-state" className="select" value={info?.code ?? ''} onChange={(e) => choose(e.target.value)}>
              <option value="">Choose a state</option>
              {GROUPS.map((g) => (
                <optgroup key={g.support} label={g.label}>
                  {STATES.filter((s) => s.support === g.support).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        {!info && addressState && (
          <div className="button-row">
            <button type="button" className="button is-quiet" onClick={() => choose(addressState.code)}>Use {addressState.name}, from your address</button>
          </div>
        )}
        <p className="why">Moved during the year, or earned income in another state? Part-year and nonresident returns are not prepared yet; a resident return can usually still claim credit for tax paid to another state.</p>
      </Section>

      {info?.support === 'no-tax' && (
        <Section title={`${info.name}: no state return`}>
          <p>{info.note} You do not file a state income tax return for 2025.</p>
          {info.code === 'WA' && ltcg > 250000 && (
            <div className="note is-warn">
              <strong>Check Washington’s capital gains tax.</strong> You have {usd(ltcg)} of long-term gains. Washington taxes long-term gains above its yearly deduction (7%, and 9.9% on the part over $1 million starting with 2025), on its own return filed with the Department of Revenue.
            </div>
          )}
        </Section>
      )}

      {info?.support === 'not-yet' && (
        <Section title={`${info.name}: not prepared yet`}>
          <p>{info.name} taxes income, and its resident return is <strong>{info.form}</strong> from the {info.agency}. This app does not prepare it yet, so nothing here is figured for {info.name}.</p>
          {info.note && <p className="why">{info.note}</p>}
          <ul className="va-auto">
            <li><span>Start from</span><strong>Federal AGI {usd(result.f1040['11a'])}</strong></li>
            <li><span>Federal return</span><strong>Form 1040 PDF from the Review step</strong></li>
          </ul>
          <p className="why">Most states start from federal adjusted gross income, so the federal PDF from this app is what you will copy numbers from. Many states also offer free online filing on their department’s website.</p>
        </Section>
      )}

      {info?.code === 'VA' && <VirginiaStep {...props} />}
    </div>
  )
}
