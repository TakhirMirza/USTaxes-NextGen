/**
 * The Alabama part of the State step: Form 40 for full-year residents, with Schedules A, B, DS, HOF, W-2 and RS.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { AlInput, AlRetirementInfo, Owner, Person } from '../engine/model.ts'
import { computeAlabama } from '../engine/al2025.ts'
import { buildAlPacket } from '../pdf/al2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['5b', 'Alabama wages'], ['6', 'Interest and dividends'], ['7', 'Other income (page 2, Part I)'], ['8', 'Total income'], ['9', 'Adjustments'],
  ['10', 'Adjusted gross income'], ['11', 'Itemized or standard deduction'], ['12', 'Federal income tax deduction'], ['13', 'Personal exemption'],
  ['14', 'Dependent exemption'], ['16', 'Taxable income'], ['17', 'Income tax'], ['18', 'Net tax after credits'], ['19', 'Use tax'], ['21', 'Total tax liability'],
  ['22', 'Alabama tax withheld'], ['23', 'Estimated and extension payments'], ['25', 'Refundable credits'], ['27', 'Total payments'],
  ['30', 'Amount you owe'], ['32', 'Overpaid'], ['33', 'Applied to 2026'], ['35', 'Refund']
]
const ALWAYS = new Set(['8', '10', '11', '16', '17', '21', '27'])
const KEY = new Set(['10', '16', '30', '35'])
const STATUS = { single: 'Single', mfj: 'Married filing joint', mfs: 'Married filing separate', hof: 'Head of family' }
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)
const emptyInfo = (): AlRetirementInfo => ({ exempt: false, reason: '', fein: '', stateId: '', stateTax: 0 })

export function AlabamaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.al
  const al = useMemo(() => computeAlabama(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<AlInput>): void => set((r) => ({ ...r, al: { ...r.al, ...p } }))
  const joint = al.status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildAlPacket(ret, result, al, preparer)
  const L = al.lines
  const owes = L['30'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const putR = (id: string, p: Partial<AlRetirementInfo>): void => put({ retirement: { ...d.retirement, [id]: { ...emptyInfo(), ...(d.retirement[id] ?? {}), ...p } } })
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadAlabamaForms }) => downloadAlabamaForms(ret, result, al, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Alabama: you owe' : 'Alabama refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['30'] : L['35'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['16'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['17'])}</dd></div>
          <div><dt>Filing status</dt><dd>{STATUS[al.status]}</dd></div>
        </dl>
      </div>

      <Section title="Alabama return" intro="Alabama taxes income at 2%, 4% and 5% and lets you deduct the federal income tax you owe. Social Security, unemployment and defined benefit pensions are not taxed. The return uses the larger of Alabama itemized deductions (which include your Social Security and Medicare tax) and the standard deduction.">
        <div className="grid">
          {owners.map((o) => [
            <TextField key={`${o}-dob`} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />,
            <TextField key={`${o}-dl`} label={`${names[o]}: driver’s license number`} hint="Optional; helps ADOR verify your identity" autoComplete="off" value={d.license[o].number} onChange={(s) => put({ license: { ...d.license, [o]: { ...d.license[o], number: s } } })} />,
            ...(d.license[o].number.trim() ? [
              <TextField key={`${o}-st`} label={`${names[o]}: license state`} autoComplete="off" value={d.license[o].state} onChange={(s) => put({ license: { ...d.license, [o]: { ...d.license[o], state: s.toUpperCase().slice(0, 2) } } })} />,
              <TextField key={`${o}-is`} label={`${names[o]}: license issued`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.license[o].issued} onChange={(s) => put({ license: { ...d.license, [o]: { ...d.license[o], issued: date(s) } } })} />,
              <TextField key={`${o}-ex`} label={`${names[o]}: license expires`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.license[o].expires} onChange={(s) => put({ license: { ...d.license, [o]: { ...d.license[o], expires: date(s) } } })} />
            ] : [])
          ])}
        </div>
      </Section>

      <Section title="Alabama withholding and payments" intro="From the state section of each W-2 (boxes 15–17). Schedule W-2 lists every W-2.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Alabama" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Alabama tax withheld on other 1099s and W-2Gs" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="2025 estimated and extension payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement (Schedule RS)" intro="Pensions from a defined benefit plan, Alabama or federal government retirement, military retirement and TVA are not taxed in Alabama. IRAs and 401(k) plans are taxed, less up to $6,000 per person 65 or older.">
          {r1099.map((x) => {
            const i = d.retirement[x.id] ?? emptyInfo()
            return (
              <fieldset key={x.id} className="grid">
                <legend>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</legend>
                <label className="check"><input type="checkbox" checked={i.exempt} onChange={(e) => putR(x.id, { exempt: e.target.checked })} /> Exempt in Alabama</label>
                {i.exempt && <TextField label="Reason exempt" hint="For example: defined benefit plan, RSA, military" autoComplete="off" value={i.reason} onChange={(s) => putR(x.id, { reason: s })} />}
                <TextField label="Payer FEIN" autoComplete="off" value={i.fein} onChange={(s) => putR(x.id, { fein: s })} />
                <MoneyField label="Alabama tax withheld" value={i.stateTax} onChange={(n) => putR(x.id, { stateTax: n })} />
                {i.stateTax > 0 && <TextField label="Payer’s state ID" autoComplete="off" value={i.stateId} onChange={(s) => putR(x.id, { stateId: s })} />}
              </fieldset>
            )
          })}
        </Section>
      )}

      {ret.interest.length > 0 && (
        <Section title="Interest (Schedule B)" intro="Interest on U.S. obligations is not taxed in Alabama; municipal bond interest from other states is.">
          {ret.interest.map((x) => {
            const i = d.interest[x.id] ?? { usObligation: 0, taxableMuni: 0 }
            const set1 = (p: Partial<typeof i>): void => put({ interest: { ...d.interest, [x.id]: { ...i, ...p } } })
            return (
              <div key={x.id} className="grid">
                <MoneyField label={`${x.payer.trim() || '1099-INT'}: U.S. obligation interest`} value={i.usObligation} onChange={(n) => set1({ usObligation: n })} />
                {x.taxExemptInterest > 0 && <MoneyField label={`${x.payer.trim() || '1099-INT'}: other states’ municipal interest`} value={i.taxableMuni} onChange={(n) => set1({ taxableMuni: n })} />}
              </div>
            )
          })}
        </Section>
      )}

      <Section title="Adjustments, credits and other amounts">
        <div className="grid">
          <MoneyField label="CollegeCounts 529 or PACT contributions" hint="Up to $5,000 ($10,000 joint)" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <MoneyField label="Small employer employee health insurance" value={d.smallEmployerHealth} onChange={(n) => put({ smallEmployerHealth: n })} />
          <MoneyField label="Home retrofit for wind or flood" value={d.homeRetrofit} onChange={(n) => put({ homeRetrofit: n })} />
          <MoneyField label="Catastrophe savings account deposits" value={d.catastropheSavings} onChange={(n) => put({ catastropheSavings: n })} />
          <MoneyField label="First-time home buyer savings deposits" value={d.homeBuyerSavings} onChange={(n) => put({ homeBuyerSavings: n })} />
          <MoneyField label="Firefighter’s insurance premium" value={d.firefighterInsurance} onChange={(n) => put({ firefighterInsurance: n })} />
          <MoneyField label="ABLE account contributions" value={d.ableContributions} onChange={(n) => put({ ableContributions: n })} />
          {ret.schedule1A.carLoanInterest > 0 && <TextField label="Date the new vehicle was bought" placeholder="MM/DD/YYYY" autoComplete="off" value={d.vehiclePurchaseDate} onChange={(s) => put({ vehiclePurchaseDate: date(s) })} />}
          <MoneyField label="Nonrefundable credits (Schedule OC)" hint="Including tax paid to other states" value={d.nonrefundableCredits} onChange={(n) => put({ nonrefundableCredits: n })} />
          <MoneyField label="Refundable credits (Schedule OC, F6)" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
          <MoneyField label="Consumer use tax (Schedule ATP)" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['32'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <p className="why">{al.itemize ? `Itemized deductions (Schedule A): ${usd(al.schA['27'])}.` : `Standard deduction: ${usd(L['11'])}.`} Federal income tax deduction: {usd(L['12'])}.</p>
      </Section>

      {al.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{al.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 40" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Alabama forms" intro="Filled in on this device from the official Alabama Department of Revenue Form 40 and its schedules.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Alabama forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2. Staple W-2s to page 1. Mail refunds to Alabama Department of Revenue, PO Box 154, Montgomery AL 36135-0001; payments (with Form 40V) to PO Box 2401, Montgomery AL 36140-0001; no refund or payment to PO Box 327469, Montgomery AL 36132-7469. My Alabama Taxes files for free. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
