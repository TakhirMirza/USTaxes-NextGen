/**
 * The Indiana part of the State step: Form IT-40 for full-year residents, with county tax (Schedule CT-40).
 */
import { ReactElement, useMemo, useState } from 'react'
import type { InInput, Owner, Person } from '../engine/model.ts'
import { computeIndiana } from '../engine/in2025.ts'
import { IN_COUNTIES } from '../engine/inCounties2025.ts'
import { buildInPacket } from '../pdf/in2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Add-backs (Schedule 1)'], ['4', 'Deductions (Schedule 2)'], ['6', 'Exemptions (Schedule 3)'],
  ['7', 'Indiana adjusted gross income'], ['8', 'State tax (3%)'], ['9', 'County tax'], ['10', 'Other taxes'], ['11', 'Indiana taxes'],
  ['12', 'Credits and payments (Schedule 5)'], ['13', 'Offset credits (Schedule 6)'], ['17', 'Donations'], ['19d', 'Applied to 2026'],
  ['21', 'Refund'], ['26', 'Amount you owe']
]
const ALWAYS = new Set(['1', '7', '8', '11', '12'])
const KEY = new Set(['7', '11', '21', '26'])
const COUNTIES = Object.entries(IN_COUNTIES)
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function IndianaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.in
  const it = useMemo(() => computeIndiana(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<InInput>): void => set((r) => ({ ...r, in: { ...r.in, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildInPacket(ret, result, it, preparer)
  const L = it.lines
  const owes = L['26'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const countySelect = (id: string, label: string, value: string, onChange: (v: string) => void): ReactElement => (
    <div className="field" key={id}>
      <label htmlFor={id}><span>{label}</span></label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose</option>
        {COUNTIES.map(([code, c]) => <option key={code} value={code}>{code} {c.name} ({(c.rate * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%)</option>)}
        <option value="00">00 Outside Indiana</option>
      </select>
    </div>
  )
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadIndianaForms }) => downloadIndianaForms(ret, result, it, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Indiana: you owe' : 'Indiana refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['26'] : L['21'])}</p>
        </div>
        <dl>
          <div><dt>Indiana AGI</dt><dd>{usd(L['7'])}</dd></div>
          <div><dt>State tax</dt><dd>{usd(L['8'])}</dd></div>
          <div><dt>County tax</dt><dd>{usd(L['9'])}</dd></div>
        </dl>
      </div>

      <Section title="Indiana return" intro="Indiana taxes income at a flat 3% plus the tax of the county you lived in on January 1, 2025.">
        <div className="grid">
          {owners.flatMap((o) => [
            countySelect(`in-lived-${o}`, `${names[o]}: county lived in on Jan. 1, 2025`, d.countyLived[o], (v) => put({ countyLived: { ...d.countyLived, [o]: v } })),
            countySelect(`in-worked-${o}`, `${names[o]}: county worked in on Jan. 1, 2025`, d.countyWorked[o], (v) => put({ countyWorked: { ...d.countyWorked, [o]: v } }))
          ])}
        </div>
        <p className="why">County tax: {usd(it.county.incomeA)} × {(it.county.rateA * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%{it.county.codeB ? ` and ${usd(it.county.incomeB)} × ${(it.county.rateB * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%` : ''} = {usd(it.county.tax)}.</p>
      </Section>

      <Section title="Indiana withholding and payments" intro="From the state section of each W-2: state tax in box 17, county tax in box 19.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Indiana" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="County tax withheld (W-2 box 19 and 1099s)" value={d.countyWithheld} onChange={(n) => put({ countyWithheld: n })} />
          <MoneyField label="Indiana state tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2025 estimated and extension payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Deductions" intro="Social Security is not taxed. Rent up to $3,000 and property tax on your home up to $2,500 are deducted.">
        <div className="grid">
          <MoneyField label="Rent paid on your Indiana home" value={d.rentPaid} onChange={(n) => put({ rentPaid: n })} />
          {d.rentPaid > 0 && <NumberField label="Months rented" max={12} value={d.monthsRented} onChange={(n) => put({ monthsRented: n })} />}
          {d.rentPaid > 0 && <TextField label="Landlord’s name and address" autoComplete="off" value={d.landlord} onChange={(s) => put({ landlord: s })} />}
          <MoneyField label="Property tax paid on your Indiana home" value={d.propertyTax} onChange={(n) => put({ propertyTax: n })} />
          <MoneyField label="State tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. government obligations" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Active-duty military pay" value={d.activeMilitaryPay} onChange={(n) => put({ activeMilitaryPay: n })} />
          <NumberField label="Children in private school or homeschool" hint="$1,000 each" max={20} value={d.privateSchoolChildren} onChange={(n) => put({ privateSchoolChildren: n })} />
          <MoneyField label="Other deductions (Schedule 2 line 11)" value={d.otherDeductions} onChange={(n) => put({ otherDeductions: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Bonds bought after 2011 are added back" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other add-backs (Schedule 1)" value={d.otherAddBacks} onChange={(n) => put({ otherAddBacks: n })} />
        </div>
      </Section>

      <Section title="Exemptions" intro="$1,000 for each filer and dependent, $1,500 more for each dependent child, $1,000 for 65 or older and for blindness.">
        <div className="grid">
          <NumberField label="Dependent children claimed for the first time" hint="Schedule IN-DEP box F: one more $1,500 each" max={9} value={d.firstTimeChildren} onChange={(n) => put({ firstTimeChildren: n })} />
          <NumberField label="Adopted children" hint="Schedule IN-DEP-A: $3,000 each" max={9} value={d.adoptedChildren} onChange={(n) => put({ adoptedChildren: n })} />
        </div>
        <p className="why">Exemptions total {usd(it.s3['7'])}.</p>
      </Section>

      <Section title="Credits and refund">
        <div className="grid">
          <MoneyField label="Credit for taxes paid to other states" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <MoneyField label="College credit (Schedule CC-40)" value={d.collegeCredit} onChange={(n) => put({ collegeCredit: n })} />
          <MoneyField label="Other offset credits (Schedule 6)" value={d.offsetCredits} onChange={(n) => put({ offsetCredits: n })} />
          <MoneyField label="Other refundable credits (Schedule 5)" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
          <MoneyField label="Use tax on out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          <MoneyField label="Donations (Schedule IN-DONATE)" value={d.donations} onChange={(n) => put({ donations: n })} />
          {L['18'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <p className="why">
          {it.s5['6'] > 0 ? `Indiana earned income credit: ${usd(it.s5['6'])} (10% of the federal credit). ` : ''}
          {it.s5['5'] > 0 ? `Unified tax credit for the elderly: ${usd(it.s5['5'])}.` : ''}
        </p>
      </Section>

      {it.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{it.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form IT-40" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Indiana forms" intro="Filled in on this device from the official Indiana Department of Revenue PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Indiana forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign the IT-40 after reading Schedule 7. Mail payments to Indiana Department of Revenue, P.O. Box 7224, Indianapolis IN 46207-7224; other returns to P.O. Box 40, Indianapolis IN 46206-0040. INfreefile is free for many filers. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
