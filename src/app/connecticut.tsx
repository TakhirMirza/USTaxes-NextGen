/**
 * The Connecticut part of the State step: Form CT-1040 for full-year residents, with Schedules 1, 3 and CT-EITC.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { CtInput, CtPropertyTax, CtRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeConnecticut } from '../engine/ct2025.ts'
import { buildCtPacket } from '../pdf/ct2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Additions (Schedule 1)'], ['4', 'Subtractions (Schedule 1)'], ['5', 'Connecticut adjusted gross income'],
  ['6', 'Income tax (Tax Calculation Schedule)'], ['7', 'Credit for taxes paid to other jurisdictions'], ['11', 'Property tax credit'], ['13', 'Schedule CT-IT credits'],
  ['14', 'Connecticut income tax'], ['15', 'Use tax'], ['16', 'Total tax'], ['18', 'Connecticut tax withheld'], ['19', 'Estimated payments'],
  ['20', 'Extension payment'], ['20a', 'CT earned income tax credit'], ['21', 'Total payments and credits'], ['23', 'Applied to 2026'], ['25', 'Refund'], ['26', 'Tax due']
]
const ALWAYS = new Set(['1', '5', '6', '14', '16', '21'])
const KEY = new Set(['5', '14', '25', '26'])
const SCH1: [line: string, label: string][] = [['31', 'Other states’ bond interest'], ['37', 'Other additions'], ['39', 'U.S. government interest'], ['41', 'Social Security'], ['43', 'Railroad retirement'], ['44', 'Military retirement'], ['45', '50% of teachers’ retirement'], ['48', 'CHET contributions'], ['48b', 'Pensions and IRA distributions'], ['48d', 'ABLE contributions'], ['49', 'Other subtractions']]
const KINDS: [CtRetirementKind, string][] = [['standard', 'Pension, annuity or IRA (pension subtraction)'], ['military', 'Military retirement (all)'], ['railroad', 'Railroad retirement (all)'], ['ctrb', 'Connecticut Teachers’ Retirement (50%)'], ['roth', 'Roth IRA (none)']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function ConnecticutStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ct
  const ct = useMemo(() => computeConnecticut(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<CtInput>): void => set((r) => ({ ...r, ct: { ...r.ct, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildCtPacket(ret, result, ct, preparer)
  const L = ct.lines
  const owes = L['26'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadConnecticutForms }) => downloadConnecticutForms(ret, result, ct, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const property = (key: 'residence' | 'auto1' | 'auto2', title: string, describe: string): ReactElement => {
    const p = d[key]
    const upd = (x: Partial<CtPropertyTax>): void => put({ [key]: { ...p, ...x } } as Partial<CtInput>)
    return (
      <fieldset key={key} className="grid">
        <legend>{title}</legend>
        <MoneyField label="Property tax paid in 2025" value={p.amount} onChange={(n) => upd({ amount: n })} />
        {p.amount > 0 && [
          <TextField key="t" label="Connecticut town or district" autoComplete="off" value={p.town} onChange={(s) => upd({ town: s })} />,
          <TextField key="d" label={describe} autoComplete="off" value={p.description} onChange={(s) => upd({ description: s })} />,
          <TextField key="p" label="Date paid" placeholder="MMDDYYYY" autoComplete="off" value={p.datePaid} onChange={(s) => upd({ datePaid: s.replace(/\D/g, '').slice(0, 8) })} />
        ]}
      </fieldset>
    )
  }
  const sch1 = SCH1.filter(([k]) => (L[k] ?? 0) > 0)
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Connecticut: you owe' : 'Connecticut refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['26'] : L['25'])}</p>
        </div>
        <dl>
          <div><dt>Connecticut AGI</dt><dd>{usd(L['5'])}</dd></div>
          <div><dt>Income tax</dt><dd>{usd(L['14'])}</dd></div>
          <div><dt>CT EITC</dt><dd>{usd(L['20a'])}</dd></div>
        </dl>
      </div>

      <Section title="Connecticut return" intro="Connecticut taxes income at 2% to 6.99%. The personal exemption, the lowest-rate benefit and the personal tax credit phase out as income rises; the Tax Calculation Schedule handles all of it.">
        <div className="grid">
          <TextField label="City or town of residence" hint="Only if different from your mailing address" autoComplete="off" value={d.townOfResidence} onChange={(s) => put({ townOfResidence: s })} />
        </div>
      </Section>

      <Section title="Connecticut withholding and payments" intro="From the state section of each W-2 (boxes 15–17). Page 2 lists each W-2 and 1099 with Connecticut tax withheld.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Connecticut" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <TextField label="1099 with Connecticut withholding: payer’s FEIN" autoComplete="off" value={d.other1099.ein} onChange={(s) => put({ other1099: { ...d.other1099, ein: s } })} />
          <MoneyField label="1099: Connecticut income" value={d.other1099.income} onChange={(n) => put({ other1099: { ...d.other1099, income: n } })} />
          <MoneyField label="1099: Connecticut tax withheld" value={d.other1099.tax} onChange={(n) => put({ other1099: { ...d.other1099, tax: n } })} />
          <MoneyField label="2025 estimated payments and prior overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement income (Schedule 1)" intro="Pensions and annuities are subtracted in full and IRA distributions at 75% when federal AGI is under $75,000 ($100,000 joint), less above. Military and railroad retirement are subtracted in full.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`ct-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`ct-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as CtRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Other modifications (Schedule 1)">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Line 39" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Added back (line 31)" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="CHET contributions" hint="Up to $5,000 ($10,000 joint)" value={d.chetContributions} onChange={(n) => put({ chetContributions: n })} />
          <MoneyField label="ABLE contributions" value={d.ableContributions} onChange={(n) => put({ ableContributions: n })} />
          <TextField label="Other addition: description" autoComplete="off" value={d.otherAddition.description} onChange={(s) => put({ otherAddition: { ...d.otherAddition, description: s } })} />
          <MoneyField label="Other addition: amount" value={d.otherAddition.amount} onChange={(n) => put({ otherAddition: { ...d.otherAddition, amount: n } })} />
          <TextField label="Other subtraction: description" autoComplete="off" value={d.otherSubtraction.description} onChange={(s) => put({ otherSubtraction: { ...d.otherSubtraction, description: s } })} />
          <MoneyField label="Other subtraction: amount" value={d.otherSubtraction.amount} onChange={(n) => put({ otherSubtraction: { ...d.otherSubtraction, amount: n } })} />
        </div>
        {sch1.length > 0 && <p className="why">Schedule 1: {sch1.map(([k, label]) => `${label} ${usd(L[k])}`).join(', ')}.</p>}
      </Section>

      <Section title="Property tax credit (Schedule 3)" intro="Property tax paid in 2025 to a Connecticut town on your home or car gives a credit of up to $300, reduced at higher incomes.">
        {property('residence', 'Primary residence', 'Street address')}
        {property('auto1', 'Motor vehicle 1', 'Year, make and model')}
        {joint && property('auto2', 'Motor vehicle 2', 'Year, make and model')}
      </Section>

      <Section title="Credit for income taxes paid to other jurisdictions (Schedule 2)" intro="For income from another state, the District of Columbia or a political subdivision that taxed it. Enter the non-Connecticut income from the Schedule 2 Worksheet and the income tax paid there (from that return, not the amount withheld). Two jurisdictions fit on the form.">
        {[0, 1].filter((i) => i < d.otherStates.length + 1).map((i) => {
          const o = d.otherStates[i] ?? { name: '', code: '', income: 0, tax: 0 }
          const set1 = (p: Partial<typeof o>): void => {
            const list = [...d.otherStates]
            list[i] = { ...o, ...p }
            put({ otherStates: list })
          }
          return (
            <div key={i} className="grid">
              <TextField label={`Jurisdiction ${i === 0 ? 'A' : 'B'}: name`} autoComplete="off" value={o.name} onChange={(s) => set1({ name: s })} />
              <TextField label="Two-letter code" autoComplete="off" value={o.code} onChange={(s) => set1({ code: s.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() })} />
              <MoneyField label="Non-Connecticut income taxed there" hint="Line 53" value={o.income} onChange={(n) => set1({ income: n })} />
              <MoneyField label="Income tax paid there" hint="Line 57" value={o.tax} onChange={(n) => set1({ tax: n })} />
            </div>
          )
        })}
        {ct.sch2 && (
          <div className="grid">
            <MoneyField label="Modified Connecticut AGI" hint={`Line 51; leave as is unless the instructions call for a different amount (Connecticut AGI is ${usd(L['5'])})`} value={d.modifiedAgi ?? L['5']} onChange={(n) => put({ modifiedAgi: n === L['5'] ? null : n })} />
          </div>
        )}
        {ct.sch2 && <p className="why">Credit (line 7): {usd(L['7'])}.</p>}
      </Section>

      <Section title="Other credits and amounts">
        <div className="grid">
          <MoneyField label="Schedule CT-IT credits" hint="Part 1, line 10" value={d.itCredits} onChange={(n) => put({ itCredits: n })} />
          <MoneyField label="Individual use tax" hint="Schedule 4: untaxed online purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['22'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {ct.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ct.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form CT-1040" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
        <p className="why">Tax Calculation Schedule: exemption {usd(ct.tcs['2'])}, initial tax {usd(ct.tcs['4'])}, phase-out {usd(ct.tcs['5'])}, recapture {usd(ct.tcs['6'])}, personal tax credit {Math.round(ct.tcs['8'] * 100)}%.</p>
      </Section>

      <Section title="Connecticut forms" intro="Printed on this device onto the official Department of Revenue Services forms.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Connecticut forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2 and send all four pages (no staples). With a payment: Department of Revenue Services, PO Box 2977, Hartford CT 06104-2977. Refunds and all others: PO Box 2976, Hartford CT 06104-2976. myconneCT files for free. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
