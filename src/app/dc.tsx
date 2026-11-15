/**
 * The DC part of the State step: Form D-40 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { DcInput, Owner, Person } from '../engine/model.ts'
import { computeDc } from '../engine/dc2025.ts'
import { buildDcPacket } from '../pdf/dc2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import { SelectField } from './steps'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['4', 'Federal adjusted gross income'],
  ['6', 'Additions (Schedule I)'],
  ['9', 'State tax refund'],
  ['10', 'Taxable Social Security'],
  ['12', 'Survivor benefits'],
  ['13', 'Unemployment benefits'],
  ['14', 'Other subtractions (Schedule I)'],
  ['16', 'DC adjusted gross income'],
  ['18', 'Deduction'],
  ['19', 'DC taxable income'],
  ['20', 'Tax'],
  ['21', 'Child and dependent care credit'],
  ['22', 'Other non-refundable credits'],
  ['24', 'Tax after credits'],
  ['25', 'Health care shared responsibility'],
  ['26', 'Total tax'],
  ['27d', 'DC EITC (with children)'],
  ['27e', 'DC EITC (without children)'],
  ['28', 'Property tax credit'],
  ['29', 'Other refundable credits'],
  ['31', 'Tax withheld'],
  ['32', 'Estimated payments'],
  ['33', 'Extension payment'],
  ['37', 'Tax due'],
  ['39', 'Applied to 2026'],
  ['41', 'Contribution'],
  ['43', 'Net refund']
]
const ALWAYS = new Set(['4', '16', '19', '20', '26'])
const KEY = new Set(['16', '19', '26', '37', '43'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function DcStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.dc
  const dc = useMemo(() => computeDc(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<DcInput>): void => set((r) => ({ ...r, dc: { ...r.dc, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildDcPacket(ret, result, dc, preparer)
  const L = dc.lines
  const owes = L['37'] > 0

  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadDcForms }) => downloadDcForms(ret, result, dc, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'DC: you owe' : 'DC refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['37'] : L['43'])}</p>
        </div>
        <dl>
          <div><dt>DC AGI</dt><dd>{usd(L['16'])}</dd></div>
          <div><dt>Taxable income</dt><dd>{usd(L['19'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['26'])}</dd></div>
        </dl>
      </div>

      <Section title="DC return" intro={`DC uses its own standard deduction (${usd(dc.deduction.standard)} for your filing status) and does not follow the 2025 federal deductions for tips, overtime, car loan interest or seniors.`}>
        <div className="grid">
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" hint="Printed on the D-40" autoComplete="off"
              value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
        </div>
        {ret.dependents.length > 0 && (
          <div className="grid" style={{ marginTop: 12 }}>
            {ret.dependents.map((dep, i) => (
              <TextField key={dep.id} label={`${dep.name.trim() || `Dependent ${i + 1}`}’s date of birth`} placeholder="MM/DD/YYYY" hint="For Schedule S" autoComplete="off"
                value={d.dependentBirthDates[dep.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [dep.id]: date(s) } })} />
            ))}
          </div>
        )}
        <div className="checks">
          <Check label="Everyone in the household had health coverage all year" hint="Otherwise DC’s Schedule HSR payment may apply"
            checked={d.fullYearCoverage} onChange={(on) => put({ fullYearCoverage: on })} />
        </div>
        {!d.fullYearCoverage && (
          <div className="grid" style={{ marginTop: 12 }}>
            <MoneyField label="Shared responsibility payment (Schedule HSR line 17)" value={d.hsrPayment} onChange={(n) => put({ hsrPayment: n })} />
          </div>
        )}
      </Section>

      <Section title="DC tax withheld and paid" intro="DC tax withheld shows in W-2 box 17 (state DC) and the state boxes of 1099 forms.">
        <div className="grid">
          <MoneyField label="DC income tax withheld" value={d.withholding} onChange={(n) => put({ withholding: n })} />
          <MoneyField label="2025 estimated payments" hint="Include a 2024 overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with an extension (FR-127)" value={d.extensionPayments} onChange={(n) => put({ extensionPayments: n })} />
        </div>
      </Section>

      <Section title="Rent or property tax (Schedule H)" intro="Renters and homeowners with federal AGI up to $66,000 ($90,000 if 70 or older) can get up to $1,425 back. For renters, 20% of the rent counts as property tax.">
        <div className="grid">
          <SelectField label="Your home in DC" value={d.housing} onChange={(v) => put({ housing: v as DcInput['housing'] })}
            options={[{ value: 'none', label: 'Not claiming' }, { value: 'rent', label: 'I rented' }, { value: 'own', label: 'I owned it' }]} />
          {d.housing !== 'none' && (
            <MoneyField label={d.housing === 'rent' ? 'Rent paid in 2025' : '2025 real property tax bill'} hint={d.housing === 'own' ? 'Without special assessments, interest or penalties' : 'Not for housing owned by a government, church or nonprofit'}
              value={d.housingAmount} onChange={(n) => put({ housingAmount: n })} />
          )}
        </div>
        {d.housing !== 'none' && (
          <div className="grid" style={{ marginTop: 12 }}>
            <SelectField label="Type of property" value={d.propertyType} onChange={(v) => put({ propertyType: v as DcInput['propertyType'] })}
              options={[{ value: 'H', label: 'House' }, { value: 'A', label: 'Apartment' }, { value: 'R', label: 'Rooming house' }, { value: 'C', label: 'Condominium' }, { value: 'O', label: 'Cooperative' }]} />
            <TextField label="DC property address" hint="Only if different from your mailing address" value={d.propertyAddress} onChange={(s) => put({ propertyAddress: s })} />
          </div>
        )}
        {d.housing === 'rent' && (
          <div className="grid" style={{ marginTop: 12 }}>
            <TextField label="Landlord’s name" value={d.landlord.name} onChange={(s) => put({ landlord: { ...d.landlord, name: s } })} />
            <TextField label="Landlord’s street address" value={d.landlord.street} onChange={(s) => put({ landlord: { ...d.landlord, street: s } })} />
            <TextField label="Apartment or suite" value={d.landlord.apt} onChange={(s) => put({ landlord: { ...d.landlord, apt: s } })} />
            <TextField label="City" value={d.landlord.city} onChange={(s) => put({ landlord: { ...d.landlord, city: s } })} />
            <TextField label="State" placeholder="DC" value={d.landlord.state} onChange={(s) => put({ landlord: { ...d.landlord, state: s.toUpperCase().slice(0, 2) } })} />
            <TextField label="ZIP code" value={d.landlord.zip} onChange={(s) => put({ landlord: { ...d.landlord, zip: s } })} />
            <TextField label="Landlord’s phone" value={d.landlord.phone} onChange={(s) => put({ landlord: { ...d.landlord, phone: s } })} />
          </div>
        )}
        {d.housing === 'own' && (
          <div className="grid" style={{ marginTop: 12 }}>
            <TextField label="Square" hint="From your real property tax bill" value={d.ssl.square} onChange={(s) => put({ ssl: { ...d.ssl, square: s } })} />
            <TextField label="Suffix" hint="Leave blank if the bill shows none" value={d.ssl.suffix} onChange={(s) => put({ ssl: { ...d.ssl, suffix: s } })} />
            <TextField label="Lot" value={d.ssl.lot} onChange={(s) => put({ ssl: { ...d.ssl, lot: s } })} />
          </div>
        )}
        {d.housing !== 'none' && (
          <p className="why">{dc.propertyCredit.eligible ? `Property tax ${usd(dc.propertyCredit.base)} over ${usd(dc.propertyCredit.threshold)} of your AGI: credit ${usd(dc.propertyCredit.credit)}.` : dc.propertyCredit.reason}</p>
        )}
      </Section>

      <Section title="Income DC treats differently" intro="Unemployment, Social Security and state refunds are handled from your federal return.">
        <div className="grid">
          <MoneyField label="State tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Now taxed by DC; DC bonds stay exempt" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Interest on U.S. obligations" hint="Treasury bills, notes, bonds (Schedule I, B-1)" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="DC College Savings Plan contributions" hint="Up to $4,000 per account owner" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <MoneyField label="DC or federal government survivor benefits" hint="62 or older; not Social Security" value={d.survivorBenefits} onChange={(n) => put({ survivorBenefits: n })} />
          <MoneyField label="Other additions (Schedule I, A)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Other subtractions (Schedule I, B)" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
        </div>
      </Section>

      <Section title="Credits">
        <dl className="facts">
          <div><dt>DC EITC</dt><dd>{usd(L['27d'] + L['27e'])}</dd></div>
          <div><dt>Child care credit (32% of federal)</dt><dd>{usd(L['21'])}</dd></div>
          <div><dt>Property tax credit</dt><dd>{usd(L['28'])}</dd></div>
        </dl>
        <div className="grid">
          <MoneyField label="Other non-refundable credits (Schedule U, 1a)" value={d.nonrefundableCredits} onChange={(n) => put({ nonrefundableCredits: n })} />
          <MoneyField label="Other refundable credits (Schedule U, 1b)" hint="For example, Keep Child Care Affordable (Schedule ELC)" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
          {L['38'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          {L['38'] > 0 && <MoneyField label="Contributions (Schedule U, Part II)" value={d.contribution} onChange={(n) => put({ contribution: n })} />}
        </div>
      </Section>

      {dc.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">
            {dc.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}
          </ul>
        </Section>
      )}

      <Section title="Form D-40" intro="Whole dollars, as DC requires.">
        <table className="lines">
          <tbody>
            {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
              <tr key={k} className={KEY.has(k) ? 'is-key' : ''}>
                <th scope="row"><span className="line-no">{k}</span>{label}</th>
                <td>{usd(L[k] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="DC forms" intro="Filled in on this device from the official DC Office of Tax and Revenue PDF.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Attach these yourself.</strong>
            <ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        <div className="actions">
          <button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download DC form (PDF)'}</button>
        </div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3 and attach W-2s and 1099s that show DC tax withheld. DC returns are due April 15, 2026. DC also offers free online filing on MyTax.DC.gov.</p>
      </Section>
    </div>
  )
}
