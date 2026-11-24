/**
 * The New Mexico part of the State step: Form PIT-1 with PIT-ADJ and PIT-RC for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { NmInput, NmRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeNewMexico } from '../engine/nm2025.ts'
import { buildNmPacket } from '../pdf/nm2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['9', 'Federal adjusted gross income'], ['10', 'State and local income tax add-back'], ['11', 'Additions (PIT-ADJ)'], ['12', 'Federal standard or itemized deduction'],
  ['13', 'Deduction for certain dependents'], ['14', 'Low- and middle-income exemption'], ['15', 'Deductions and exemptions (PIT-ADJ)'], ['17', 'New Mexico taxable income'],
  ['18', 'Tax'], ['20', 'Credit for taxes paid to another state'], ['21', 'Business-related credits'], ['22', 'Net New Mexico income tax'],
  ['24', 'Rebates and credits (PIT-RC)'], ['25', 'Working families tax credit (25% of federal EIC)'], ['26', 'Refundable business credits'],
  ['27', 'New Mexico tax withheld'], ['30', 'Estimated payments'], ['32', 'Total payments and credits'], ['33', 'Tax due'], ['40', 'Refund contributions'], ['41', 'Applied to 2026'], ['42', 'Refund']
]
const ALWAYS = new Set(['9', '12', '17', '18', '22', '32'])
const KEY = new Set(['22', '33', '42'])
const KINDS: [NmRetirementKind, string][] = [['standard', 'Pension, IRA or annuity (taxed)'], ['military', 'Armed forces retirement (up to $30,000 exempt)'], ['railroad', 'Railroad retirement (exempt)']]
const PITD: [string, string][] = [
  ['2', 'New Mexico Housing Trust Fund'], ['3', 'Share With Wildlife'], ['4', 'Veterans’ State Cemetery Fund'], ['5', 'Substance Abuse Education Fund'],
  ['6', 'Forest Re-Leaf Program'], ['7', 'National Guard Member and Family Assistance'], ['8', 'Kids ’N Parks Transportation Grant Program'],
  ['9', 'ALS Research Fund'], ['10', 'Vietnam Veterans Memorial'], ['12', 'Veterans Enterprise Fund'], ['13', 'Lottery Tuition Fund'],
  ['14', 'Equine Shelter Rescue Fund'], ['15', 'Animal Care and Facility Fund'], ['16', 'Supplemental Senior Services'], ['17', 'Healthy Soil Program']
]
const PARTIES: [string, string][] = [
  ['', 'No contribution'], ['1', 'New Mexico Democratic Party'], ['2', 'New Mexico Republican Party'], ['3', 'Libertarian Party of New Mexico'],
  ['4', 'Green Party of New Mexico'], ['5', 'Better for America Party of New Mexico'], ['6', 'Constitution Party of New Mexico']
]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function NewMexicoStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.nm
  const nm = useMemo(() => computeNewMexico(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<NmInput>): void => set((r) => ({ ...r, nm: { ...r.nm, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildNmPacket(ret, result, nm, preparer)
  const L = nm.lines
  const owes = L['33'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const any65 = owners.some((o) => { const p = o === 'taxpayer' ? ret.taxpayer : ret.spouse; return p.age >= 65 || p.age65OrOlder })
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadNewMexicoForms }) => downloadNewMexicoForms(ret, result, nm, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'New Mexico: you owe' : 'New Mexico refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['33'] : L['42'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['17'])}</dd></div>
          <div><dt>Net tax</dt><dd>{usd(L['22'])}</dd></div>
          <div><dt>Rebates and credits</dt><dd>{usd(L['24'] + L['25'])}</dd></div>
        </dl>
      </div>

      <Section title="New Mexico return" intro="New Mexico starts from federal AGI, takes the federal deduction and its own exemptions (Social Security, armed forces retirement, 65 or older), and taxes the rest at 1.5% to 5.9%. Rebates and credits on PIT-RC and the working families tax credit are refundable.">
        <div className="grid">
          {owners.map((o) => (
            <TextField key={`b-${o}`} label={`${names[o]}: date of birth`} placeholder="MM/DD/CCYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: s } })} />
          ))}
          {ret.dependents.slice(0, 20).map((x) => (
            <TextField key={x.id} label={`${x.name.trim() || 'Dependent'}: date of birth`} placeholder="MM/DD/CCYY" autoComplete="off" value={d.dependentBirthDate[x.id] ?? ''} onChange={(s) => put({ dependentBirthDate: { ...d.dependentBirthDate, [x.id]: s } })} />
          ))}
          {owners.map((o) => (
            <TextField key={`l-${o}`} label={`${names[o]}: driver’s license or state ID number`} hint="Or NONE / DECLINED" autoComplete="off" value={d.license[o]} onChange={(s) => put({ license: { ...d.license, [o]: s } })} />
          ))}
        </div>
      </Section>

      <Section title="New Mexico withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="New Mexico" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="New Mexico tax withheld on 1099s" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="2025 estimated payments" hint="Line 30" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          {L['39'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement income (PIT-ADJ)">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`nm-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`nm-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as NmRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Deductions, rebates and credits">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="PIT-ADJ line 9" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="PIT-ADJ line 1 (added)" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="New Mexico 529 contributions" hint="PIT-ADJ line 15" value={d.nm529} onChange={(n) => put({ nm529: n })} />
          <MoneyField label="U.S. armed forces active duty pay" hint="PIT-ADJ line 17" value={d.activeDutyPay} onChange={(n) => put({ activeDutyPay: n })} />
          <MoneyField label="State income tax refund in federal AGI" hint="PIT-ADJ line 21" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
        </div>
        {any65 && <label className="check"><input type="checkbox" checked={d.bigMedical} onChange={(e) => put({ bigMedical: e.target.checked })} /> Unreimbursed medical care expenses of $28,000 or more in 2025 ($3,000 exemption and $2,800 credit)</label>}
        {nm.rc['25'] > 0 && <p className="why">Child Income Tax Credit: {nm.qualifyingChildren} qualifying {nm.qualifyingChildren === 1 ? 'child' : 'children'}, {usd(nm.rc['25'])}.</p>}
      </Section>

      <Section title="Property tax rebates (PIT-RC sections 3–4)" intro={`Modified gross income ${usd(nm.rc['13'])}. The rebate for persons 65 or older needs $16,000 or less; the additional rebate for Los Alamos, Santa Fe, Doña Ana and Bernalillo counties needs $24,000 or less.`}>
        <div className="grid">
          <MoneyField label="Property tax billed on your home for 2025" hint="Principal residence only" value={d.propertyTax} onChange={(n) => put({ propertyTax: n })} />
          {any65 && <MoneyField label="Rent paid for your home in 2025" hint="Line 16a (6% counts as property tax)" value={d.rentPaid} onChange={(n) => put({ rentPaid: n })} />}
          <div className="field">
            <label htmlFor="nm-county"><span>County (section 4)</span></label>
            <select id="nm-county" className="select" value={d.county} onChange={(e) => put({ county: e.target.value as NmInput['county'] })}>
              <option value="">Another county</option>
              <option value="LA">Los Alamos County</option>
              <option value="SF">Santa Fe County</option>
              <option value="DA">Doña Ana County</option>
              <option value="BL">Bernalillo County</option>
            </select>
          </div>
        </div>
        {any65 && d.rentPaid > 0 && <label className="check"><input type="checkbox" checked={d.rentGovernmentPaid} onChange={(e) => put({ rentGovernmentPaid: e.target.checked })} /> A government entity paid part of the rent (line 16b)</label>}
        {(nm.rc['17c'] > 0 || nm.rc['18c'] > 0) && <p className="why">Property tax rebates: {usd(nm.rc['17c'] + nm.rc['18c'])}.</p>}
      </Section>

      {ret.dependents.some((x) => x.age < 15) && (
        <Section title="Child day care credit (PIT-RC section 5)" intro="For care in New Mexico of children under 15 while you (and your spouse) worked, with modified gross income of $30,160 or less: 40% of the days of care times up to $8 a day, at most $480 a child and $1,200 in all, less the federal credit. Get a Form PIT-CG from each caregiver.">
          <div className="grid">
            {ret.dependents.filter((x) => x.age < 15).map((x) => {
              const v = d.dayCare[x.id] ?? { days: 0, rate: 0 }
              return [
                <NumberField key={`d-${x.id}`} label={`${x.name.trim() || 'Child'}: days of care`} max={366} value={v.days} onChange={(n) => put({ dayCare: { ...d.dayCare, [x.id]: { ...v, days: n } } })} />,
                <MoneyField key={`r-${x.id}`} label={`${x.name.trim() || 'Child'}: amount paid per day`} hint="Up to $8 counts" value={v.rate} onChange={(n) => put({ dayCare: { ...d.dayCare, [x.id]: { ...v, rate: n } } })} />
              ]
            })}
          </div>
          {nm.rc['19'] > 0 && <p className="why">Line 19 {usd(nm.rc['19'])} less the federal credit {usd(nm.rc['21'])}: {usd(nm.rc['22'])}.</p>}
        </Section>
      )}

      {L['39'] > 0 && (
        <Section title="Contributions from your refund (PIT-D)" intro={`Up to your overpayment of ${usd(L['39'])}. If they add up to more, none are made.`}>
          <div className="grid">
            {PITD.map(([k, label]) => <MoneyField key={k} label={label} hint={`PIT-D line ${k}`} value={d.contributions[k] ?? 0} onChange={(n) => put({ contributions: { ...d.contributions, [k]: n } })} />)}
            {owners.map((o) => (
              <div key={o} className="field">
                <label htmlFor={`nm-party-${o}`}><span>{names[o]}: $2 to a political party</span></label>
                <select id={`nm-party-${o}`} className="select" value={d.party[o]} onChange={(e) => put({ party: { ...d.party, [o]: e.target.value } })}>
                  {PARTIES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Other credits">
        <div className="grid">
          <NumberField label="Special needs adopted children" hint="PIT-RC line 24, $1,500 each (certified by CYFD)" max={10} value={d.specialNeedsAdoptions} onChange={(n) => put({ specialNeedsAdoptions: n })} />
        </div>
        <p className="why">Credit for tax paid to another state (line 20 worksheet).</p>
        <div className="grid">
          <TextField label="Other state" autoComplete="off" value={d.otherState.name} onChange={(v) => put({ otherState: { ...d.otherState, name: v } })} />
          <MoneyField label="Tax due on the other state’s return" value={d.otherState.tax} onChange={(n) => put({ otherState: { ...d.otherState, tax: n } })} />
          <MoneyField label="Other state’s taxable income" value={d.otherState.taxableIncome} onChange={(n) => put({ otherState: { ...d.otherState, taxableIncome: n } })} />
          <MoneyField label="Income taxed by both states" value={d.otherState.doubleTaxed} onChange={(n) => put({ otherState: { ...d.otherState, doubleTaxed: n } })} />
        </div>
        <p className="why">Business-related credits (PIT-CR): enter the credit type code from PIT-CR, its approval number, and the amounts. Credits 6 and up go on PIT-CR Supplemental sheets (25 per sheet).</p>
        {d.crCredits.map((c, i) => {
          const upd = (p: Partial<NmInput['crCredits'][number]>): void => put({ crCredits: d.crCredits.map((x, j) => (j === i ? { ...x, ...p } : x)) })
          return (
            <div className="grid" key={i}>
              <TextField label={`Credit ${i + 1}: type code`} hint="For example A01, F01" autoComplete="off" value={c.code} onChange={(v) => upd({ code: v.toUpperCase().slice(0, 3) })} />
              <TextField label="Approval number" autoComplete="off" value={c.approval} onChange={(v) => upd({ approval: v })} />
              <MoneyField label="Applied to tax due" value={c.applied} onChange={(n) => upd({ applied: n })} />
              <MoneyField label="Refunded" hint="Refundable codes only" value={c.refund} onChange={(n) => upd({ refund: n })} />
            </div>
          )
        })}
        <div className="actions">
          {d.crCredits.length < 80 && <button type="button" className="button is-quiet" onClick={() => put({ crCredits: [...d.crCredits, { code: '', approval: '', applied: 0, refund: 0 }] })}>Add a PIT-CR credit</button>}
          {d.crCredits.length > 0 && <button type="button" className="button is-quiet" onClick={() => put({ crCredits: d.crCredits.slice(0, -1) })}>Remove the last credit</button>}
        </div>
      </Section>

      {nm.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{nm.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form PIT-1" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="New Mexico forms" intro="Drawn on this device onto the official 2025 PIT-1, PIT-ADJ and PIT-RC from the Taxation and Revenue Department.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download New Mexico forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2. Mail to New Mexico Taxation and Revenue Department, PO Box 25122, Santa Fe NM 87504-5122. Do not staple. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
