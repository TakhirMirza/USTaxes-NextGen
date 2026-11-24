/**
 * The Rhode Island part of the State step: RI-1040 with Schedules W, E, M and CR for full-year residents, and the
 * RI-1040H property tax relief claim.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { Owner, Person, RiInput } from '../engine/model.ts'
import { computeRhodeIsland } from '../engine/ri2025.ts'
import { buildRiPacket } from '../pdf/ri2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { RowList } from './creditrows'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Net modifications (Schedule M)'], ['3', 'Modified federal AGI'], ['4', 'Standard deduction'],
  ['6', 'Exemptions'], ['7', 'Rhode Island taxable income'], ['8', 'Income tax'], ['9a', '25% of the federal child care credit'], ['9b', 'Tax paid to another state'],
  ['9c', 'Other credits (Schedule CR)'], ['10a', 'Tax after credits'], ['11', 'Checkoff contributions'], ['12a', 'Use tax'], ['12b', 'Individual mandate penalty'],
  ['13a', 'Total tax and contributions'], ['14a', 'Rhode Island tax withheld'], ['14b', 'Estimated payments'], ['14c', 'Property tax relief credit (RI-1040H)'],
  ['14d', 'Earned income credit (16%)'], ['14g', 'Total payments and credits'], ['18', 'Applied to 2026'], ['15c', 'Amount due'], ['17', 'Refund']
]
const ALWAYS = new Set(['1', '3', '7', '8', '13a', '14g'])
const KEY = new Set(['13a', '15c', '17'])
const CHECKOFFS: [string, string][] = [['30', 'Drug program account'], ['31', 'Olympic contribution'], ['32', 'Organ Transplant Fund'], ['33', 'Council on the Arts'], ['34', 'Nongame Wildlife Fund'], ['35', 'Childhood Disease Victim’s Fund'], ['36', 'Military Family Relief Fund'], ['37', 'Behavioral health education fund']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)
const usd2 = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const RI_CR: [string, string][] = [
  ['1', 'Historic homeowner assistance, carryforward only (RI-0715)'], ['2', 'Contributions to scholarship organizations (RI-2276)'], ['3', 'Historic structures and historic preservation (RI-286B)'],
  ['4', 'Low income housing (RI-5442)'], ['5', 'New qualified jobs incentive (RI-6754)'], ['6', 'Rebuild Rhode Island (RI-7253)'],
  ['7', 'Motion picture, musical and theatrical production (RI-8201)'], ['8', 'Wavemaker fellowship (RI-9283)']
]

export function RhodeIslandStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ri
  const ri = useMemo(() => computeRhodeIsland(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<RiInput>): void => set((r) => ({ ...r, ri: { ...r.ri, ...p } }))
  const putRelief = (p: Partial<RiInput['relief']>): void => put({ relief: { ...d.relief, ...p } })
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildRiPacket(ret, result, ri, preparer)
  const L = ri.lines
  const owes = L['15c'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner) && !x.ira)
  const rows = d.other1099
  const setRow = (i: number, p: Partial<RiInput['other1099'][number]>): void => put({ other1099: rows.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadRhodeIslandForms }) => downloadRhodeIslandForms(ret, result, ri, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Rhode Island: you owe' : 'Rhode Island refund'}</p>
          <p className="va-result-amount">{usd2(owes ? L['15c'] : L['17'])}</p>
        </div>
        <dl>
          <div><dt>Rhode Island taxable income</dt><dd>{usd(L['7'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd2(L['10a'])}</dd></div>
          <div><dt>Earned income credit</dt><dd>{usd2(L['14d'])}</dd></div>
        </dl>
      </div>

      <Section title="Rhode Island return" intro="Rhode Island starts from federal adjusted gross income, subtracts a $10,900 standard deduction ($21,800 joint, $16,350 head of household) and $5,100 per exemption, and taxes the rest at 3.75%, 4.75% and 5.99%.">
        <div className="grid">
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}: date of birth`} hint="Needed for the Social Security and pension modifications" placeholder="mm/dd/yyyy" autoComplete="off" value={d.birthDates[o]} onChange={(s) => put({ birthDates: { ...d.birthDates, [o]: date(s) } })} />
          ))}
          {ret.dependents.map((dep) => (
            <TextField key={dep.id} label={`${dep.name.trim() || 'Dependent'}: date of birth`} hint="Schedule E" placeholder="mm/dd/yyyy" autoComplete="off" value={d.dependentBirthDates[dep.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [dep.id]: date(s) } })} />
          ))}
          {owners.map((o) => (
            <TextField key={`dl-${o}`} label={`${names[o]}: driver’s license number and state`} hint="Asked for next to the signature" autoComplete="off" value={d.driversLicense[o]} onChange={(s) => put({ driversLicense: { ...d.driversLicense, [o]: s } })} />
          ))}
        </div>
      </Section>

      <Section title="Rhode Island withholding and payments" intro="From the state section of each W-2 (boxes 15–17). They are listed on Schedule W.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Rhode Island" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        {rows.map((x, i) => (
          <div key={i} className="grid">
            <TextField label="1099 payer" autoComplete="off" value={x.payer} onChange={(s) => setRow(i, { payer: s })} />
            <TextField label="Payer’s federal ID" autoComplete="off" value={x.ein} onChange={(s) => setRow(i, { ein: s })} />
            <TextField label="Form code" hint="R for 1099-R, I for 1099-INT, G for 1099-G…" autoComplete="off" value={x.code} onChange={(s) => setRow(i, { code: s })} />
            {married && <Check label="Spouse’s form" checked={x.owner === 'spouse'} onChange={(v) => setRow(i, { owner: v ? 'spouse' : 'taxpayer' })} />}
            <MoneyField label="Rhode Island tax withheld" value={x.tax} onChange={(n) => setRow(i, { tax: n })} />
            <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ other1099: rows.filter((_, j) => j !== i) })}>Remove</button></div>
          </div>
        ))}
        <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ other1099: [...rows, { payer: '', ein: '', code: 'R', owner: 'taxpayer', tax: 0 }] })}>Add a 1099 with Rhode Island withholding</button></div>
        <div className="grid">
          <MoneyField label="2025 estimated payments and 2024 overpayment applied" hint="Line 14b" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          {L['16'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 18" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Pensions (Schedule M lines 1t and 1v)" intro="Up to $50,000 of pension and annuity income per person at full retirement age (born on or before March 1, 1959) is subtracted if federal AGI is at most $107,000 ($133,750 joint). Military service pensions are subtracted in full.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`ri-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`ri-kind-${x.id}`} className="select" value={d.pensionKind[x.id] ?? 'none'} onChange={(e) => put({ pensionKind: { ...d.pensionKind, [x.id]: e.target.value as 'pension' | 'military' | 'none' } })}>
                  <option value="none">Not a pension or annuity</option>
                  <option value="pension">Pension or annuity (Form 1040 line 5b)</option>
                  <option value="military">Military service pension</option>
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Modifications (Schedule M)" intro={ri.m['1s'] > 0 ? `Taxable Social Security subtracted: ${usd2(ri.m['1s'])}.` : 'Taxable Social Security is subtracted for those at full retirement age under the same income limits.'}>
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Line 1a" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Railroad retirement benefits in federal AGI" hint="Line 1d" value={d.railroadRetirement} onChange={(n) => put({ railroadRetirement: n })} />
          <MoneyField label="Contributions to a Rhode Island 529 account" hint="Line 1g; up to $500 ($1,000 joint)" value={d.tuition529} onChange={(n) => put({ tuition529: n })} />
          <MoneyField label="Other decreasing modifications" value={d.otherDecreasing} onChange={(n) => put({ otherDecreasing: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Line 2a" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other increasing modifications" value={d.otherIncreasing} onChange={(n) => put({ otherIncreasing: n })} />
        </div>
      </Section>

      <Section title="Credits" intro="25% of your federal child care credit and the earned income credit (16% of federal) are worked out from your return.">
        <div className="grid">
          <TextField label="Other state you paid tax to" hint="Schedule II; two-letter abbreviation" autoComplete="off" value={d.otherState.state} onChange={(s) => put({ otherState: { ...d.otherState, state: s } })} />
          <MoneyField label="Income derived from that state" value={d.otherState.income} onChange={(n) => put({ otherState: { ...d.otherState, income: n } })} />
          <MoneyField label="Tax due and paid to that state" value={d.otherState.tax} onChange={(n) => put({ otherState: { ...d.otherState, tax: n } })} />
          {d.otherCredits > 0 && ri.cr['9'] === undefined && <MoneyField label="Other Rhode Island credits (total)" hint="Schedule CR line 9; or list them below" value={d.otherCredits} onChange={(n) => put({ otherCredits: n })} />}
        </div>
        <details open={ri.cr['9'] !== undefined || d.recapture.length > 0}>
          <summary>RI Schedule CR: other Rhode Island credits</summary>
          <p className="why">Attach the original certificate for each credit, and a carryforward schedule if you use a carryforward.</p>
          <div className="grid">
            {RI_CR.map(([k, label]) => <MoneyField key={k} label={label} hint={`Line ${k}`} value={d.crLines[k] ?? 0} onChange={(n) => put({ crLines: { ...d.crLines, [k]: n }, otherCredits: 0 })} />)}
          </div>
          <h3>Recapture of prior-year credits (lines 10–11)</h3>
          <RowList rows={d.recapture} max={2} noun="recapture" empty={() => ({ number: '', name: '', amount: 0 })} onChange={(rows) => put({ recapture: rows })}
            fields={[['number', 'Credit number', 'text', 'For example 286B'], ['name', 'Credit name', 'text'], ['amount', 'Amount recaptured', 'money']]} />
          {(L['9c'] > 0 || L['10b'] > 0) && <p className="why">Line 9c: {usd(L['9c'])}. Line 10b: {usd(L['10b'])}.</p>}
        </details>
      </Section>

      <Section title="Property tax relief (RI-1040H)" intro="Up to $700 if you or your spouse were 65 or older or disabled, your household income was $40,730 or less, and you paid property tax or rent on your Rhode Island home.">
        <div className="grid">
          <Check label="Claim the property tax relief credit" checked={d.relief.claim} onChange={(v) => putRelief({ claim: v })} />
          {d.relief.claim && <>
            <Check label="I own my home (not renting)" checked={d.relief.owner} onChange={(v) => putRelief({ owner: v })} />
            {d.relief.owner
              ? <MoneyField label="Property tax paid for 2025" value={d.relief.propertyTax} onChange={(n) => putRelief({ propertyTax: n })} />
              : <MoneyField label="Rent paid in 2025" value={d.relief.rent} onChange={(n) => putRelief({ rent: n })} />}
            <NumberField label="People in your household" max={20} value={d.relief.householdSize} onChange={(n) => putRelief({ householdSize: n })} />
            <MoneyField label="Cash public assistance received by the household" value={d.relief.publicAssistance} onChange={(n) => putRelief({ publicAssistance: n })} />
            <MoneyField label="Other non-taxable income" hint="Child support, workers’ compensation, gifts" value={d.relief.otherNontaxable} onChange={(n) => putRelief({ otherNontaxable: n })} />
            <Check label="Disabled and receiving Social Security Disability" checked={d.relief.disabled} onChange={(v) => putRelief({ disabled: v })} />
          </>}
        </div>
        {ri.h && <p className="why">Household income {usd2(ri.h['32'])}; credit {usd2(L['14c'])}.</p>}
      </Section>

      <Section title="Use tax, health coverage and contributions">
        <div className="grid">
          <MoneyField label="Use/sales tax due" hint="Line 12a, from Schedule U" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          <Check label="Everyone on the return had health coverage all year" checked={d.fullYearCoverage} onChange={(v) => put({ fullYearCoverage: v })} />
          {!d.fullYearCoverage && <MoneyField label="Individual mandate penalty" hint="Shared Responsibility Worksheet, line 15" value={d.mandatePenalty} onChange={(n) => put({ mandatePenalty: n })} />}
          <Check label="$5 ($10 joint) to the electoral fund" hint="Doesn’t change your tax or refund" checked={d.electoral} onChange={(v) => put({ electoral: v })} />
          {d.electoral && <TextField label="Political party (optional)" autoComplete="off" value={d.electoralParty} onChange={(s) => put({ electoralParty: s })} />}
          {CHECKOFFS.map(([k, label]) => (
            <MoneyField key={k} label={label} hint={`Line ${k}`} value={d.checkoffs[k] ?? 0} onChange={(n) => put({ checkoffs: { ...d.checkoffs, [k]: n } })} />
          ))}
        </div>
      </Section>

      {ri.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ri.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form RI-1040" intro="Dollars and cents.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd2(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Rhode Island forms" intro="Filled in on this device from the official Rhode Island Division of Taxation RI-1040 with Schedules W and E, Schedules M and CR, and RI-1040H.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or include these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Rhode Island forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2. For a refund, mail to RI Division of Taxation, One Capitol Hill, Providence RI 02908-5806; with a payment and Form RI-1040V, to One Capitol Hill, Providence RI 02908-5807. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
