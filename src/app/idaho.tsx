/**
 * The Idaho part of the State step: Form 40 with Form 39R for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { IdInput, IdRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeIdaho } from '../engine/id2025.ts'
import { buildIdPacket } from '../pdf/id2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['7', 'Federal adjusted gross income'], ['8', 'Additions (Form 39R)'], ['10', 'Subtractions (Form 39R)'], ['11', 'Total adjusted income'],
  ['15', 'Itemized deductions less state income taxes'], ['16', 'Standard deduction'], ['18', 'QBI and Schedule 1-A deductions'], ['19', 'Idaho taxable income'],
  ['20', 'Tax'], ['21', 'Tax paid to other states'], ['22', 'Form 39R Part D credits'], ['24', 'Idaho child tax credit'], ['26', 'Tax after credits'],
  ['28', 'Use tax'], ['31', 'Permanent building fund'], ['32', 'Total tax'], ['41', 'Total tax plus donations'], ['42', 'Parental Choice Tax Credit'],
  ['43', 'Food tax credit'], ['44', 'Home for a family member 65+ or disabled'], ['46', 'Idaho tax withheld'], ['47', 'Estimated payments'],
  ['48', 'Paid by pass-through entity'], ['50', 'Total payments and credits'], ['56applied', 'Applied to 2026'], ['54', 'Amount you owe'], ['56', 'Refund']
]
const ALWAYS = new Set(['7', '11', '19', '20', '32', '50'])
const KEY = new Set(['32', '54', '56'])
const KINDS: [IdRetirementKind, string][] = [['none', 'Not eligible (IRA, 401(k), FERS, PERSI base plan…)'], ['military', 'Military retirement'], ['qualified', 'CSRS civil service, Idaho firefighter or city police']]
const DONATIONS: [string, string][] = [['33', 'Nongame Wildlife Fund'], ['34', 'Children’s Trust Fund'], ['35', 'Special Olympics Idaho'], ['36', 'Guard & Reserve Family'], ['37', 'American Red Cross of Idaho'], ['38', 'Veterans Support Fund'], ['39', 'Idaho Food Bank Fund'], ['40', 'Opportunity Scholarship Program']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function IdahoStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.id
  const id = useMemo(() => computeIdaho(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<IdInput>): void => set((r) => ({ ...r, id: { ...r.id, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildIdPacket(ret, result, id, preparer)
  const L = id.lines
  const owes = L['54'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const members = d.homeMembers
  const setMember = (i: number, p: Partial<IdInput['homeMembers'][number]>): void => put({ homeMembers: members.map((m, j) => (j === i ? { ...m, ...p } : m)) })
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadIdahoForms }) => downloadIdahoForms(ret, result, id, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Idaho: you owe' : 'Idaho refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['54'] : L['56'])}</p>
        </div>
        <dl>
          <div><dt>Idaho taxable income</dt><dd>{usd(L['19'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['32'])}</dd></div>
          <div><dt>Food tax credit</dt><dd>{usd(L['43'])}</dd></div>
        </dl>
      </div>

      <Section title="Idaho return" intro="Idaho starts from federal adjusted gross income, uses the federal standard deduction amounts and taxes income above $4,811 ($9,622 joint or head of household) at 5.3%. Social Security is not taxed.">
        {ret.dependents.length > 0 && (
          <div className="grid">
            {ret.dependents.map((dep) => (
              <TextField key={dep.id} label={`${dep.name.trim() || 'Dependent'}: birthdate`} placeholder="mm/dd/yyyy" autoComplete="off"
                value={d.dependentBirthDates[dep.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [dep.id]: date(s) } })} />
            ))}
          </div>
        )}
        <p className="why">{id.itemize ? `Itemizing: federal Schedule A less state income or sales taxes, ${usd(L['15'])}.` : `Standard deduction ${usd(L['16'])}.`}</p>
      </Section>

      <Section title="Idaho withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Idaho" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Idaho tax withheld on 1099s" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="Form 51 estimated and extension payments" hint="Line 47; include the 2024 overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Tax paid or withheld by a pass-through entity" hint="Line 48; from Form ID K-1" value={d.passThrough} onChange={(n) => put({ passThrough: n })} />
          {L['55'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 56" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement benefits deduction (Form 39R line 8)" intro="Up to $48,216 ($72,324 joint), less Social Security received, for military retirement and a few public pensions. Other retirees must be 65, or 62 and disabled.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`id-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`id-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'none'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as IdRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
            {owners.map((o) => (
              <Check key={o} label={`${names[o]}: classified as disabled`} hint="By Social Security, a 10% service-connected rating, or a physician" checked={d.disabled[o]} onChange={(v) => put({ disabled: { ...d.disabled, [o]: v } })} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Additions and subtractions (Form 39R)">
        <div className="grid">
          <MoneyField label="Interest on other states’ municipal bonds" hint="Part A line 3" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other additions" hint="Part A line 6" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="State income tax refund in federal income" hint="Part B line 2; only if you itemized federally" value={d.stateRefund} onChange={(n) => put({ stateRefund: n })} />
          <MoneyField label="Interest on U.S. government obligations" hint="Part B line 3" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="IDeal college savings contributions" hint="Part B line 14; up to $6,000 ($12,000 joint)" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <MoneyField label="Health insurance premiums" hint="Line 18; not paid pre-tax or deducted elsewhere" value={d.healthPremiums} onChange={(n) => put({ healthPremiums: n })} />
          <MoneyField label="Long-term care insurance premiums" hint="Line 19" value={d.longTermCarePremiums} onChange={(n) => put({ longTermCarePremiums: n })} />
          <MoneyField label="Other subtractions" hint="Line 23; include an explanation" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
        </div>
        {id.s39['B6'] > 0 && <p className="why">Child and dependent care subtraction (line 6): {usd(id.s39['B6'])}.</p>}
      </Section>

      <Section title="Credits" intro={`The child tax credit ($205 for each child 16 or under) and the food tax credit ($155 a person) are worked out from your return.${id.qualifyingChildren ? ` Qualifying children: ${id.qualifyingChildren}.` : ''}`}>
        <div className="grid">
          <TextField label="Other state you paid tax to" hint="Form 39R Part C" autoComplete="off" value={d.otherState.name} onChange={(s) => put({ otherState: { ...d.otherState, name: s } })} />
          <MoneyField label="Income taxed by both states" value={d.otherState.income} onChange={(n) => put({ otherState: { ...d.otherState, income: n } })} />
          <MoneyField label="Other state’s tax after its credits" value={d.otherState.tax} onChange={(n) => put({ otherState: { ...d.otherState, tax: n } })} />
          <MoneyField label="Educational, youth facility and organ donation credits" hint="Form 39R Part D line 4" value={d.partDCredits} onChange={(n) => put({ partDCredits: n })} />
          <MoneyField label="Parental Choice Tax Credit" hint="Line 42; approved expenses" value={d.parentalChoice} onChange={(n) => put({ parentalChoice: n })} />
          <Check label="Donate my food tax credit to the Cooperative Welfare Fund" checked={d.donateFoodCredit} onChange={(v) => put({ donateFoodCredit: v })} />
        </div>
        <p className="why">Family members age 65 or older (not you or your spouse) or developmentally disabled that you kept a home for and supported: $100 each, up to three.</p>
        {members.map((m, i) => (
          <div key={i} className="grid">
            <TextField label="Name" autoComplete="off" value={m.name} onChange={(s) => setMember(i, { name: s })} />
            <TextField label="SSN" autoComplete="off" value={m.ssn} onChange={(s) => setMember(i, { ssn: s })} />
            <TextField label="Relationship" autoComplete="off" value={m.relationship} onChange={(s) => setMember(i, { relationship: s })} />
            <TextField label="Birthdate" placeholder="mm/dd/yyyy" autoComplete="off" value={m.birthDate} onChange={(s) => setMember(i, { birthDate: date(s) })} />
            <Check label="Developmentally disabled" checked={m.disabled} onChange={(v) => setMember(i, { disabled: v })} />
            <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ homeMembers: members.filter((_, j) => j !== i) })}>Remove</button></div>
          </div>
        ))}
        {members.length < 3 && <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ homeMembers: [...members, { name: '', ssn: '', relationship: '', birthDate: '', disabled: false }] })}>Add family member</button></div>}
      </Section>

      <Section title="Other taxes and donations" intro="Donations reduce your refund or add to what you owe.">
        <div className="grid">
          <MoneyField label="Use tax on untaxed purchases" hint="Line 28; online or out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          <Check label="Received Idaho public assistance at the end of 2025" hint="No $10 permanent building fund tax (food stamps and WIC don’t count)" checked={d.publicAssistance} onChange={(v) => put({ publicAssistance: v })} />
          {DONATIONS.map(([k, label]) => (
            <MoneyField key={k} label={label} hint={`Line ${k}`} value={d.donations[k] ?? 0} onChange={(n) => put({ donations: { ...d.donations, [k]: n } })} />
          ))}
        </div>
      </Section>

      {id.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{id.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 40" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k === '56applied' ? '56' : k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Idaho forms" intro="Filled in on this device from the official Idaho State Tax Commission Form 40 and Form 39R.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Include these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Idaho forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. With a payment, mail to Idaho State Tax Commission, PO Box 83784, Boise ID 83707-3784; otherwise to PO Box 56, Boise ID 83756-0056. Don’t staple. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
