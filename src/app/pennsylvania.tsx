/**
 * The Pennsylvania part of the State step: Form PA-40 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { Owner, PaInput, Person } from '../engine/model.ts'
import { computePennsylvania } from '../engine/pa2025.ts'
import { buildPaPacket } from '../pdf/pa2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { RowList } from './creditrows'
import type { RowField } from './creditrows'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1c', 'Net compensation'], ['2', 'Interest'], ['3', 'Dividends and capital gain distributions'], ['4', 'Business income (loss)'],
  ['5', 'Gains (losses) from sales of property'], ['6', 'Rents and royalties (loss)'], ['8', 'Gambling and lottery winnings'],
  ['9', 'Total PA taxable income'], ['10', 'Other deductions (Schedule O)'], ['11', 'Adjusted PA taxable income'], ['12', 'Tax (3.07%)'],
  ['13', 'PA tax withheld'], ['18', 'Estimated payments and credits'], ['21', 'Tax Forgiveness'], ['22', 'Resident credit'],
  ['23', 'Other credits'], ['24', 'Total payments and credits'], ['25', 'Use tax'], ['28', 'Amount you owe'], ['31', 'Credited to 2026'], ['30', 'Refund']
]
const ALWAYS = new Set(['9', '11', '12', '24'])
const KEY = new Set(['9', '11', '12', '28', '30'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function PennsylvaniaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.pa
  const pa = useMemo(() => computePennsylvania(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<PaInput>): void => set((r) => ({ ...r, pa: { ...r.pa, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildPaPacket(ret, result, pa, preparer)
  const L = pa.lines
  const owes = L['28'] > 0
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadPennsylvaniaForms }) => downloadPennsylvaniaForms(ret, result, pa, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }

  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Pennsylvania: you owe' : 'Pennsylvania refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['28'] : L['30'])}</p>
        </div>
        <dl>
          <div><dt>PA taxable income</dt><dd>{usd(L['11'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['12'])}</dd></div>
          <div><dt>Tax Forgiveness</dt><dd>{usd(L['21'])}</dd></div>
        </dl>
      </div>

      <Section title="Pennsylvania return" intro="Pennsylvania taxes eight classes of income at a flat 3.07%, with no standard deduction. Social Security, unemployment and retirement benefits are not taxed; 401(k) contributions are.">
        <div className="grid">
          <TextField label="School district" value={d.schoolDistrict} onChange={(s) => put({ schoolDistrict: s })} />
          <TextField label="School code" placeholder="5 digits" hint="From the list in the PA-40 instructions" value={d.schoolCode} onChange={(s) => put({ schoolCode: s.replace(/\D/g, '').slice(0, 5) })} />
          <MoneyField label="PA compensation (W-2 box 16)" hint={d.compensation === null ? 'Using W-2 box 1 plus 401(k) deferrals; change it if box 16 differs' : 'Line 1a'} value={d.compensation ?? L['1a']} onChange={(n) => put({ compensation: n })} />
          <MoneyField label="Unreimbursed employee business expenses" hint="PA Schedule UE" value={d.unreimbursedExpenses} onChange={(n) => put({ unreimbursedExpenses: n })} />
        </div>
      </Section>

      <Section title="PA tax withheld and paid" intro="PA tax withheld shows in W-2 box 17 (state PA). Local earned income tax (box 19) is not part of this return.">
        <div className="grid">
          <MoneyField label="PA income tax withheld" value={d.withholding} onChange={(n) => put({ withholding: n })} />
          <MoneyField label="2025 estimated payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Credit from your 2024 PA return" value={d.priorYearCredit} onChange={(n) => put({ priorYearCredit: n })} />
          <MoneyField label="Extension payment" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
      </Section>

      <Section title="Income Pennsylvania treats differently">
        <div className="grid">
          <MoneyField label="Interest on U.S. obligations" hint="Not taxed in PA" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Taxed in PA" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Gambling and lottery winnings" hint="PA Schedule T" value={d.gamblingWinnings} onChange={(n) => put({ gamblingWinnings: n })} />
          {owners.map((o) => (
            <MoneyField key={o} label={`${names[o]}: 529 plan contributions`} hint="Up to $19,000 per beneficiary (Schedule O)" value={d.tuitionContributions[o]} onChange={(n) => put({ tuitionContributions: { ...d.tuitionContributions, [o]: n } })} />
          ))}
        </div>
        {(d.tuitionContributions.taxpayer + d.tuitionContributions.spouse > 0 || d.beneficiaries529.length > 0) && (
          <details className="explain" open={d.beneficiaries529.length > 0}>
            <summary>{d.beneficiaries529.length ? `Beneficiaries listed (${d.beneficiaries529.length}) — the 529 amounts are their totals, up to $19,000 each` : 'List each 529 beneficiary (Schedule O Part I)'}</summary>
            <RowList
              rows={d.beneficiaries529}
              max={30}
              noun="beneficiary"
              empty={() => ({ name: '', ssn: '', taxpayer: 0, spouse: 0 })}
              fields={[['name', 'Beneficiary name', 'text'], ['ssn', 'Beneficiary SSN', 'text'], ['taxpayer', `${names.taxpayer}: contributions`, 'money'], ...(owners.includes('spouse') ? [['spouse', `${names.spouse}: contributions`, 'money'] as RowField<{ name: string; ssn: string; taxpayer: number; spouse: number }>] : [])]}
              onChange={(rows) => put({ beneficiaries529: rows, tuitionContributions: { taxpayer: rows.reduce((s, b) => s + b.taxpayer, 0), spouse: rows.reduce((s, b) => s + b.spouse, 0) } })}
            />
          </details>
        )}
        {L['10'] > 0 && <p className="why">Schedule O deductions: {usd(L['10'])} (529 {usd(pa.scheduleO.tuition.taxpayer + pa.scheduleO.tuition.spouse)}, HSA {usd(pa.scheduleO.hsa)}, student loan interest {usd(pa.scheduleO.studentLoan)}).</p>}
      </Section>

      <Section title="Tax Forgiveness and credits" intro={`Low-income households get some or all of their tax forgiven (Schedule SP). Eligibility income: ${usd(pa.forgiveness.eligibility)}; forgiven: ${Math.round(pa.forgiveness.percent * 100)}%.`}>
        <div className="grid">
          <MoneyField label="Other eligibility income" hint="Alimony, gifts, insurance proceeds, nontaxable military pay… (Schedule SP)" value={d.otherEligibilityIncome} onChange={(n) => put({ otherEligibilityIncome: n })} />
          {ret.filingStatus === 'mfs' && <MoneyField label="Spouse’s eligibility income" value={d.spouseEligibilityIncome} onChange={(n) => put({ spouseEligibilityIncome: n })} />}
          <MoneyField label="Resident credit for tax paid to other states" hint="PA Schedule G-L" value={d.residentCredit} onChange={(n) => put({ residentCredit: n })} />
          <MoneyField label="Other credits" hint="PA Schedule OC" value={d.otherCredits} onChange={(n) => put({ otherCredits: n })} />
          <MoneyField label="Use tax" hint="On untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['29'] > 0 && <MoneyField label="Credit to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        {pa.wptc > 0 && <p className="why">Working Pennsylvanians Tax Credit: about {usd(pa.wptc)} more, figured by the Department from your federal EITC and added to your refund. Attach a copy of your federal Form 1040.</p>}
      </Section>

      {pa.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{pa.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form PA-40" intro="Whole dollars. A loss in one class of income does not reduce another class.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{L[k] < 0 ? `(${usd(-L[k])})` : usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Pennsylvania forms" intro="Filled in on this device from the official PA Department of Revenue PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Pennsylvania forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2 and include W-2s showing PA withholding. Returns are due April 15, 2026. Pennsylvania offers free filing on myPATH.</p>
      </Section>
    </div>
  )
}
