/**
 * The West Virginia part of the State step: Form IT-140 with Schedule M, RECAP and FTC-1 for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { Owner, Person, WvInput, WvRetirementKind } from '../engine/model.ts'
import { computeWestVirginia } from '../engine/wv2025.ts'
import { buildWvPacket } from '../pdf/wv2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { OtherStatesList } from './otherstates'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Additions (Schedule M)'], ['3', 'Subtractions (Schedule M)'], ['4', 'West Virginia adjusted gross income'],
  ['5', 'Low-income earned income exclusion'], ['6', 'Exemptions ($2,000 each)'], ['7', 'West Virginia taxable income'], ['8', 'Income tax'],
  ['9', 'Credits (RECAP)'], ['10', 'Total income tax due'], ['13', 'Use tax'], ['15', 'West Virginia tax withheld'], ['16', 'Estimated payments'],
  ['21', 'Motor vehicle property tax adjustment credit'], ['23', 'Payments and refundable credits'], ['24', 'Balance due'], ['26', 'Donations'],
  ['27', 'Credited to 2026'], ['28', 'Refund']
]
const ALWAYS = new Set(['1', '4', '7', '8', '10', '23'])
const KEY = new Set(['10', '24', '28'])
const KINDS: [WvRetirementKind, string][] = [
  ['standard', 'Other pension or IRA (taxed)'], ['military', 'Military retirement (exempt)'], ['railroad', 'Railroad Retirement Board (exempt)'],
  ['police', 'WV police, deputy sheriff or firefighter (exempt)'], ['wvPublic', 'WV Teachers’ / PERS (up to $2,000)'], ['federal', 'Federal retirement system (up to $2,000)']
]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function WestVirginiaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.wv
  const wv = useMemo(() => computeWestVirginia(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<WvInput>): void => set((r) => ({ ...r, wv: { ...r.wv, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildWvPacket(ret, result, wv, preparer)
  const L = wv.lines
  const owes = L['24'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadWestVirginiaForms }) => downloadWestVirginiaForms(ret, result, wv, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'West Virginia: you owe' : 'West Virginia refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['24'] : L['28'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['7'])}</dd></div>
          <div><dt>Income tax</dt><dd>{usd(L['8'])}</dd></div>
          <div><dt>Family Tax Credit</dt><dd>{usd(wv.recap['2'])}</dd></div>
        </dl>
      </div>

      <Section title="West Virginia return" intro="West Virginia starts from federal AGI, subtracts Schedule M items (Social Security, military and some public pensions, the senior citizen deduction), allows $2,000 per exemption and taxes the rest at 2.22% to 4.82%. Low-income families may get the Family Tax Credit.">
        {ret.dependents.length > 0 && (
          <div className="grid">
            {ret.dependents.slice(0, 4).map((x) => (
              <TextField key={x.id} label={`${x.name.trim() || 'Dependent'}: date of birth`} placeholder="MM DD YYYY" autoComplete="off" value={d.dependentBirthDate[x.id] ?? ''} onChange={(s) => put({ dependentBirthDate: { ...d.dependentBirthDate, [x.id]: s } })} />
            ))}
          </div>
        )}
        <div className="grid">
          {owners.filter((o) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age >= 65 || d.disabled[o]).map((o) => (
            <TextField key={o} label={`${names[o]}: year of birth`} hint="Schedule M line 47, senior citizen deduction" autoComplete="off" value={d.birthYear[o]} onChange={(s) => put({ birthYear: { ...d.birthYear, [o]: s.replace(/\D/g, '').slice(0, 4) } })} />
          ))}
        </div>
        {owners.map((o) => (
          <label key={o} className="check"><input type="checkbox" checked={d.disabled[o]} onChange={(e) => put({ disabled: { ...d.disabled, [o]: e.target.checked } })} /> {names[o]} is certified permanently and totally disabled (Schedule H)</label>
        ))}
      </Section>

      <Section title="West Virginia withholding and payments" intro="From the state section of each W-2 (boxes 15–17). Attach the original W-2s.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="West Virginia" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="West Virginia tax withheld on 1099s" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="Estimated payments and extension payments" hint="Line 16" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Motor vehicle property tax adjustment credit" hint="Line 21A; vehicle personal property tax paid" value={d.motorVehicleCredit} onChange={(n) => put({ motorVehicleCredit: n })} />
          {L['25'] > 0 && <MoneyField label="Credit to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement income (Schedule M)" intro="Military, railroad and WV police / firefighter pensions are exempt; WV Teachers’ / PERS and federal pensions get up to $2,000.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`wv-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`wv-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as WvRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Modifications and credits">
        <div className="grid">
          <MoneyField label="Interest on U.S. or WV obligations" hint="Line 29" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Line 52 (added)" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="State income tax refund in federal AGI" hint="Line 38" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="WV 529 (SMART529) contributions" hint="Line 39" value={d.wv529} onChange={(n) => put({ wv529: n })} />
          <MoneyField label="WV ABLE contributions" hint="Line 43" value={d.able} onChange={(n) => put({ able: n })} />
          <MoneyField label="Other nonrefundable credits" hint="Other RECAP lines" value={d.otherCredits} onChange={(n) => put({ otherCredits: n })} />
          <MoneyField label="Use tax" hint="Line 13, Schedule UT" value={d.useTax} onChange={(n) => put({ useTax: n })} />
        </div>
        <details open={d.otherStates.length > 0}>
          <summary>Credit for income tax paid to another state (Schedule E){wv.recap['1'] > 0 ? ` — ${usd(wv.recap['1'])}` : ''}</summary>
          <p className="why">One Schedule E per state. Enter the income tax computed on that state’s return (not the amount withheld) and the net income from that state included in your West Virginia income. Taxes of cities or other countries do not count.</p>
          <OtherStatesList rows={d.otherStates} max={10} empty={() => ({ state: '', tax: 0, income: 0 })} onChange={(rows) => put({ otherStates: rows })}
            fields={[['tax', 'Income tax computed on that state’s return', 'Line 1'], ['income', 'Net income from that state in West Virginia income', 'Line 3']]} />
        </details>
      </Section>

      {L['25'] > 0 && (
        <Section title="Donations" intro="Line 26. They come out of your refund.">
          <div className="grid">
            <MoneyField label="Children’s Trust Fund" value={d.donations.A} onChange={(n) => put({ donations: { ...d.donations, A: n } })} />
            <MoneyField label="WV Dept. of Veterans Assistance" value={d.donations.B} onChange={(n) => put({ donations: { ...d.donations, B: n } })} />
            <MoneyField label="State Veterans Cemetery" value={d.donations.C} onChange={(n) => put({ donations: { ...d.donations, C: n } })} />
          </div>
        </Section>
      )}

      {wv.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{wv.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form IT-140" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="West Virginia forms" intro="Drawn on this device onto the official IT-140 pages from the West Virginia Tax Division’s 2025 booklet.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download West Virginia forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2. Refunds: WV Tax Division, PO Box 1071, Charleston WV 25324-1071; balance due: PO Box 3694, Charleston WV 25336-3694. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
