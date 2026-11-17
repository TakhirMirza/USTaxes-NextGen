/**
 * The Oregon part of the State step: Form OR-40 for full-year residents, with Schedules OR-ASC, OR-A and OR-WFHDC.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { OrInput, Owner, Person } from '../engine/model.ts'
import { computeOregon } from '../engine/or2025.ts'
import { buildOrPacket } from '../pdf/or2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['7', 'Federal adjusted gross income'], ['8', 'Additions (OR-ASC)'], ['10', 'Federal tax liability subtraction'], ['11', 'Social Security'],
  ['13', 'Other subtractions (OR-ASC)'], ['15', 'Income after subtractions'], ['16', 'Oregon itemized deductions'], ['17', 'Standard deduction'],
  ['19', 'Oregon taxable income'], ['20', 'Tax'], ['25', 'Exemption credit'], ['26', 'Political contribution credit'], ['27', 'Other standard credits'],
  ['31', 'Tax after credits'], ['32', 'Kicker'], ['33', 'Oregon tax withheld'], ['34', 'Prior-year refund applied'], ['35', 'Estimated payments'],
  ['37', 'Earned income credit'], ['38', 'Oregon Kids Credit'], ['39', 'Refundable credits (OR-ASC)'], ['40', 'Total payments and refundable credits'],
  ['46', 'Amount you owe'], ['47', 'Refund'], ['48', 'Applied to 2026'], ['53', 'Net refund']
]
const ALWAYS = new Set(['7', '15', '19', '20', '31', '40'])
const KEY = new Set(['19', '31', '46', '53'])
const CODES: [string, string][] = [['SD', 'Child'], ['SC', 'Stepchild'], ['FC', 'Foster child'], ['SB', 'Sibling'], ['PT', 'Parent'], ['GP', 'Grandparent'], ['GC', 'Grandchild'], ['AU', 'Aunt or uncle'], ['NN', 'Niece or nephew'], ['OR', 'Other relative'], ['NR', 'No relation']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function OregonStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.or
  const or = useMemo(() => computeOregon(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<OrInput>): void => set((r) => ({ ...r, or: { ...r.or, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildOrPacket(ret, result, or, preparer)
  const L = or.lines
  const owes = L['46'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadOregonForms }) => downloadOregonForms(ret, result, or, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Oregon: you owe' : 'Oregon refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['46'] : L['53'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['19'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['31'])}</dd></div>
          <div><dt>Kicker</dt><dd>{usd(L['32'])}</dd></div>
        </dl>
      </div>

      <Section title="Oregon return" intro="Oregon taxes income at 4.75% to 9.9%. It lets you subtract up to $8,500 of federal income tax and all taxable Social Security, and gives a $256 credit per exemption.">
        <div className="grid">
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
          {owners.map((o) => (
            <label key={`sd-${o}`} className="check"><input type="checkbox" checked={d.severeDisability[o]} onChange={(e) => put({ severeDisability: { ...d.severeDisability, [o]: e.target.checked } })} /> {names[o]} has a severe disability (physician’s letter)</label>
          ))}
        </div>
        {ret.dependents.length > 0 && (
          <div className="grid">
            {ret.dependents.map((x) => [
              <TextField key={`${x.id}-dob`} label={`${x.name.trim() || 'Dependent'}: date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.dependentBirthDates[x.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [x.id]: date(s) } })} />,
              <div key={`${x.id}-code`} className="field">
                <label htmlFor={`or-code-${x.id}`}><span>{x.name.trim() || 'Dependent'}: relationship code</span></label>
                <select id={`or-code-${x.id}`} className="select" value={d.dependentCodes[x.id] || (x.childRelationship ? 'SD' : '')} onChange={(e) => put({ dependentCodes: { ...d.dependentCodes, [x.id]: e.target.value } })}>
                  <option value="">Choose</option>
                  {CODES.map(([c, label]) => <option key={c} value={c}>{c}: {label}</option>)}
                </select>
              </div>,
              <label key={`${x.id}-dis`} className="check"><input type="checkbox" checked={!!d.childDisability[x.id]} onChange={(e) => put({ childDisability: { ...d.childDisability, [x.id]: e.target.checked } })} /> Child with a qualifying disability (IEP or IFSP)</label>
            ])}
          </div>
        )}
      </Section>

      <Section title="Oregon withholding and payments" intro="From the state section of each W-2 (boxes 15–17). Don’t include statewide transit tax.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Oregon" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Oregon tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2024 refund applied to 2025" value={d.priorYearRefundApplied} onChange={(n) => put({ priorYearRefundApplied: n })} />
          <MoneyField label="2025 estimated and extension payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Kicker" intro="For 2025 the kicker is 9.863% of your 2024 Oregon tax. You need to have filed a 2024 Oregon return.">
        <div className="grid">
          <MoneyField label="2024 Oregon tax" hint="2024 Form OR-40, line 24 (less any code 802 or 815 credit)" value={d.kickerLiability2024} onChange={(n) => put({ kickerLiability2024: n })} />
          <label className="check"><input type="checkbox" checked={d.donateKicker} onChange={(e) => put({ donateKicker: e.target.checked })} /> Donate my kicker to the State School Fund (irrevocable)</label>
        </div>
      </Section>

      <Section title="Subtractions and additions (Schedule OR-ASC)" intro="Tips, overtime and car loan interest you deduct on your federal return are subtracted for Oregon automatically.">
        <div className="grid">
          <MoneyField label="Interest on U.S. bonds and notes" hint="Code 315" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Federal pension subtraction" hint="Code 307: service before October 1, 1991 (Publication OR-17 worksheet)" value={d.federalPension} onChange={(n) => put({ federalPension: n })} />
          <MoneyField label="Interest on other states’ bonds" hint="Added back (code 158)" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <TextField label="Other subtraction: code" hint="300–399, Publication OR-CODES" autoComplete="off" value={d.otherSubtraction.code} onChange={(s) => put({ otherSubtraction: { ...d.otherSubtraction, code: s.replace(/\D/g, '').slice(0, 3) } })} />
          <MoneyField label="Other subtraction: amount" value={d.otherSubtraction.amount} onChange={(n) => put({ otherSubtraction: { ...d.otherSubtraction, amount: n } })} />
          <TextField label="Other addition: code" hint="100–199" autoComplete="off" value={d.otherAddition.code} onChange={(s) => put({ otherAddition: { ...d.otherAddition, code: s.replace(/\D/g, '').slice(0, 3) } })} />
          <MoneyField label="Other addition: amount" value={d.otherAddition.amount} onChange={(n) => put({ otherAddition: { ...d.otherAddition, amount: n } })} />
        </div>
        {or.asc.subtractions.length > 0 && <p className="why">Subtractions: {or.asc.subtractions.map((x) => `${x.code} ${usd(x.amount)}`).join(', ')}.</p>}
      </Section>

      <Section title="Credits" intro="The exemption credit, earned income credit (9%, or 12% with a child under 3), Oregon Kids Credit and retirement income credit are figured for you.">
        <div className="grid">
          <MoneyField label="Political contributions" hint="Credit up to $50 ($100 joint) if AGI is $75,000 ($150,000) or less" value={d.politicalContributions} onChange={(n) => put({ politicalContributions: n })} />
          <MoneyField label="Oregon College Savings Plan contributions" hint="Refundable credit up to $180 ($360 joint)" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <MoneyField label="ABLE account contributions" value={d.ableContributions} onChange={(n) => put({ ableContributions: n })} />
          {ret.dependentCare.expenses > 0 && (
            <TextField label="WFHDC credit percentage" hint="From the WFHDC calculator on the Oregon Department of Revenue site, e.g. 40" autoComplete="off" value={d.wfhdcPercent ? String(Math.round(d.wfhdcPercent * 100)) : ''} onChange={(s) => put({ wfhdcPercent: Math.min(100, Math.max(0, Number(s.replace(/[^0-9.]/g, '')) || 0)) / 100 })} />
          )}
          <TextField label="Tax paid to another state: state" autoComplete="off" value={d.otherStateCredit.state} onChange={(s) => put({ otherStateCredit: { ...d.otherStateCredit, state: s.toUpperCase().slice(0, 2) } })} />
          <MoneyField label="Credit for tax paid to that state" hint="Code 802" value={d.otherStateCredit.amount} onChange={(n) => put({ otherStateCredit: { ...d.otherStateCredit, amount: n } })} />
          {or.retirementCredit && <MoneyField label="Household income (retirement income credit)" hint="Leave blank to use federal AGI without Social Security, plus tax-exempt interest" value={d.householdIncome ?? 0} onChange={(n) => put({ householdIncome: n || null })} />}
          {L['47'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <p className="why">
          {L['37'] > 0 ? `Earned income credit: ${usd(L['37'])}. ` : ''}
          {L['38'] > 0 ? `Oregon Kids Credit: ${usd(L['38'])}. ` : ''}
          {or.retirementCredit?.['credit'] ? `Retirement income credit: ${usd(or.retirementCredit['credit'])}. ` : ''}
          {or.itemize ? `Itemizing (Schedule OR-A): ${usd(L['16'])}.` : `Standard deduction: ${usd(L['17'])}.`}
        </p>
      </Section>

      {or.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{or.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form OR-40" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Oregon forms" intro="Filled in on this device from the official Oregon Department of Revenue forms.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Oregon forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 7 and include a copy of your federal Form 1040. Mail tax-due returns to Oregon Department of Revenue, PO Box 14555, Salem OR 97309-0940; refund and no-tax-due returns to PO Box 14700, Salem OR 97309-0930. Direct File Oregon and Revenue Online file for free. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
