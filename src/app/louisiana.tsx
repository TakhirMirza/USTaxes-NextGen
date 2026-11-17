/**
 * The Louisiana part of the State step: Form IT-540 for full-year residents (flat 3% from 2025).
 */
import { ReactElement, useMemo, useState } from 'react'
import type { LaInput, LaRetirementCode, Owner, Person } from '../engine/model.ts'
import { computeLouisiana } from '../engine/la2025.ts'
import { buildLaPacket } from '../pdf/la2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['7', 'Federal AGI, or Louisiana AGI from Schedule E'], ['8', 'Standard deduction'], ['9D', 'Excess federal medical deduction'], ['10', 'Louisiana taxable income'],
  ['11', 'Tax (3%)'], ['12', 'Credit for tax paid to other states'], ['13', 'Tax after priority 1 credits'], ['14', 'Refundable child care credit'],
  ['16', 'Earned income credit'], ['17', 'Other refundable credits'], ['19', 'Tax after refundable credits'], ['20', 'Overpayment of refundable credits'],
  ['21', 'Nonrefundable credits (Schedule J)'], ['22', 'Adjusted income tax'], ['23A', 'Consumer use tax'], ['23B', 'Road usage fee'], ['24', 'Total tax'],
  ['26', 'Priority 4 refundable credits'], ['27', 'Louisiana tax withheld'], ['28', 'Credit carried forward from 2024'], ['29', 'Estimated payments'],
  ['30', 'Extension payment'], ['31', 'Total credits and payments'], ['37', 'Credited to 2026'], ['38', 'Refund'], ['47', 'Balance due']
]
const ALWAYS = new Set(['7', '8', '10', '11', '22', '24', '31'])
const KEY = new Set(['10', '22', '38', '47'])
const CODES: [LaRetirementCode, string][] = [['02E', 'Louisiana State Employees’ Retirement'], ['03E', 'Louisiana Teachers’ Retirement'], ['04E', 'Federal or military retirement'], ['05E', 'Other exempt Louisiana system']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function LouisianaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.la
  const la = useMemo(() => computeLouisiana(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<LaInput>): void => set((r) => ({ ...r, la: { ...r.la, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildLaPacket(ret, result, la, preparer)
  const L = la.lines
  const owes = L['47'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadLouisianaForms }) => downloadLouisianaForms(ret, result, la, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Louisiana: you owe' : 'Louisiana refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['47'] : L['38'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['10'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['11'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['22'])}</dd></div>
        </dl>
      </div>

      <Section title="Louisiana return" intro="From 2025 Louisiana taxes income at a flat 3% after a $12,500 standard deduction ($25,000 for joint filers, heads of household and surviving spouses). Personal and dependent exemptions were repealed.">
        <div className="grid">
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
          {ret.dependents.slice(0, 8).map((x) => (
            <TextField key={x.id} label={`${x.name.trim() || 'Dependent'}: date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.dependentBirthDates[x.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [x.id]: date(s) } })} />
          ))}
        </div>
      </Section>

      <Section title="Louisiana withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Louisiana" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Louisiana tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="Credit carried forward from 2024" hint="2024 IT-540 line 36" value={d.priorYearCredit} onChange={(n) => put({ priorYearCredit: n })} />
          <MoneyField label="2025 estimated payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
      </Section>

      <Section title="Exempt income (Schedule E)" intro="Taxable Social Security is exempt, and each person 65 or older can exempt up to $12,000 of pensions, annuities and IRA distributions. Benefits from the Louisiana state, teachers’ and federal systems are fully exempt: enter them here.">
        <div className="grid">
          {CODES.flatMap(([code, label]) => owners.map((o) => (
            <MoneyField key={`${code}-${o}`} label={`${names[o]}: ${label}`} hint={`Code ${code}`} value={d.exemptRetirement[code][o]} onChange={(n) => put({ exemptRetirement: { ...d.exemptRetirement, [code]: { ...d.exemptRetirement[code], [o]: n } } })} />
          )))}
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}: month and year retired`} hint="MMYYYY, for codes 02E–05E" autoComplete="off" value={d.retired[o]} onChange={(s) => put({ retired: { ...d.retired, [o]: s.replace(/\D/g, '').slice(0, 6) } })} />
          ))}
          <TextField label="Name of the other exempt system (05E)" autoComplete="off" value={d.otherRetirementSystem} onChange={(s) => put({ otherRetirementSystem: s })} />
          <MoneyField label="Interest on U.S. government obligations" hint="Code 01E" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="START Savings Program contributions" hint="Code 09E" value={d.startContributions} onChange={(n) => put({ startContributions: n })} />
          <MoneyField label="Military pay exclusion" hint="Code 10E" value={d.militaryPay} onChange={(n) => put({ militaryPay: n })} />
          <MoneyField label="Private school tuition deduction" hint="Code 17E: up to $6,000 per child" value={d.schoolTuition} onChange={(n) => put({ schoolTuition: n })} />
          <MoneyField label="Home-school expense deduction" hint="Code 18E: 50% of expenses, up to $6,000 per child" value={d.homeSchool} onChange={(n) => put({ homeSchool: n })} />
          <MoneyField label="Public school expense deduction" hint="Code 19E: 50% of uniforms, books and supplies, up to $6,000 per child" value={d.publicSchool} onChange={(n) => put({ publicSchool: n })} />
          <MoneyField label="Interest on other states’ bonds" hint="Added back (line 2A)" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <TextField label="Other exempt income: code" hint="Two digits from the Schedule E table" autoComplete="off" value={d.otherExempt.code} onChange={(s) => put({ otherExempt: { ...d.otherExempt, code: s.replace(/\D/g, '').slice(0, 2) } })} />
          <TextField label="Other exempt income: description" autoComplete="off" value={d.otherExempt.description} onChange={(s) => put({ otherExempt: { ...d.otherExempt, description: s } })} />
          <MoneyField label="Other exempt income: amount" value={d.otherExempt.amount} onChange={(n) => put({ otherExempt: { ...d.otherExempt, amount: n } })} />
        </div>
        {la.exempt.length > 0 && <p className="why">Exempt on Schedule E: {la.exempt.map((x) => `${x.code}E ${usd(x.amount)}`).join(', ')}.</p>}
      </Section>

      <Section title="Credits and other amounts" intro="The earned income credit (5% of the federal credit) and the child care credits are figured from the federal return.">
        <div className="grid">
          <MoneyField label="Tax paid to other states (R-10606, line 1A)" value={d.otherStateTax} onChange={(n) => put({ otherStateTax: n })} />
          <MoneyField label="Credit for tax paid to other states (line 1B)" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <MoneyField label="Child care credit carried forward (2020–2024)" value={d.childCareCarryforward} onChange={(n) => put({ childCareCarryforward: n })} />
          <MoneyField label="Other refundable credits (Schedule F)" value={d.otherRefundableCredits} onChange={(n) => put({ otherRefundableCredits: n })} />
          <MoneyField label="Refundable priority 4 credits (Schedule I)" value={d.priority4Credits} onChange={(n) => put({ priority4Credits: n })} />
          <TextField label="Other Schedule J credit: code" hint="Three digits" autoComplete="off" value={d.otherCredit.code} onChange={(s) => put({ otherCredit: { ...d.otherCredit, code: s.replace(/\D/g, '').slice(0, 3) } })} />
          <TextField label="Other Schedule J credit: description" autoComplete="off" value={d.otherCredit.description} onChange={(s) => put({ otherCredit: { ...d.otherCredit, description: s } })} />
          <MoneyField label="Other Schedule J credit: amount" value={d.otherCredit.amount} onChange={(n) => put({ otherCredit: { ...d.otherCredit, amount: n } })} />
          <MoneyField label="Consumer use tax" hint="9% of untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          <MoneyField label="Electric or hybrid vehicle road usage fee" hint="Form R-19000A" value={d.roadUsageFee} onChange={(n) => put({ roadUsageFee: n })} />
          {L['36'] > 0 && <MoneyField label="Credit to 2026 income tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <p className="why">
          {L['16'] > 0 ? `Earned income credit: ${usd(L['16'])}. ` : ''}
          {L['14'] > 0 ? `Refundable child care credit: ${usd(L['14'])}. ` : ''}
          {la.schJ['2'] > 0 ? `Nonrefundable child care credit: ${usd(la.schJ['2'])}.` : ''}
        </p>
      </Section>

      {la.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{la.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="IT-540" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Louisiana forms" intro="Filled in on this device from the official Louisiana Department of Revenue IT-540; only the schedules and worksheets you need are included.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Louisiana forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 4 and mail all four pages together (paperclip, no staples) with your W-2s: balance due to Department of Revenue, PO Box 3550, Baton Rouge LA 70821-3550; all other returns to PO Box 3440, Baton Rouge LA 70821-3440. LaTAP files for free. Due May 15, 2026.</p>
      </Section>
    </div>
  )
}
