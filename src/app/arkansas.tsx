/**
 * The Arkansas part of the State step: Form AR1000F for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { ArInput, ArRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeArkansas } from '../engine/ar2025.ts'
import { buildArPacket } from '../pdf/ar2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['8', 'Wages'], ['10', 'Interest'], ['11', 'Dividends'], ['13', 'Business income'], ['14', 'Capital gains (50% of net gain exempt)'], ['15', 'Other gains'],
  ['16', 'Nonqualified and early distributions'], ['18A', 'Your pension / IRA after the $6,000 exemption'], ['18B', 'Spouse’s pension / IRA after the $6,000 exemption'],
  ['19', 'Rents, partnerships, trusts'], ['21', 'Unemployment'], ['22', 'Other income'], ['23', 'Total income'], ['24', 'Adjustments'], ['25', 'Adjusted gross income'],
  ['27', 'Standard or itemized deduction'], ['28', 'Net taxable income'], ['29', 'Tax'], ['32', 'Additional tax on early distributions'], ['34', 'Personal tax credits'],
  ['35', 'Child care credit (20% of federal)'], ['36', 'Other credits'], ['38', 'Net tax'], ['39A', 'Withheld on W-2s'], ['39B', 'Withheld on 1099s'],
  ['40', 'Estimated tax'], ['41', 'Paid with extension'], ['44', 'Total payments'], ['48', 'Applied to 2026'], ['49', 'Check-off contributions'], ['50', 'Refund'], ['51', 'Amount due']
]
const ALWAYS = new Set(['23', '25', '28', '29', '38', '44'])
const KEY = new Set(['38', '50', '51'])
const KINDS: [ArRetirementKind, string][] = [['standard', 'Employer pension or qualified IRA'], ['military', 'U.S. military retirement (exempt)'], ['nonqualified', 'Nonqualified plan or annuity']]
const TABLE = { low: 'low income tax table', standard: 'standard deduction and regular tax table', itemized: 'itemized deductions and regular tax table' }
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function ArkansasStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ar
  const ar = useMemo(() => computeArkansas(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<ArInput>): void => set((r) => ({ ...r, ar: { ...r.ar, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildArPacket(ret, result, ar, preparer)
  const L = ar.lines
  const owes = L['51'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadArkansasForms }) => downloadArkansasForms(ret, result, ar, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Arkansas: you owe' : 'Arkansas refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['51'] : L['50'])}</p>
        </div>
        <dl>
          <div><dt>Net taxable income</dt><dd>{usd(L['28'])}</dd></div>
          <div><dt>Net tax</dt><dd>{usd(L['38'])}</dd></div>
          <div><dt>Personal credits</dt><dd>{usd(L['34'])}</dd></div>
        </dl>
      </div>

      <Section title="Arkansas return" intro={`Arkansas builds income line by line from your federal return. Social Security and U.S. military pay and retirement are exempt, half of a net capital gain is exempt, and each person’s employer pension or IRA gets a $6,000 exemption. This return uses the ${TABLE[ar.table]}.`}>
        <div className="grid">
          {owners.map((o) => (
            <MoneyField key={`m-${o}`} label={`${names[o]}: U.S. military pay in W-2 wages`} hint="Line 9; exempt" value={d.militaryPay[o]} onChange={(n) => put({ militaryPay: { ...d.militaryPay, [o]: n } })} />
          ))}
        </div>
        {owners.map((o) => (
          <label key={`d-${o}`} className="check"><input type="checkbox" checked={d.deaf[o]} onChange={(e) => put({ deaf: { ...d.deaf, [o]: e.target.checked } })} /> {names[o]} was deaf on Dec. 31, 2025 ($29 credit)</label>
        ))}
      </Section>

      <Section title="Arkansas withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Arkansas" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Arkansas tax withheld on 1099s and AR-K1s" hint="Line 39B" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2025 estimated tax paid" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
          {L['47'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          {L['47'] > 0 && <MoneyField label="Check-off contributions" hint="Line 49; attach AR1000CO" value={d.checkoff} onChange={(n) => put({ checkoff: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement income (lines 16–18)" intro="Military retirement is exempt. Employer pensions and qualified IRAs (after 59½, or on death or disability) get a $6,000 exemption per person; early distributions do not.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`ar-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`ar-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as ArRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Other adjustments and credits">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Exempt; taken out of line 10" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other income or depreciation differences" hint="Line 22, Form AR-OI" allowNegative value={d.otherIncome} onChange={(n) => put({ otherIncome: n })} />
          <MoneyField label="Arkansas-only adjustments" hint="AR1000ADJ items beyond the federal adjustments (529 plan, etc.)" value={d.extraAdjustments} onChange={(n) => put({ extraAdjustments: n })} />
          <MoneyField label="Other credits" hint="Line 36, Form AR1000TC" value={d.otherCredits} onChange={(n) => put({ otherCredits: n })} />
        </div>
      </Section>

      {ar.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ar.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form AR1000F" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Arkansas forms" intro="Filled in on this device from the official Arkansas DFA Form AR1000F.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Arkansas forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. Refunds: Arkansas State Income Tax, PO Box 1000, Little Rock AR 72203-1000. Tax due or no tax: PO Box 2144, Little Rock AR 72203-2144. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
