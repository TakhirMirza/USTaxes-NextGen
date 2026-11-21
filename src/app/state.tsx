/**
 * The State step: choose the state you lived in all year, then prepare its return if the app supports
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
import { IllinoisStep } from './illinois'
import { PennsylvaniaStep } from './pennsylvania'
import { NorthCarolinaStep } from './northcarolina'
import { MichiganStep } from './michigan'
import { GeorgiaStep } from './georgia'
import { OhioStep } from './ohio'
import { NewJerseyStep } from './newjersey'
import { MassachusettsStep } from './massachusetts'
import { ArizonaStep } from './arizona'
import { ColoradoStep } from './colorado'
import { MinnesotaStep } from './minnesota'
import { WisconsinStep } from './wisconsin'
import { IndianaStep } from './indiana'
import { SouthCarolinaStep } from './southcarolina'
import { LouisianaStep } from './louisiana'
import { AlabamaStep } from './alabama'
import { OregonStep } from './oregon'
import { KentuckyStep } from './kentucky'
import { OklahomaStep } from './oklahoma'
import { ConnecticutStep } from './connecticut'
import { UtahStep } from './utah'
import { IowaStep } from './iowa'
import { KansasStep } from './kansas'
import { ArkansasStep } from './arkansas'
import { NebraskaStep } from './nebraska'
import { MississippiStep } from './mississippi'
import { WestVirginiaStep } from './westvirginia'
import { NewMexicoStep } from './newmexico'
import { HawaiiStep } from './hawaii'
import { StateEstimateView } from './stateEstimate'
import { STATE_RETURNS_READY, TAX_YEAR } from '../engine/rules.ts'

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
  const ready = STATE_RETURNS_READY[TAX_YEAR]
  // A local rate and state adjustments belong to one state, so they start over when the state changes.
  const choose = (code: string): void => set((r) => ({ ...r, residentState: code, virginia: { ...r.virginia, enabled: code === 'VA' }, stateGeneric: code === r.residentState ? r.stateGeneric : { ...r.stateGeneric, localRate: 0, adjustments: 0, otherCredits: 0 } }))
  const ltcg = result.scheduleD.longTerm

  return (
    <div className="state-step">
      <Section title="Your state" intro={`Pick the state you lived in for all of ${TAX_YEAR}. Its return starts from your federal return, so finish the federal steps first.`}>
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
          <p>{info.note} You do not file a state income tax return for {TAX_YEAR}.</p>
          {info.code === 'WA' && ltcg > 250000 && (
            <div className="note is-warn">
              <strong>Check Washington’s capital gains tax.</strong> You have {usd(ltcg)} of long-term gains. Washington taxes long-term gains above its yearly deduction (7%, and 9.9% on the part over $1 million starting with 2025), on its own return filed with the Department of Revenue.
            </div>
          )}
        </Section>
      )}

      {info && info.support !== 'no-tax' && !ready && (
        <Section title={`${info.name}: ${TAX_YEAR} return not ready yet`}>
          <p className="note is-warn">States publish their {TAX_YEAR} forms and rates from December through February. This app adds each state when its official {TAX_YEAR} forms are out. Until then, the federal return is a preview and no {info.name} figures are shown, so nothing here uses last year’s state rules by mistake.</p>
        </Section>
      )}

      {ready && info?.support === 'estimate' && <StateEstimateView {...props} />}

      {ready && info?.code === 'VA' && <VirginiaStep {...props} />}
      {ready && info?.code === 'MD' && <MarylandStep {...props} />}
      {ready && info?.code === 'DC' && <DcStep {...props} />}
      {ready && info?.code === 'CA' && <CaliforniaStep {...props} />}
      {ready && info?.code === 'NY' && <NewYorkStep {...props} />}
      {ready && info?.code === 'IL' && <IllinoisStep {...props} />}
      {ready && info?.code === 'PA' && <PennsylvaniaStep {...props} />}
      {ready && info?.code === 'NC' && <NorthCarolinaStep {...props} />}
      {ready && info?.code === 'MI' && <MichiganStep {...props} />}
      {ready && info?.code === 'GA' && <GeorgiaStep {...props} />}
      {ready && info?.code === 'OH' && <OhioStep {...props} />}
      {ready && info?.code === 'NJ' && <NewJerseyStep {...props} />}
      {ready && info?.code === 'MA' && <MassachusettsStep {...props} />}
      {ready && info?.code === 'AZ' && <ArizonaStep {...props} />}
      {ready && info?.code === 'CO' && <ColoradoStep {...props} />}
      {ready && info?.code === 'MN' && <MinnesotaStep {...props} />}
      {ready && info?.code === 'WI' && <WisconsinStep {...props} />}
      {ready && info?.code === 'IN' && <IndianaStep {...props} />}
      {ready && info?.code === 'SC' && <SouthCarolinaStep {...props} />}
      {ready && info?.code === 'LA' && <LouisianaStep {...props} />}
      {ready && info?.code === 'AL' && <AlabamaStep {...props} />}
      {ready && info?.code === 'OR' && <OregonStep {...props} />}
      {ready && info?.code === 'KY' && <KentuckyStep {...props} />}
      {ready && info?.code === 'OK' && <OklahomaStep {...props} />}
      {ready && info?.code === 'CT' && <ConnecticutStep {...props} />}
      {ready && info?.code === 'UT' && <UtahStep {...props} />}
      {ready && info?.code === 'IA' && <IowaStep {...props} />}
      {ready && info?.code === 'KS' && <KansasStep {...props} />}
      {ready && info?.code === 'AR' && <ArkansasStep {...props} />}
      {ready && info?.code === 'NE' && <NebraskaStep {...props} />}
      {ready && info?.code === 'MS' && <MississippiStep {...props} />}
      {ready && info?.code === 'WV' && <WestVirginiaStep {...props} />}
      {ready && info?.code === 'NM' && <NewMexicoStep {...props} />}
      {ready && info?.code === 'HI' && <HawaiiStep {...props} />}
    </div>
  )
}
