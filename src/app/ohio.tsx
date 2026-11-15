/**
 * The Ohio part of the State step: Form IT 1040 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { OhInput, Owner, Person } from '../engine/model.ts'
import { computeOhio, OH_DONATION_LETTERS } from '../engine/oh2025.ts'
import { buildOhPacket } from '../pdf/oh2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2a', 'Additions'], ['2b', 'Deductions'], ['3', 'Ohio adjusted gross income'],
  ['4', 'Exemptions'], ['5', 'Ohio income tax base'], ['6', 'Taxable business income'], ['7', 'Taxable nonbusiness income'],
  ['8a', 'Nonbusiness income tax'], ['8b', 'Business income tax (3%)'], ['9', 'Nonrefundable credits'], ['10', 'Tax after credits'],
  ['12', 'Use tax'], ['13', 'Total Ohio tax'], ['14', 'Ohio tax withheld'], ['15', 'Estimated payments and carryforward'],
  ['17', 'Total payments'], ['24', 'Carried forward to 2026'], ['25g', 'Donations'], ['22', 'Amount due'], ['26', 'Refund']
]
const ALWAYS = new Set(['1', '3', '4', '5', '8a', '10', '13', '17'])
const KEY = new Set(['5', '13', '22', '26'])
const DONATIONS: Record<string, string> = {
  a: 'Nature Preserves / Scenic Rivers', b: 'Breast and Cervical Cancer', c: 'Wishes for Sick Children', d: 'Wildlife Species', e: 'Military Injury Relief', f: 'Ohio History Fund'
}
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function OhioStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.oh
  const oh = useMemo(() => computeOhio(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<OhInput>): void => set((r) => ({ ...r, oh: { ...r.oh, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildOhPacket(ret, result, oh, preparer)
  const L = oh.lines
  const owes = L['22'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadOhioForms }) => downloadOhioForms(ret, result, oh, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Ohio: you owe' : 'Ohio refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['22'] : L['26'])}</p>
        </div>
        <dl>
          <div><dt>Ohio AGI</dt><dd>{usd(L['3'])}</dd></div>
          <div><dt>Ohio tax base</dt><dd>{usd(L['5'])}</dd></div>
          <div><dt>Total Ohio tax</dt><dd>{usd(L['13'])}</dd></div>
        </dl>
      </div>

      <Section title="Ohio return" intro={`Ohio taxes nothing on the first $26,050 of nonbusiness income, then 2.75% up to $100,000 and 3.125% above. Your ${oh.exemptionCount} exemption${oh.exemptionCount === 1 ? '' : 's'} total ${usd(L['4'])}.`}>
        <div className="grid">
          <TextField label="School district number" placeholder="4 digits" hint="From the list in the instructions or tax.ohio.gov/sdlookup" autoComplete="off" value={d.schoolDistrict} onChange={(s) => put({ schoolDistrict: s.replace(/\D/g, '').slice(0, 4) })} />
          <TextField label="Ohio county" autoComplete="off" value={d.county} onChange={(s) => put({ county: s })} />
          <MoneyField label="Estimated and extension payments, 2024 carryforward" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          {ret.dependents.map((dep, i) => (
            <TextField key={dep.id} label={`${dep.name.trim() || `Dependent ${i + 1}`}’s date of birth`} placeholder="MM/DD/YYYY" hint="Schedule of Dependents" autoComplete="off"
              value={d.dependentBirthDates[dep.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [dep.id]: date(s) } })} />
          ))}
        </div>
      </Section>

      <Section title="Ohio withholding" intro="From the state section of each W-2 and 1099-R. Only statements with Ohio tax withheld go on the Schedule of Ohio Withholding.">
        {w2s.length > 0 && <StatementRows kind="w2" state="Ohio" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />}
        {r1099.length > 0 && <StatementRows kind="1099r" state="Ohio" items={r1099.map((x) => ({ id: x.id, title: `1099-R: ${x.payer.trim() || 'payer'} (${names[x.owner]})`, federal: x.grossDistribution }))} value={d.r1099} onChange={(r) => put({ r1099: r })} />}
        <div className="grid">
          <MoneyField label="Other Ohio tax withheld" hint="W-2G, 1099-NEC, 1099-G" value={d.otherWithholding} onChange={(n) => put({ otherWithholding: n })} />
        </div>
      </Section>

      <Section title="Income Ohio treats differently" intro="Social Security is deducted automatically. Business income is figured from Schedule C and K-1s where you materially participate.">
        <div className="grid">
          <MoneyField label="Other states’ municipal bond interest" hint="Added back in Ohio" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="State or local tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. obligations" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="529 plan contributions" hint="Up to $4,000 per beneficiary" value={d.contributions529} onChange={(n) => put({ contributions529: n })} />
          <MoneyField label="Uniformed services retirement income" value={d.uniformedRetirement} onChange={(n) => put({ uniformedRetirement: n })} />
          <MoneyField label="Disability and survivor benefits" value={d.disabilitySurvivor} onChange={(n) => put({ disabilitySurvivor: n })} />
          <MoneyField label="Unreimbursed medical expenses" hint="From the worksheet in the instructions" value={d.medicalExpenses} onChange={(n) => put({ medicalExpenses: n })} />
          <MoneyField label="168(k) and 179 depreciation add-back" value={d.depreciationAddback} onChange={(n) => put({ depreciationAddback: n })} />
          <MoneyField label="Other additions" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Other deductions" value={d.otherDeductions} onChange={(n) => put({ otherDeductions: n })} />
          <MoneyField label="Other business income or loss" hint="Schedule of Business Income line 9" allowNegative value={d.otherBusinessIncome} onChange={(n) => put({ otherBusinessIncome: n })} />
        </div>
        {oh.business['10'] !== 0 && <p className="why">Business income {usd(oh.business['10'])}: {usd(oh.business['13'])} deducted, {usd(oh.business['15'])} taxed at 3%.</p>}
      </Section>

      <Section title="Credits, use tax and refund" intro={`Figured for you: retirement income credit ${usd(oh.credits['2'])}, senior citizen credit ${usd(oh.credits['4'])}, child care ${usd(oh.credits['6'])}, exemption credit ${usd(oh.credits['9'])}, joint filing credit ${usd(oh.credits['12'])}, Ohio earned income credit ${usd(oh.credits['13'])}.`}>
        <div className="grid">
          <MoneyField label="Resident credit for tax paid to other states" hint="From Ohio IT RC" value={d.residentCredit} onChange={(n) => put({ residentCredit: n })} />
          <MoneyField label="Other nonrefundable credits" hint="Schedule of Credits lines 14–35" value={d.otherCredits} onChange={(n) => put({ otherCredits: n })} />
          <MoneyField label="Unpaid use tax" hint="On untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['23'] > 0 && <MoneyField label="Carry forward to 2026" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        {L['23'] > 0 && (
          <details className="more">
            <summary>Donate part of your refund (line 25)</summary>
            <div className="grid">
              {OH_DONATION_LETTERS.map((k) => (
                <MoneyField key={k} label={DONATIONS[k]} value={d.donations[k] ?? 0} onChange={(n) => put({ donations: { ...d.donations, [k]: n } })} />
              ))}
            </div>
          </details>
        )}
      </Section>

      {oh.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{oh.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Ohio IT 1040" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Ohio forms" intro="Filled in on this device from the official Ohio Department of Taxation PDF.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Ohio forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2. Do not staple. Returns are due April 15, 2026. Ohio offers free filing through OH|TAX eServices at tax.ohio.gov.</p>
      </Section>
    </div>
  )
}
