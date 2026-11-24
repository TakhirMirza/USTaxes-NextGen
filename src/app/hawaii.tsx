/**
 * The Hawaii part of the State step: Form N-11 with Schedule X and Schedule CR for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { HiInput, HiRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeHawaii } from '../engine/hi2025.ts'
import { buildHiPacket } from '../pdf/hi2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, Choice, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['7', 'Federal adjusted gross income'], ['11', 'Hawaii additions'], ['19', 'Hawaii subtractions'], ['20', 'Hawaii adjusted gross income'],
  ['22', 'Itemized deductions'], ['23', 'Standard deduction'], ['25', 'Exemptions'], ['26', 'Taxable income'], ['27', 'Tax'],
  ['28', 'Food/excise tax credit'], ['29', 'Renters credit (Schedule X Part I)'], ['30', 'Child and dependent care credit (Schedule X Part II)'],
  ['31', 'Child passenger restraint credit'], ['32', 'Other refundable credits (Schedule CR, incl. earned income credit)'], ['34', 'Balance'],
  ['35', 'Nonrefundable credits (Schedule CR)'], ['36', 'Tax after credits'], ['41', 'Total payments'], ['44', 'Contributions'],
  ['46', 'Applied to 2026 estimated tax'], ['49', 'Amount you owe'], ['47a', 'Refund']
]
const ALWAYS = new Set(['7', '20', '26', '27', '36', '41'])
const KEY = new Set(['36', '49', '47a'])
const KINDS: [HiRetirementKind, string][] = [['standard', 'Taxed in Hawaii (IRA, 401(k) from your own contributions, annuity)'], ['employer', 'Employer-funded or government pension (not taxed)']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

const CR_REFUNDABLE: [string, string][] = [
  ['1', 'Capital goods excise tax credit (N-312)'], ['2', 'Fuel tax credit for commercial fishers (N-163)'], ['3', 'Motion picture, digital media and film production (N-340)'],
  ['4', 'Renewable energy technologies, refundable (N-342)'], ['5', 'Important agricultural land (N-344)'], ['6', 'Research activities (N-346)'],
  ['7', 'Renewable fuels production (N-360)'], ['9', 'Claim of right (N-364)'], ['10a', 'Taxes withheld on Hawaii real property sold by a partnership or S corporation'], ['10b', 'Credit from a regulated investment company']
]
const CR_CARRY: [string, string][] = [
  ['14', 'Energy conservation'], ['15', 'High technology business investment'], ['16', 'Cesspool upgrade, conversion or connection'], ['17', 'Technology infrastructure renovation'],
  ['18', 'Hotel construction and remodeling'], ['19', 'Residential construction and remodeling'], ['20', 'Renewable energy technologies (before July 1, 2009)'], ['21', 'Organic foods production'],
  ['22', 'Renewable fuels production (before 2022)'], ['23', 'Capital infrastructure (N-348)'], ['24', 'Earned income tax credit carryover (N-356)']
]
const CR_NEW: [string, string][] = [
  ['25', 'Low-income housing (N-586)'], ['26', 'Vocational rehabilitation referrals (N-884)'], ['27', 'School repair and maintenance (N-330)'], ['28', 'Nonrefundable renewable energy technologies (N-342)'],
  ['29', 'Healthcare preceptor (N-358)'], ['30', 'Historic preservation (N-325)'], ['31', 'Nonrefundable renewable fuels production (N-360)'], ['32', 'Pass-through entity tax credit (N-362)']
]

export function HawaiiStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.hi
  const hi = useMemo(() => computeHawaii(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<HiInput>): void => set((r) => ({ ...r, hi: { ...r.hi, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildHiPacket(ret, result, hi, preparer)
  const L = hi.lines
  const act = d.activity
  const putAct = (p: Partial<HiInput['activity']>): void => put({ activity: { ...act, ...p } })
  const crUsed = Object.keys(hi.cr).length > 0
  const putCr = (p: Partial<HiInput['cr']>): void => put({ cr: { ...d.cr, ...p }, refundableCredits: 0, nonrefundableCredits: 0 })
  const owes = L['49'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const pair = (k: 'disabled' | 'schools' | 'libraries' | 'violence' | 'electionFund', o: Owner, v: boolean): void => put({ [k]: { ...d[k], [o]: v } } as Partial<HiInput>)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadHawaiiForms }) => downloadHawaiiForms(ret, result, hi, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Hawaii: you owe' : 'Hawaii refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['49'] : L['47a'])}</p>
        </div>
        <dl>
          <div><dt>Hawaii taxable income</dt><dd>{usd(L['26'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['27'])}</dd></div>
          <div><dt>Refundable credits</dt><dd>{usd(L['33'])}</dd></div>
        </dl>
      </div>

      <Section title="Hawaii return" intro="Hawaii starts from federal adjusted gross income, exempts Social Security and employer-funded pensions, and taxes income at 1.4% to 11% after a $4,400 standard deduction ($8,800 joint, $6,424 head of household) and $1,144 per exemption.">
        <div className="grid">
          {owners.map((o) => (
            <Check key={o} label={`${names[o]}: blind, deaf or totally disabled`} hint="$7,000 exemption instead of the regular ones; Form N-172 certifies it" checked={d.disabled[o]} onChange={(v) => pair('disabled', o, v)} />
          ))}
        </div>
      </Section>

      <Section title="Hawaii withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Hawaii" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Hawaii tax withheld on 1099s and N-2s" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="2025 estimated tax paid" hint="Line 38" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="2024 overpayment applied" hint="Line 39" value={d.priorYearApplied} onChange={(n) => put({ priorYearApplied: n })} />
          <MoneyField label="Paid with extension (N-200V)" hint="Line 40" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
          {L['45'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 46" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Pensions (line 13)" intro="Distributions from pensions your employer paid for, including government and military pensions, are not taxed in Hawaii. IRA and 401(k) amounts from your own contributions are.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`hi-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`hi-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as HiRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Additions and subtractions">
        <div className="grid">
          <MoneyField label="COLA / ERS wage difference" hint="Line 8; Hawaii wages minus federal wages, can be negative" allowNegative value={d.wageDifference} onChange={(n) => put({ wageDifference: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Line 9" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other additions" hint="Line 10" allowNegative value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Military reserve or Hawaii National Guard pay" hint="Line 15; up to $8,636 is excluded" value={d.guardPay} onChange={(n) => put({ guardPay: n })} />
          <MoneyField label="Payments to an individual housing account" hint="Line 16" value={d.housingAccount} onChange={(n) => put({ housingAccount: n })} />
          <MoneyField label="Interest on U.S. government obligations" hint="Line 18" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other subtractions" hint="Line 18; attach an explanation" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
        </div>
        <p className="why">{hi.itemize ? `Itemizing on Hawaii worksheets A-1 to A-6: ${usd(L['22'])}.` : `Standard deduction ${usd(L['23'])}.`}</p>
      </Section>

      <Section title="Credits" intro="The food/excise tax credit, the child care credit and the earned income credit (40% of your federal credit) are worked out from your return.">
        <div className="grid">
          <MoneyField label="Rent paid in 2025" hint="Schedule X Part I; only if Hawaii AGI is under $30,000" value={d.rentPaid} onChange={(n) => put({ rentPaid: n })} />
          <MoneyField label="Rent exclusions" hint="Utilities, parking, rent subsidies included in the rent" value={d.rentExclusions} onChange={(n) => put({ rentExclusions: n })} />
          <TextField label="Rental unit address" hint="Street and apartment number" autoComplete="off" value={d.rentalAddress} onChange={(s) => put({ rentalAddress: s })} />
          <NumberField label="Child car seats bought" hint="Line 31; $25 each" max={10} value={d.carSeats} onChange={(n) => put({ carSeats: n })} />
          {!crUsed && d.refundableCredits > 0 && <MoneyField label="Other refundable credits (total)" hint="Or list them in Schedule CR below" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />}
          {!crUsed && d.nonrefundableCredits > 0 && <MoneyField label="Nonrefundable credits (total)" hint="Or list them in Schedule CR below" value={d.nonrefundableCredits} onChange={(n) => put({ nonrefundableCredits: n })} />}
        </div>
      </Section>

      <Section title="Schedule CR: other tax credits" intro="Enter each credit on its Schedule CR line and attach its form. Nonrefundable credits are applied in line order up to your tax; the unused part of a carryover credit (lines 14–32) is shown in column (d) for 2026.">
        <details open={crUsed}>
          <summary>Part I: refundable credits</summary>
          <div className="grid">
            {CR_REFUNDABLE.map(([k, label]) => <MoneyField key={k} label={label} hint={`Line ${k}`} value={d.cr.lines[k] ?? 0} onChange={(n) => putCr({ lines: { ...d.cr.lines, [k]: n } })} />)}
          </div>
          {(d.cr.lines['4'] ?? 0) > 0 && <Choice legend="Line 4 energy system" value={d.cr.energy || 'solar'} onChange={(energy) => putCr({ energy })} options={[{ value: 'solar', label: 'Solar' }, { value: 'wind', label: 'Wind' }]} />}
        </details>
        <details open={crUsed}>
          <summary>Part II: nonrefundable credits</summary>
          <div className="grid">
            <MoneyField label="Income tax paid to another state or foreign country" hint="Line 12; attach the other return or federal Form 1116" value={d.cr.lines['12'] ?? 0} onChange={(n) => putCr({ lines: { ...d.cr.lines, '12': n } })} />
            <MoneyField label="Enterprise zone tax credit" hint="Line 13; Form N-756" value={d.cr.lines['13'] ?? 0} onChange={(n) => putCr({ lines: { ...d.cr.lines, '13': n } })} />
            {CR_CARRY.map(([k, label]) => (
              <MoneyField key={k} label={label} hint={`Line ${k}, column (a): unused carryover from 2024`} value={d.cr.carry[k]?.prior ?? 0} onChange={(n) => putCr({ carry: { ...d.cr.carry, [k]: { prior: n, current: d.cr.carry[k]?.current ?? 0 } } })} />
            ))}
            {CR_NEW.map(([k, label]) => [
              <MoneyField key={`${k}b`} label={label} hint={`Line ${k}, column (b): 2025 credit`} value={d.cr.carry[k]?.current ?? 0} onChange={(n) => putCr({ carry: { ...d.cr.carry, [k]: { prior: d.cr.carry[k]?.prior ?? 0, current: n } } })} />,
              <MoneyField key={`${k}a`} label={`${label}: carryover`} hint={`Line ${k}, column (a): unused from 2024`} value={d.cr.carry[k]?.prior ?? 0} onChange={(n) => putCr({ carry: { ...d.cr.carry, [k]: { prior: n, current: d.cr.carry[k]?.current ?? 0 } } })} />
            ])}
          </div>
          {hi.crCarry['28'] && <Choice legend="Line 28 energy system" value={d.cr.energy28 || 'solar'} onChange={(energy28) => putCr({ energy28 })} options={[{ value: 'solar', label: 'Solar' }, { value: 'wind', label: 'Wind' }]} />}
        </details>
        {crUsed && (
          <table className="lines"><tbody>
            {Object.entries(hi.crCarry).map(([k, c]) => <tr key={k}><th scope="row"><span className="line-no">{k}</span>Applied {usd(c.c)} of {usd(c.a + c.b)}</th><td>{k === '24' ? '' : `${usd(c.d)} to 2026`}</td></tr>)}
            <tr><th scope="row"><span className="line-no">11</span>Total refundable credits (Form N-11 line 32)</th><td>{usd(L['32'])}</td></tr>
            <tr><th scope="row"><span className="line-no">33</span>Total nonrefundable credits (Form N-11 line 35)</th><td>{usd(L['35'])}</td></tr>
          </tbody></table>
        )}
      </Section>

      {(result.scheduleC.length > 0 || ret.rentals.length > 0) && (
        <Section title="Business and rental activity (lines 51–52)" intro="Hawaii asks for your Hawaii gross receipts or rents and the general excise (GE) license number for each activity. Leave the amounts at their defaults if all of it was earned in Hawaii.">
          <div className="grid">
            {result.scheduleC.length > 0 && <>
              <MoneyField label="Hawaii gross receipts" hint="Line 51; default is Schedule C gross receipts" value={act.grossReceipts ?? ret.businesses.reduce((s, b) => s + Math.max(0, b.grossReceipts - b.returnsAndAllowances), 0)} onChange={(n) => putAct({ grossReceipts: n })} />
              <TextField label="Main business activity" hint="Up to 14 characters" autoComplete="off" value={act.activity} onChange={(s) => putAct({ activity: s })} />
              <TextField label="Main business product" hint="Up to 14 characters" autoComplete="off" value={act.product} onChange={(s) => putAct({ product: s })} />
              <TextField label="Hawaii Tax I.D. (GE) for the business" hint="General excise license, e.g. GE-123-456-7890-01" autoComplete="off" value={act.businessGe} onChange={(s) => putAct({ businessGe: s })} />
            </>}
            {ret.rentals.length > 0 && <>
              <MoneyField label="Hawaii gross rents received" hint="Line 52; default is Schedule E rents" value={act.grossRents ?? ret.rentals.reduce((s, x) => s + Math.max(0, x.rents), 0)} onChange={(n) => putAct({ grossRents: n })} />
              <TextField label="Hawaii Tax I.D. (GE) for the rental" autoComplete="off" value={act.rentalGe} onChange={(s) => putAct({ rentalGe: s })} />
            </>}
          </div>
        </Section>
      )}

      <Section title="Contributions and signature" intro="Each checked box takes $2 (schools) or $5 (libraries, domestic violence) from your refund. The election campaign fund box costs nothing.">
        {owners.map((o) => (
          <div key={o} className="grid">
            <Check label={`${names[o]}: Hawaii schools repairs ($2)`} checked={d.schools[o]} onChange={(v) => pair('schools', o, v)} />
            <Check label={`${names[o]}: Hawaii public libraries ($5)`} checked={d.libraries[o]} onChange={(v) => pair('libraries', o, v)} />
            <Check label={`${names[o]}: Domestic violence prevention ($5)`} checked={d.violence[o]} onChange={(v) => pair('violence', o, v)} />
            <Check label={`${names[o]}: $3 to the Hawaii Election Campaign Fund`} checked={d.electionFund[o]} onChange={(v) => pair('electionFund', o, v)} />
            <TextField label={`${names[o]}: occupation`} autoComplete="off" value={d.occupation[o]} onChange={(s) => put({ occupation: { ...d.occupation, [o]: s } })} />
          </div>
        ))}
      </Section>

      {hi.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{hi.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form N-11" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Hawaii forms" intro="Filled in on this device from the official Hawaii Department of Taxation Form N-11 with Schedules CR and X.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Hawaii forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 4 in ink. Mail to Hawaii Department of Taxation, P.O. Box 3559, Honolulu HI 96811-3559; with a payment, to Attn: Payment Section, P.O. Box 1530, Honolulu HI 96806-1530. Due April 20, 2026.</p>
      </Section>
    </div>
  )
}
