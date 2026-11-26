/**
 * The Georgia part of the State step: Form 500 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { GaInput, Owner, Person } from '../engine/model.ts'
import { computeGeorgia, GA_DONATION_LINES } from '../engine/ga2025.ts'
import { buildGaPacket } from '../pdf/ga2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { ExplainItems } from './creditrows'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['8', 'Federal adjusted gross income'], ['9', 'Schedule 1 adjustments'], ['10', 'Georgia adjusted gross income'],
  ['11', 'Standard deduction'], ['12c', 'Georgia itemized deductions'], ['14', 'Dependents ($4,000 each)'], ['15c', 'Georgia taxable income'],
  ['16', 'Tax (5.19%)'], ['17', 'Low income credit'], ['18', 'Credit for tax paid to other states'], ['19', 'Eligible itemizer credit'],
  ['20', 'IND-CR credits'], ['21', 'Schedule 2 credits'], ['23', 'Tax after credits'], ['24', 'Georgia tax withheld (W-2s, 1099s)'],
  ['25', 'Other Georgia tax withheld'], ['26', 'Estimated tax paid'], ['28', 'Total payments'], ['31', 'Credited to 2026'],
  ['45', 'Amount you owe'], ['46', 'Refund']
]
const ALWAYS = new Set(['8', '10', '15c', '16', '23', '28'])
const KEY = new Set(['15c', '23', '45', '46'])
const DONATIONS: Record<string, string> = {
  '32': 'Wildlife Conservation Fund', '33': 'Fund for Children and Elderly', '34': 'Cancer Research Fund', '35': 'Land Conservation Program',
  '36': 'National Guard Foundation', '37': 'Dog & Cat Sterilization Fund', '38': 'Saving the Cure Fund', '39': 'REACH program',
  '40': 'Public Safety Memorial Grant', '41': 'Disabled Veterans’ Scholarship Fund'
}
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function GeorgiaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ga
  const ga = useMemo(() => computeGeorgia(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<GaInput>): void => set((r) => ({ ...r, ga: { ...r.ga, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildGaPacket(ret, result, ga, preparer)
  const L = ga.lines
  const owes = L['45'] > 0
  const ageOf = (o: Owner): number => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age
  const retirees = owners.filter((o) => ageOf(o) >= 62 || d.disabled[o])
  const under62 = owners.filter((o) => ageOf(o) < 62 && ret.retirement.some((x) => x.owner === o && x.taxableAmount > 0))
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadGeorgiaForms }) => downloadGeorgiaForms(ret, result, ga, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Georgia: you owe' : 'Georgia refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['45'] : L['46'])}</p>
        </div>
        <dl>
          <div><dt>Georgia AGI</dt><dd>{usd(L['10'])}</dd></div>
          <div><dt>Taxable income</dt><dd>{usd(L['15c'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['23'])}</dd></div>
        </dl>
      </div>

      <Section title="Georgia return" intro={`Georgia taxes income at a flat 5.19% after a ${usd(ga.deduction.standard)} standard deduction (or your federal itemized deductions) and $4,000 for each dependent.`}>
        <div className="grid">
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
          <TextField label="Driver’s license or state ID number" hint="Optional; helps Georgia verify your identity" autoComplete="off" value={d.driversLicense} onChange={(s) => put({ driversLicense: s.toUpperCase() })} />
          <TextField label="State that issued it" placeholder="GA" autoComplete="off" value={d.driversLicenseState} onChange={(s) => put({ driversLicenseState: s.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() })} />
          <NumberField label="Unborn dependents" hint="With a detectable heartbeat by December 31, 2025; not children born in 2025" max={9} value={d.unbornDependents} onChange={(n) => put({ unbornDependents: n })} />
        </div>
        {ret.filingStatus === 'mfs' && (
          <div className="checks"><Check label="My spouse itemizes on their Georgia return" hint="Then you must itemize too" checked={d.spouseItemizes} onChange={(on) => put({ spouseItemizes: on })} /></div>
        )}
      </Section>

      <Section title="Georgia withholding" intro="From the state section of each W-2 (boxes 15–17). Georgia lists these on the return as income statements.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Georgia" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Georgia tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="Georgia tax withheld on G2-A, G2-FL, G2-LP or G2-RP" value={d.otherWithholding} onChange={(n) => put({ otherWithholding: n })} />
          <MoneyField label="2025 estimated tax paid (and IT-560)" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Retirement income" intro="At 62 or older (or permanently disabled), each spouse can exclude up to $35,000 of retirement income — $65,000 at 65 or older. Social Security is not taxed.">
        <div className="checks">
          {owners.filter((o) => ageOf(o) < 62).map((o) => (
            <Check key={o} label={`${names[o]} is permanently and totally disabled`} hint="Unable to do any gainful work; the exclusion then applies before 62" checked={d.disabled[o]} onChange={(on) => put({ disabled: { ...d.disabled, [o]: on } })} />
          ))}
        </div>
        {owners.some((o) => d.disabled[o] && ageOf(o) < 62) && (
          <div className="grid">
            {owners.filter((o) => d.disabled[o] && ageOf(o) < 62).map((o) => (
              <TextField key={o} label={`${names[o]}’s date of disability`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.disabilityDate[o]} onChange={(s) => put({ disabilityDate: { ...d.disabilityDate, [o]: date(s) } })} />
            ))}
          </div>
        )}
        {under62.length > 0 && (
          <div className="grid">
            {under62.map((o) => (
              <MoneyField key={o} label={`${names[o]}: military retirement in federal AGI`} hint="Under 62: $17,500 excluded, up to $35,000 with Georgia earned income over $17,500" value={d.militaryRetirement[o]} onChange={(n) => put({ militaryRetirement: { ...d.militaryRetirement, [o]: n } })} />
            ))}
          </div>
        )}
        <p className="why">{retirees.length === 0 && ga.schedule1['7b'] + ga.schedule1['7e'] === 0
          ? 'No retirement exclusion: nobody on the return is 62 or older or disabled.'
          : owners.map((o) => {
            const p = ga.retirement[o]
            const parts = [p.exclusion > 0 ? `retirement exclusion ${usd(p.exclusion)}` : '', p.military.exclusion > 0 ? `military exclusion ${usd(p.military.exclusion)}` : ''].filter(Boolean)
            return parts.length ? `${names[o]}: ${parts.join(', ')}.` : ''
          }).filter(Boolean).join(' ') || 'No retirement income to exclude.'}</p>
      </Section>

      <Section title="Other income Georgia treats differently">
        <div className="grid">
          <MoneyField label="Interest on other states’ municipal bonds" hint="Taxed in Georgia" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Interest on U.S. obligations" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Path2College 529 contributions" hint="Up to $4,000 per beneficiary ($8,000 joint)" value={d.path2College} onChange={(n) => put({ path2College: n })} />
          <MoneyField label="Other additions (Schedule 1)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <ExplainItems ret={ret} set={set} k="ga.otherAdditions" setTotal={(r, n) => ({ ...r, ga: { ...r.ga, otherAdditions: n } })} />
          <MoneyField label="Other subtractions (Schedule 1)" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <ExplainItems ret={ret} set={set} k="ga.otherSubtractions" setTotal={(r, n) => ({ ...r, ga: { ...r.ga, otherSubtractions: n } })} />
          {ga.deduction.method === 'itemized' && <MoneyField label="Itemized adjustments (line 12b)" hint="Income taxes paid to other states included in federal Schedule A" value={d.itemizedAdjustment} onChange={(n) => put({ itemizedAdjustment: n })} />}
        </div>
        <p className="why">{ga.deduction.method === 'itemized' ? `You itemize on your federal return, so Georgia uses your itemized deductions (${usd(L['12c'])}) and gives a $300 itemizer credit per taxpayer.` : `Using the Georgia standard deduction: ${usd(L['11'])}.`}</p>
      </Section>

      <Section title="Credits and refund">
        <div className="grid">
          <MoneyField label="Credit for tax paid to other states (line 18)" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <MoneyField label="Other IND-CR credits" hint="Child care is figured for you (50% of the federal credit)" value={d.otherIndCr} onChange={(n) => put({ otherIndCr: n })} />
          <MoneyField label="Schedule 2 credits (line 21)" hint="Requires e-filing" value={d.schedule2Credits} onChange={(n) => put({ schedule2Credits: n })} />
          {L['30'] > 0 && <MoneyField label="Credit to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <details className="more">
          <summary>Donate to a Georgia fund (lines 32–41)</summary>
          <div className="grid">
            {GA_DONATION_LINES.map((k) => (
              <MoneyField key={k} label={DONATIONS[k]} value={d.donations[k] ?? 0} onChange={(n) => put({ donations: { ...d.donations, [k]: n } })} />
            ))}
          </div>
        </details>
      </Section>

      {ga.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ga.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 500" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Georgia forms" intro="Filled in on this device from the official Georgia Department of Revenue PDF.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Georgia forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 5 and mail all five pages unstapled. Returns are due April 15, 2026. Georgia Tax Center (gtc.dor.ga.gov) offers free e-filing.</p>
      </Section>
    </div>
  )
}
