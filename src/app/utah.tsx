/**
 * The Utah part of the State step: Form TC-40 for full-year residents (flat 4.5%).
 */
import { ReactElement, useMemo, useState } from 'react'
import type { Owner, Person, UtInput } from '../engine/model.ts'
import { computeUtah } from '../engine/ut2025.ts'
import { buildUtPacket } from '../pdf/ut2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['4', 'Federal adjusted gross income'], ['5', 'Additions (TC-40A Part 1)'], ['8', 'Subtractions (TC-40A Part 2)'], ['9', 'Utah taxable income'],
  ['10', 'Utah tax (4.5%)'], ['11', 'Personal exemptions ($2,111 each)'], ['12', 'Federal standard or itemized deduction'], ['16', 'Initial credit before phase-out (6%)'],
  ['19', 'Phase-out (1.3% above the base amount)'], ['20', 'Taxpayer tax credit'], ['22', 'Tax after the taxpayer tax credit'], ['24', 'Apportionable credits (TC-40A Part 3)'],
  ['26', 'Nonapportionable credits (TC-40A Part 4)'], ['31', 'Use tax'], ['32', 'Total tax'], ['33', 'Utah tax withheld'], ['34', 'Prepayments'],
  ['38', 'Total payments'], ['41', 'Amount you owe'], ['44', 'Refund']
]
const ALWAYS = new Set(['4', '9', '10', '20', '22', '32', '38'])
const KEY = new Set(['32', '41', '44'])
const CREDITS: Record<string, string> = { '18': 'Retirement credit', AH: 'Social Security benefits credit', AJ: 'Military retirement credit', AM: 'Earned income credit (20% of federal)', AT: 'Child tax credit (children 5 and under)', '20': 'my529 credit', '17': 'Credit for tax paid to another state' }
const KINDS: [UtInput['retirementKind'][string], string][] = [['standard', 'Pension, IRA or annuity'], ['military', 'Military retirement'], ['railroad', 'Railroad retirement (Tier 1/2)']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function UtahStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ut
  const ut = useMemo(() => computeUtah(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<UtInput>): void => set((r) => ({ ...r, ut: { ...r.ut, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildUtPacket(ret, result, ut, preparer)
  const L = ut.lines
  const owes = L['41'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const older = owners.filter((o) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age >= 70)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadUtahForms }) => downloadUtahForms(ret, result, ut, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const credits = [...ut.apportionable, ...ut.nonapportionable]
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Utah: you owe' : 'Utah refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['41'] : L['44'])}</p>
        </div>
        <dl>
          <div><dt>Utah taxable income</dt><dd>{usd(L['9'])}</dd></div>
          <div><dt>Taxpayer tax credit</dt><dd>{usd(L['20'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['32'])}</dd></div>
        </dl>
      </div>

      <Section title="Utah return" intro="Utah taxes federal adjusted gross income at a flat 4.5%, then gives a taxpayer tax credit of 6% of your federal deduction plus $2,111 per dependent, reduced by 1.3% of income above a base amount. If your federal AGI is not more than your federal standard deduction you owe nothing.">
        {ut.exempt && <p className="note">You are a qualified exempt taxpayer: line 21 is checked and your Utah tax is zero.</p>}
        {older.length > 0 && (
          <div className="grid">
            {older.map((o) => (
              <TextField key={o} label={`${names[o]}: date of birth`} hint="MM/DD/YYYY — born before 1953 qualifies for the $450 retirement credit" placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: s } })} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Utah withholding and payments" intro="From the state section of each W-2 (boxes 15–17). They go on schedule TC-40W.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Utah" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Utah tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2025 prepayments" hint="Estimated and extension payments, 2024 refund applied (line 34)" value={d.prepayments} onChange={(n) => put({ prepayments: n })} />
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement income" intro="Military retirement earns a 4.5% credit; railroad retirement is subtracted from income.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`ut-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`ut-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as UtInput['retirementKind'][string] } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Additions, subtractions and credits (TC-40A)">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Subtraction code 71" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Addition code 57" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="my529 credit" hint="Form TC-675H, credit code 20" value={d.my529Credit} onChange={(n) => put({ my529Credit: n })} />
          <MoneyField label="Credit for income tax paid to another state" hint="From TC-40S, code 17" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <TextField label="Other nonapportionable credit: code" hint="Two characters from the TC-40 instructions" autoComplete="off" value={d.otherCredit.code} onChange={(s) => put({ otherCredit: { ...d.otherCredit, code: s.toUpperCase().slice(0, 2) } })} />
          <MoneyField label="Other nonapportionable credit: amount" value={d.otherCredit.amount} onChange={(n) => put({ otherCredit: { ...d.otherCredit, amount: n } })} />
          <MoneyField label="Utah use tax" hint="Line 31; untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
        </div>
        {credits.length > 0 && (
          <table className="lines"><tbody>
            {credits.map((x) => <tr key={x.code}><th scope="row"><span className="line-no">{x.code}</span>{CREDITS[x.code] ?? 'Credit'}</th><td>{usd(x.amount)}</td></tr>)}
          </tbody></table>
        )}
      </Section>

      {ut.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ut.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form TC-40" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Utah forms" intro="Filled in on this device from the official Utah State Tax Commission Form TC-40.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Utah forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2. Mail refund returns to Income Tax, Utah State Tax Commission, 210 N 1950 W, Salt Lake City UT 84134-0260; returns with a payment to 84134-0266. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
