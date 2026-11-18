/**
 * The Oklahoma part of the State step: Form 511 for full-year residents, with Schedules 511-A to 511-G.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { OkInput, OkRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeOklahoma } from '../engine/ok2025.ts'
import { buildOkPacket } from '../pdf/ok2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Subtractions (Schedule 511-A)'], ['6', 'Additions (Schedule 511-B)'], ['7', 'Oklahoma adjusted gross income'],
  ['8', 'Adjustments (Schedule 511-C)'], ['10', 'Standard or itemized deduction'], ['11', 'Exemptions'], ['13', 'Oklahoma taxable income'], ['14', 'Income tax'],
  ['15', 'Child care / child tax credit'], ['16', 'Credit for tax paid to another state'], ['17', 'Other credits (511-CR)'], ['18', 'Tax after credits'],
  ['19', 'Use tax'], ['20', 'Balance'], ['21', 'Oklahoma tax withheld'], ['22', 'Estimated payments'], ['23', 'Extension payment'], ['25', 'Sales tax relief credit'],
  ['28', 'Earned income credit'], ['33', 'Total payments and credits'], ['35', 'Applied to 2026'], ['38', 'Refund'], ['39', 'Tax due']
]
const ALWAYS = new Set(['1', '7', '13', '14', '18', '20', '33'])
const KEY = new Set(['13', '18', '38', '39'])
const KINDS: [OkRetirementKind, string][] = [['other', 'IRA, 401(k), 403(b), 457 or private pension ($10,000)'], ['okgov', 'Oklahoma government or federal civil service (FERS) ($10,000)'], ['csrs', 'Federal CSRS in lieu of Social Security (all)'], ['military', 'Military retirement (all)'], ['railroad', 'U.S. Railroad Retirement Board (all)']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function OklahomaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ok
  const ok = useMemo(() => computeOklahoma(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<OkInput>): void => set((r) => ({ ...r, ok: { ...r.ok, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildOkPacket(ret, result, ok, preparer)
  const L = ok.lines
  const owes = L['39'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadOklahomaForms }) => downloadOklahomaForms(ret, result, ok, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Oklahoma: you owe' : 'Oklahoma refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['39'] : L['38'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['13'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['14'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['18'])}</dd></div>
        </dl>
      </div>

      <Section title="Oklahoma return" intro="Oklahoma taxes income at 0.25% to 4.75% after its own standard deduction and $1,000 per exemption. Social Security is not taxed.">
        <div className="grid">
          <TextField label="County where you live" autoComplete="off" value={d.county} onChange={(s) => put({ county: s })} />
          {ret.dependents.slice(0, 4).map((x) => (
            <TextField key={x.id} label={`${x.name.trim() || 'Dependent'}: date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.dependentBirthDates[x.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [x.id]: date(s) } })} />
          ))}
        </div>
      </Section>

      <Section title="Oklahoma withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Oklahoma" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Oklahoma tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2025 estimated payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement (Schedule 511-A)" intro="Military, CSRS and railroad retirement are fully excluded. Each person can exclude up to $10,000 of other retirement income, government retirement first.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`ok-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`ok-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'other'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as OkRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
            {ok.schA['3'] > 0 && owners.map((o) => (
              <TextField key={o} label={`${names[o]}: CSRS retirement claim number`} autoComplete="off" value={d.csrsClaim[o]} onChange={(s) => put({ csrsClaim: { ...d.csrsClaim, [o]: s } })} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Subtractions, additions and adjustments">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Schedule 511-A line 1 (not FNMA/GNMA)" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Schedule 511-B line 1" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Military pay exclusion" hint="Schedule 511-C line 1: active duty, Reserve and Guard pay" value={d.militaryPay} onChange={(n) => put({ militaryPay: n })} />
          <MoneyField label="Oklahoma 529 contributions" hint="Up to $10,000 ($20,000 joint)" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <TextField label="Other subtraction: type number" hint="Schedule 511-A line 17" autoComplete="off" value={d.otherSubtraction.code} onChange={(s) => put({ otherSubtraction: { ...d.otherSubtraction, code: s.replace(/\D/g, '').slice(0, 2) } })} />
          <MoneyField label="Other subtraction: amount" value={d.otherSubtraction.amount} onChange={(n) => put({ otherSubtraction: { ...d.otherSubtraction, amount: n } })} />
          <TextField label="Other addition: type number" hint="Schedule 511-B line 9" autoComplete="off" value={d.otherAddition.code} onChange={(s) => put({ otherAddition: { ...d.otherAddition, code: s.replace(/\D/g, '').slice(0, 2) } })} />
          <MoneyField label="Other addition: amount" value={d.otherAddition.amount} onChange={(n) => put({ otherAddition: { ...d.otherAddition, amount: n } })} />
          <TextField label="Other adjustment: type number" hint="Schedule 511-C line 6" autoComplete="off" value={d.otherAdjustment.code} onChange={(s) => put({ otherAdjustment: { ...d.otherAdjustment, code: s.replace(/\D/g, '').slice(0, 2) } })} />
          <MoneyField label="Other adjustment: amount" value={d.otherAdjustment.amount} onChange={(n) => put({ otherAdjustment: { ...d.otherAdjustment, amount: n } })} />
        </div>
      </Section>

      <Section title="Credits and other amounts" intro="The child care / child tax credit and the earned income credit (5% of federal) are figured for you.">
        <div className="grid">
          <MoneyField label="Credit for tax paid to another state" hint="Form 511-TX" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <TextField label="Other credit: 511-CR line number" autoComplete="off" value={d.otherCredit.code} onChange={(s) => put({ otherCredit: { ...d.otherCredit, code: s.replace(/\D/g, '').slice(0, 2) } })} />
          <MoneyField label="Other credit: amount" value={d.otherCredit.amount} onChange={(n) => put({ otherCredit: { ...d.otherCredit, amount: n } })} />
          <MoneyField label="Sales tax relief credit" hint="Form 538-S: $40 per exemption, low household income" value={d.salesTaxCredit} onChange={(n) => put({ salesTaxCredit: n })} />
          <MoneyField label="Use tax" hint="Leave 0 to certify none is due; table: 0.056% of AGI" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['34'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {ok.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ok.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 511" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Oklahoma forms" intro="Filled in on this device from the official Oklahoma Tax Commission Form 511.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Oklahoma forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. Use a paper clip, not staples. Mail to Oklahoma Tax Commission, PO Box 26800, Oklahoma City OK 73126-0800. OkTAP files for free. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
