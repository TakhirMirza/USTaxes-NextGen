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
import { MarylandStep } from './maryland'
import { DcStep } from './dc'
import { CaliforniaStep } from './california'
import { NewYorkStep } from './newyork'
import { StateEstimateView } from './stateEstimate'

const GROUPS: { label: string; support: StateInfo['support'] }[] = [
  { label: 'Prepared by this app', support: 'supported' },
  { label: 'No state income tax', support: 'no-tax' },
  { label: 'Estimate (full forms coming)', support: 'estimate' }
]

/** Short label for the step list and summary. */
export const stateStepTitle = (code: string): string => stateInfo(code)?.name ?? 'State'

export function StateStep(props: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const { ret, set, result } = props
  const info = stateInfo(ret.residentState)
  const addressState = stateInfo(ret.contact.state ?? '')
  // A local rate and state adjustments belong to one state, so they start over when the state changes.
  const choose = (code: string): void => set((r) => ({ ...r, residentState: code, virginia: { ...r.virginia, enabled: code === 'VA' }, stateGeneric: code === r.residentState ? r.stateGeneric : { ...r.stateGeneric, localRate: 0, adjustments: 0, otherCredits: 0 } }))
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

      {info?.support === 'estimate' && <StateEstimateView {...props} />}

      {info?.code === 'VA' && <VirginiaStep {...props} />}
      {info?.code === 'MD' && <MarylandStep {...props} />}
      {info?.code === 'DC' && <DcStep {...props} />}
      {info?.code === 'CA' && <CaliforniaStep {...props} />}
      {info?.code === 'NY' && <NewYorkStep {...props} />}
    </div>
  )
}
