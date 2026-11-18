/**
 * The Kentucky part of the State step: Form 740 for full-year residents (flat 4%).
 */
import { ReactElement, useMemo, useState } from 'react'
import type { KyInput, Owner, Person } from '../engine/model.ts'
import { computeKentucky } from '../engine/ky2025.ts'
import { buildKyPacket } from '../pdf/ky2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const COLS: [line: string, label: string][] = [
  ['5', 'Federal adjusted gross income'], ['6', 'Additions (Schedule M)'], ['8', 'Subtractions (Schedule M)'], ['9', 'Kentucky adjusted gross income'],
  ['10', 'Standard or itemized deduction'], ['11', 'Taxable income'], ['12', 'Tax (4%)'], ['15', 'Schedule ITC credits'], ['17', 'Personal tax credits'], ['18', 'Tax after credits']
]
const LINES: [line: string, label: string][] = [
  ['19', 'Total tax'], ['21', 'Family Size Tax Credit'], ['23', 'Education tuition credit'], ['24', 'Child and dependent care credit (20% of federal)'],
  ['26', 'Income tax liability'], ['27', 'Use tax'], ['28', 'Total tax liability'], ['31a', 'Kentucky tax withheld'], ['31b', 'Estimated payments'],
  ['32', 'Total payments'], ['36', 'Amount you owe'], ['37', 'Overpaid'], ['40', 'Credited to 2026'], ['41', 'Refund']
]
const M_LINES: [line: string, label: string][] = [['1', 'Other states’ bond interest'], ['5', 'Other additions'], ['8', 'U.S. government interest'], ['9', 'Pension income exclusion'], ['10', 'Social Security'], ['13', 'Active duty military pay'], ['14', 'Other subtractions']]
const ALWAYS = new Set(['19', '26', '28', '32'])
const KEY = new Set(['26', '36', '41'])
const STATUS = { single: 'Single (status 1)', combined: 'Married, separately on a combined return (status 2)', joint: 'Married, joint (status 3)', separate: 'Married, separate returns (status 4)' }
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function KentuckyStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ky
  const ky = useMemo(() => computeKentucky(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<KyInput>): void => set((r) => ({ ...r, ky: { ...r.ky, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildKyPacket(ret, result, ky, preparer)
  const L = ky.lines
  const owes = L['36'] > 0
  const two = ky.status === 'combined'
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadKentuckyForms }) => downloadKentuckyForms(ret, result, ky, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const mRows = M_LINES.filter(([k]) => (ky.schM.A[k] ?? 0) + (ky.schM.B[k] ?? 0) !== 0)
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Kentucky: you owe' : 'Kentucky refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['36'] : L['41'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd((two ? ky.colA['11'] : 0) + ky.colB['11'])}</dd></div>
          <div><dt>Tax liability</dt><dd>{usd(L['26'])}</dd></div>
          <div><dt>Family size credit</dt><dd>{Math.round(ky.familyRate * 100)}%</dd></div>
        </dl>
      </div>

      <Section title="Kentucky return" intro={`Kentucky taxes income at a flat 4% after a $3,270 standard deduction. Social Security is not taxed, and each person can exclude up to $31,110 of pensions and IRA distributions. Filing status: ${STATUS[ky.status]}.`}>
        {married && (
          <label className="check"><input type="checkbox" checked={d.forceJoint} onChange={(e) => put({ forceJoint: e.target.checked })} /> File a joint Kentucky return (status 3) instead of separately on a combined return</label>
        )}
        <div className="grid">
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}: driver’s license or state ID number`} hint="Optional; helps the Department of Revenue verify your identity" autoComplete="off" value={d.license[o]} onChange={(s) => put({ license: { ...d.license, [o]: s } })} />
          ))}
          {owners.map((o) => (
            <label key={`g-${o}`} className="check"><input type="checkbox" checked={d.nationalGuard[o]} onChange={(e) => put({ nationalGuard: { ...d.nationalGuard, [o]: e.target.checked } })} /> {names[o]} is in the Kentucky National Guard ($20 credit)</label>
          ))}
        </div>
      </Section>

      <Section title="Kentucky withholding and payments" intro="From the state section of each W-2 (boxes 15–17). Schedule KW-2 lists them.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Kentucky" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Kentucky tax withheld on 1099s" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="2025 estimated and extension payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Modifications (Schedule M) and credits">
        <div className="grid">
          <MoneyField label="Interest on U.S. government bonds" hint="Schedule M line 8" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Added back (line 1)" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Active duty military pay" hint="Line 13" value={d.militaryPay} onChange={(n) => put({ militaryPay: n })} />
          <MoneyField label="Other additions" hint="Line 5; attach a schedule" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Other subtractions" hint="Line 14; attach a schedule" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <MoneyField label="Schedule ITC business credits" hint="Section A, lines 25E and 25F" value={d.itcCredits} onChange={(n) => put({ itcCredits: n })} />
          <MoneyField label="Education tuition credit" hint="Form 8863-K, line 17" value={d.tuitionCredit} onChange={(n) => put({ tuitionCredit: n })} />
          <MoneyField label="Kentucky use tax" hint="6% of untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['37'] > 0 && <MoneyField label="Credit to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        {mRows.length > 0 && (
          <table className="lines"><tbody>
            {mRows.map(([k, label]) => (
              <tr key={k}><th scope="row"><span className="line-no">M{k}</span>{label}</th><td>{two ? `${usd(ky.schM.A[k] ?? 0)} / ${usd(ky.schM.B[k] ?? 0)}` : usd(ky.schM.B[k] ?? 0)}</td></tr>
            ))}
          </tbody></table>
        )}
        <p className="why">Family size {ky.familySize}, modified gross income {usd(ky.mgi)}: Family Size Tax Credit {Math.round(ky.familyRate * 100)}% of tax. {ky.itemize ? `Itemizing (Kentucky Schedule A): ${usd(ky.itemized)}.` : ''}</p>
      </Section>

      {ky.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ky.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 740" intro={two ? 'Whole dollars. Page 1 shows your spouse (column A) and you (column B).' : 'Whole dollars.'}>
        <table className="lines"><tbody>
          {COLS.filter(([k]) => ['5', '9', '11', '12', '18'].includes(k) || (ky.colA[k] ?? 0) + (ky.colB[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{two ? `${usd(ky.colA[k] ?? 0)} / ${usd(ky.colB[k] ?? 0)}` : usd(ky.colB[k] ?? 0)}</td></tr>
          ))}
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Kentucky forms" intro="Filled in on this device from the official Kentucky Department of Revenue Form 740.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Kentucky forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. Mail refund or no-payment returns to Kentucky Department of Revenue, Frankfort KY 40618-0006; returns with a payment (check to the Kentucky State Treasurer) to Frankfort KY 40619-0008. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
