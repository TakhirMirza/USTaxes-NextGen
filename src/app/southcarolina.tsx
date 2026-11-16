/**
 * The South Carolina part of the State step: SC1040 for full-year residents, built on federal taxable income.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { Owner, Person, ScInput } from '../engine/model.ts'
import { computeSouthCarolina } from '../engine/sc2025.ts'
import { buildScPacket } from '../pdf/sc2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal taxable income'], ['a', 'State tax addback'], ['d', 'Other states’ bond interest'], ['e', 'Other additions (incl. QBI deduction)'],
  ['3', 'Subtotal'], ['f', 'State tax refund'], ['g', 'Disability retirement'], ['i', '44% of net long-term capital gain'], ['k', 'Future Scholar / tuition prepayment'],
  ['m', 'U.S. government interest'], ['o', 'Social Security'], ['p-1', 'Retirement deduction (you)'], ['p-2', 'Retirement deduction (spouse)'],
  ['p-4', 'Military retirement (you)'], ['p-5', 'Military retirement (spouse)'], ['q-1', 'Age 65 deduction (you)'], ['q-2', 'Age 65 deduction (spouse)'],
  ['s', 'Subsistence allowance'], ['t', 'Dependents under 6'], ['v', 'Other subtractions'], ['w', 'Dependent exemption'], ['4', 'Total subtractions'],
  ['5', 'South Carolina income subject to tax'], ['6', 'Tax'], ['11', 'Child and dependent care credit'], ['12', 'Two wage earner credit'],
  ['13', 'Other nonrefundable credits'], ['15', 'Tax after credits'], ['16', 'SC tax withheld'], ['17', 'Estimated payments'], ['18', 'Extension payment'],
  ['20', 'Other SC withholding'], ['21', 'Tuition tax credit'], ['22', 'Other refundable credits'], ['23', 'Total payments'], ['26', 'Use tax'],
  ['27', 'Credited to 2026'], ['28', 'Check-off contributions'], ['30', 'Refund'], ['34', 'Balance due']
]
const ALWAYS = new Set(['1', '3', '4', '5', '6', '15', '23'])
const KEY = new Set(['5', '15', '30', '34'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function SouthCarolinaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.sc
  const sc = useMemo(() => computeSouthCarolina(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<ScInput>): void => set((r) => ({ ...r, sc: { ...r.sc, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildScPacket(ret, result, sc, preparer)
  const L = sc.lines
  const owes = L['34'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadSouthCarolinaForms }) => downloadSouthCarolinaForms(ret, result, sc, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'South Carolina: you owe' : 'South Carolina refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['34'] : L['30'])}</p>
        </div>
        <dl>
          <div><dt>Income subject to tax</dt><dd>{usd(L['5'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['6'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['15'])}</dd></div>
        </dl>
      </div>

      <Section title="South Carolina return" intro="South Carolina starts from federal taxable income: no tax on the first $3,560, then 3%, and 6% above $17,830. Each dependent is a $4,930 deduction, twice for children under 6.">
        <div className="grid">
          <TextField label="County code" hint="From the SC1040 instructions" autoComplete="off" value={d.countyCode} onChange={(s) => put({ countyCode: s.replace(/\D/g, '').slice(0, 2) })} />
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
        </div>
      </Section>

      <Section title="South Carolina withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="South Carolina" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="SC tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2025 estimated payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
      </Section>

      <Section title="Additions and subtractions" intro="Social Security is not taxed; retirement income gets a $3,000 deduction ($10,000 at 65), and everyone 65 or older gets up to $15,000.">
        <div className="grid">
          <MoneyField label="State tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. government obligations" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          {owners.map((o) => (
            <MoneyField key={o} label={`${names[o]}: military retirement`} hint="Fully deductible" value={d.militaryRetirement[o]} onChange={(n) => put({ militaryRetirement: { ...d.militaryRetirement, [o]: n } })} />
          ))}
          <MoneyField label="Total and permanent disability retirement" value={d.disabilityRetirement} onChange={(n) => put({ disabilityRetirement: n })} />
          <MoneyField label="Future Scholar or tuition prepayment contributions" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <NumberField label="Workdays for the subsistence allowance" hint="Police, firefighters, EMS: $16 a day" max={366} value={d.subsistenceDays} onChange={(n) => put({ subsistenceDays: n })} />
          <MoneyField label="Other subtractions" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <MoneyField label="Interest on other states’ bonds" hint="Taxed in South Carolina" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other additions" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
        </div>
      </Section>

      <Section title="Credits and refund">
        <div className="grid">
          <MoneyField label="Other nonrefundable credits (SC1040TC)" value={d.nonrefundableCredits} onChange={(n) => put({ nonrefundableCredits: n })} />
          <MoneyField label="Tuition tax credit (I-319)" value={d.tuitionCredit} onChange={(n) => put({ tuitionCredit: n })} />
          <MoneyField label="Other refundable credits (line 22)" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
          <MoneyField label="Use tax on out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          <MoneyField label="Check-off contributions (I-330)" value={d.checkoffs} onChange={(n) => put({ checkoffs: n })} />
          {L['24'] > 0 && <MoneyField label="Credit to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <p className="why">
          {L['11'] > 0 ? `Child and dependent care credit: ${usd(L['11'])} (7% of federal expenses). ` : ''}
          {L['12'] > 0 ? `Two wage earner credit: ${usd(L['12'])}.` : ''}
        </p>
      </Section>

      {sc.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{sc.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="SC1040" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="South Carolina forms" intro="Filled in on this device from the official South Carolina Department of Revenue SC1040.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download South Carolina forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3 and mail: refunds or zero tax to SC1040 Processing Center, PO Box 101100, Columbia SC 29211-0100; balance due to Taxable Processing Center, PO Box 101105, Columbia SC 29211-0105. MyDORWAY files for free. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
