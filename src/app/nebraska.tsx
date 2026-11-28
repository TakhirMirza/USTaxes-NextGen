/**
 * The Nebraska part of the State step: Form 1040N with Schedule I for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { NeInput, NeRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeNebraska } from '../engine/ne2025.ts'
import { buildNePacket } from '../pdf/ne2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { currentTaxYear } from '../engine/rules.ts'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['5', 'Federal adjusted gross income'], ['10', 'Standard or itemized deduction'], ['12', 'Adjustments increasing AGI (Schedule I)'], ['13', 'Adjustments decreasing AGI (Schedule I)'],
  ['14', 'Nebraska taxable income'], ['15', 'Nebraska income tax'], ['16', 'Tax on early distributions (29.6% of federal)'], ['18', 'Personal exemption credit ($171 each)'],
  ['19', 'Credit for tax paid to another state'], ['23', 'Child care credit (25% of federal)'], ['35', 'Tax after nonrefundable credits'], ['36', 'Nebraska tax withheld on W-2s'],
  ['37', 'Withheld on other forms'], ['40', 'Estimated payments'], ['42', 'Refundable child care credit'], ['44', 'Earned income credit (10% of federal)'],
  ['53', 'Total payments and refundable credits'], ['58', 'Use tax'], ['59', 'Total amount due'], ['61', 'Applied to next year’s estimated tax'], ['62', 'Wildlife Conservation Fund'], ['63', 'Refund']
]
const ALWAYS = new Set(['5', '14', '15', '35', '53'])
const KEY = new Set(['35', '59', '63'])
const KINDS: [NeRetirementKind, string][] = [['standard', 'Pension, IRA or annuity (taxed)'], ['military', 'Military retirement (excluded)'], ['railroad', 'Railroad retirement (excluded)'], ['csrs', 'Federal CSRS annuity (excluded)']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function NebraskaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ne
  const ne = useMemo(() => computeNebraska(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<NeInput>): void => set((r) => ({ ...r, ne: { ...r.ne, ...p } }))
  const putOs = (p: Partial<NeInput['otherState']>): void => put({ otherState: { ...d.otherState, ...p } })
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildNePacket(ret, result, ne, preparer)
  const L = ne.lines
  const owes = L['59'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadNebraskaForms }) => downloadNebraskaForms(ret, result, ne, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Nebraska: you owe' : 'Nebraska refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['59'] : L['63'])}</p>
        </div>
        <dl>
          <div><dt>Nebraska taxable income</dt><dd>{usd(L['14'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['35'])}</dd></div>
          <div><dt>Exemptions</dt><dd>{L['4']}</dd></div>
        </dl>
      </div>

      <Section title="Nebraska return" intro="Nebraska starts from federal AGI, subtracts its own standard deduction, exempts Social Security and military retirement, and taxes the rest at 2.46% to 5.20%. Each exemption is a $171 credit.">
        <div className="grid">
          <TextField label="High school district code" hint="From the school district list in the booklet (where you lived on Dec. 31)" autoComplete="off" value={d.schoolDistrictCode} onChange={(s) => put({ schoolDistrictCode: s })} />
        </div>
      </Section>

      <Section title="Nebraska withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Nebraska" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Nebraska tax withheld on 1099s and W-2Gs" hint="Line 37" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label={`${currentTaxYear()} estimated and extension payments`} hint="Line 40" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          {L['60'] > 0 && <MoneyField label={`Apply to ${currentTaxYear() + 1} estimated tax`} value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          {L['60'] > 0 && <MoneyField label="Wildlife Conservation Fund donation" value={d.wildlife} onChange={(n) => put({ wildlife: n })} />}
        </div>
        <div className="checks">
          <Check label="I am claiming benefits or credits from a business owned in whole or part by a foreign adversarial company (page 1 question)" checked={d.foreignAdversarial} onChange={(on) => put({ foreignAdversarial: on })} />
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement income (Schedule I)" intro="Military retirement, railroad retirement and federal CSRS annuities are excluded in Nebraska.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`ne-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`ne-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as NeRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Adjustments (Schedule I) and credits">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Line 15" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Line 1 (added back)" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="State income tax refund in federal AGI" hint="Line 14" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Nebraska 529 (NEST, Bloomwell, State Farm) contributions" hint="Line 20; up to $10,000" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <MoneyField label="Nebraska Enable plan contributions" hint="Line 22" value={d.enable} onChange={(n) => put({ enable: n })} />
          <MoneyField label="Use tax" hint="Line 58; 5.5% plus local rate on untaxed purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          <TextField label="Other state where you paid income tax" hint="Schedule II; one state" autoComplete="off" value={d.otherState.state} onChange={(s) => putOs({ state: s })} />
          <MoneyField label="AGI derived from that state" hint="Schedule II line 2; not its taxable income (see the DOR conversion chart)" value={d.otherState.agi} onChange={(n) => putOs({ agi: n })} />
          <MoneyField label="Tax due and paid to that state" hint="Line 5; from its return, not the amount withheld" value={d.otherState.tax} onChange={(n) => putOs({ tax: n })} />
        </div>
        {ne.sch2 && <p className="why">Credit for tax paid to {d.otherState.state.trim() || 'the other state'} (line 19): {usd(ne.sch2['6'])} — the least of your Nebraska tax, {(ne.sch2['3'] * 100).toFixed(2)}% of it ({usd(ne.sch2['4'])}) and the tax paid there.</p>}
        {ne.care && <p className="why">Refundable child care credit (Form 2441N, line 42): {usd(ne.care['11'])}.</p>}
      </Section>

      {ne.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ne.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 1040N" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Nebraska forms" intro="Filled in on this device from the official Nebraska Department of Revenue Form 1040N and Schedule I.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Nebraska forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. Refunds: Nebraska Department of Revenue, PO Box 98912, Lincoln NE 68509-8912; all others: PO Box 98934, Lincoln NE 68509-8934. Due April 15, {currentTaxYear() + 1}.</p>
      </Section>
    </div>
  )
}
