/**
 * The Minnesota part of the State step: Form M1 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MnInput, Owner, Person } from '../engine/model.ts'
import { computeMinnesota } from '../engine/mn2025.ts'
import { buildMnPacket } from '../pdf/mn2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import { WithholdingItems } from './creditrows'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Additions (Schedule M1M)'], ['3', 'Subtotal'], ['4', 'Deduction'], ['5', 'Dependent exemptions'],
  ['6', 'State income tax refund'], ['7', 'Subtractions (Schedule M1M)'], ['9', 'Minnesota taxable income'], ['10', 'Tax'],
  ['16', 'Nonrefundable credits (Schedule M1C)'], ['18', 'Nongame Wildlife Fund'], ['19', 'Total tax'], ['20', 'Minnesota tax withheld'],
  ['21', 'Estimated and extension payments'], ['22', 'Refundable credits (Schedule M1REF)'], ['23', 'Total payments'],
  ['30', 'Applied to 2026'], ['24', 'Refund'], ['26', 'Amount you owe']
]
const M1M: [line: string, label: string][] = [
  ['1', 'Other states’ bond interest'], ['3', 'Other additions'], ['11', 'Charitable gifts over $500 (half)'], ['12', 'Social Security subtraction'],
  ['13', 'K–12 education expenses'], ['14', 'Interest on U.S. bonds'], ['15', '529 plan contributions'], ['20', 'Active-duty military pay'],
  ['25', 'Military pension'], ['38', 'Other subtractions'], ['40', 'Total subtractions']
]
const ALWAYS = new Set(['1', '3', '4', '9', '10', '19', '23'])
const KEY = new Set(['9', '19', '24', '26'])
const CODES: [string, string][] = [['', 'No'], ['11', 'Republican'], ['12', 'Democratic/Farmer-Labor'], ['14', 'Grassroots/Legalize Cannabis'], ['16', 'Libertarian'], ['17', 'Legal Marijuana Now'], ['18', 'Independence-Alliance'], ['99', 'General Campaign Fund']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function MinnesotaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.mn
  const mn = useMemo(() => computeMinnesota(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MnInput>): void => set((r) => ({ ...r, mn: { ...r.mn, ...p } }))
  const joint = mn.status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildMnPacket(ret, result, mn, preparer)
  const L = mn.lines
  const M = mn.m
  const owes = L['26'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadMinnesotaForms }) => downloadMinnesotaForms(ret, result, mn, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Minnesota: you owe' : 'Minnesota refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['26'] : L['24'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['9'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['19'])}</dd></div>
          <div><dt>Refundable credits</dt><dd>{usd(L['22'])}</dd></div>
        </dl>
      </div>

      <Section title="Minnesota return" intro={`Minnesota taxes income at 5.35% to 9.85% after a ${usd(mn.deduction.standard)} standard deduction (or itemized deductions) and $5,200 for each dependent.`}>
        <div className="grid">
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
          <TextField label="County" autoComplete="off" value={d.county} onChange={(s) => put({ county: s })} />
          {owners.map((o) => (
            <div className="field" key={`c${o}`}>
              <label htmlFor={`mn-code-${o}`}><span>{names[o]}: $5 to the State Elections Campaign Fund</span></label>
              <select id={`mn-code-${o}`} className="select" value={d.campaignCode[o]} onChange={(e) => put({ campaignCode: { ...d.campaignCode, [o]: e.target.value } })}>
                {CODES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <p className="why">{mn.dependents.count} dependent{mn.dependents.count === 1 ? '' : 's'} for the exemption{mn.dependents.children + mn.dependents.older > 0 ? `; ${mn.dependents.children} qualifying child${mn.dependents.children === 1 ? '' : 'ren'} for the Child Tax Credit and ${mn.dependents.older} qualifying older child${mn.dependents.older === 1 ? '' : 'ren'}` : ''}.</p>
      </Section>

      <Section title="Minnesota withholding and payments" intro="From the state section of each W-2 (boxes 15–17); they go on Schedule M1W.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Minnesota" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Minnesota tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <WithholdingItems ret={ret} set={set} k="mn.withholding1099" setTotal={(r, n) => ({ ...r, mn: { ...r.mn, withholding1099: n } })} kinds={["1099", "W-2G", "1042-S"]} stateIdLabel="Payer’s Minnesota tax ID" incomeLabel="State income" />
          <MoneyField label="2025 estimated and extension payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Additions and subtractions" intro="Taxable Social Security is subtracted in full below $84,490 of income ($108,320 joint), and partly above.">
        <div className="grid">
          <MoneyField label="State income tax refund in federal income" hint="Schedule 1 line 1" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. bonds" hint="Savings bonds, Treasury bills and notes" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Military pension or retirement pay" value={d.militaryPension} onChange={(n) => put({ militaryPension: n })} />
          <MoneyField label="Active-duty military pay" value={d.activeMilitaryPay} onChange={(n) => put({ activeMilitaryPay: n })} />
          <MoneyField label="K–12 education expenses" hint="Up to $1,625 per child in K–6, $2,500 in 7–12" value={d.k12Expenses} onChange={(n) => put({ k12Expenses: n })} />
          <MoneyField label="529 plan subtraction" hint="From Schedule M1529 line 4" value={d.contributions529} onChange={(n) => put({ contributions529: n })} />
          <MoneyField label="Other subtractions" hint="For example Schedule M1R (65 or older/disabled) or M1QPEN" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Taxed in Minnesota" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other additions" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
        </div>
        <table className="lines"><tbody>
          {M1M.filter(([k]) => k === '40' || (M[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={k === '40' ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(M[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Deduction">
        <div className="grid">
          <MoneyField label="Minnesota itemized deductions (Schedule M1SA)" hint="Leave at 0 to estimate from your federal Schedule A" value={d.itemized ?? 0} onChange={(n) => put({ itemized: n > 0 ? n : null })} />
        </div>
        {ret.filingStatus === 'mfs' && <div className="checks"><Check label="My spouse itemizes on their Minnesota return" hint="Then you must itemize too" checked={d.spouseItemizes} onChange={(on) => put({ spouseItemizes: on })} /></div>}
        <p className="why">{mn.deduction.method === 'itemized'
          ? `Itemizing: ${usd(L['4'])} (standard would be ${usd(mn.deduction.standard)}).`
          : `Standard deduction: ${usd(L['4'])}${mn.deduction.itemized > 0 ? ` (itemized would be ${usd(mn.deduction.itemized)})` : ''}.`}</p>
      </Section>

      <Section title="Credits and refund">
        <div className="grid">
          <MoneyField label="Nonrefundable credits (Schedule M1C)" hint="Marriage credit, long-term care insurance, credit for tax paid to another state…" value={d.nonrefundableCredits} onChange={(n) => put({ nonrefundableCredits: n })} />
          <MoneyField label="Other refundable credits (Schedule M1REF)" hint="Child and dependent care, K–12 education, renter’s credit…" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
          <MoneyField label="Nongame Wildlife Fund gift" value={d.nongame} onChange={(n) => put({ nongame: n })} />
          {L['24'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <p className="why">{mn.ref['2'] > 0 ? `Child and Working Family Credits (Schedule M1CWFC): ${usd(mn.ref['2'])}.` : 'No Child and Working Family Credits at this income.'}</p>
      </Section>

      {mn.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{mn.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form M1" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Minnesota forms" intro="Filled in on this device from the official Minnesota Department of Revenue PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Minnesota forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2 and mail to Minnesota Individual Income Tax, Mail Station 0010, 600 N. Robert St., St. Paul, MN 55146-0010. Minnesota’s e-File Minnesota is free for many filers. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
