/**
 * The Michigan part of the State step: Form MI-1040 and the MI-1040CR homestead property tax credit for
 * full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MiInput, Owner, Person } from '../engine/model.ts'
import { computeMichigan } from '../engine/mi2025.ts'
import { buildMiPacket } from '../pdf/mi2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { SelectField } from './steps'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['10', 'Federal adjusted gross income'], ['11', 'Additions (Schedule 1)'], ['13', 'Subtractions (Schedule 1)'], ['14', 'Income subject to tax'],
  ['15', 'Exemption allowance'], ['16', 'Taxable income'], ['17', 'Tax (4.25%)'], ['18b', 'Credit for tax paid to other states'],
  ['21', 'Income tax'], ['22', 'Contributions'], ['24', 'Use tax'], ['25', 'Total tax'], ['26', 'Homestead property tax credit'],
  ['28b', 'Michigan EITC'], ['31', 'Michigan tax withheld'], ['32', 'Estimated payments'], ['34', 'Total credits and payments'],
  ['38', 'Credit forward'], ['36', 'You owe'], ['39', 'Refund']
]
const ALWAYS = new Set(['10', '14', '15', '16', '17', '25', '34'])
const KEY = new Set(['16', '25', '36', '39'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function MichiganStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.mi
  const mi = useMemo(() => computeMichigan(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MiInput>): void => set((r) => ({ ...r, mi: { ...r.mi, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildMiPacket(ret, result, mi, preparer)
  const L = mi.lines
  const h = mi.homestead
  const owes = L['36'] > 0
  const hasRetirement = ret.retirement.some((x) => x.taxableAmount > 0)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadMichiganForms }) => downloadMichiganForms(ret, result, mi, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Michigan: you owe' : 'Michigan refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['36'] : L['39'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['16'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['25'])}</dd></div>
          <div><dt>Homestead credit</dt><dd>{usd(L['26'])}</dd></div>
        </dl>
      </div>

      <Section title="Michigan return" intro={`Michigan taxes income at a flat 4.25% after exemptions of $5,800 per person (${usd(L['15'])} for your household). Social Security is not taxed.`}>
        <div className="grid">
          <TextField label="School district code" placeholder="5 digits" hint="From the list in the MI-1040 instructions" value={d.schoolDistrictCode} onChange={(s) => put({ schoolDistrictCode: s.replace(/\D/g, '').slice(0, 5) })} />
          <MoneyField label="Michigan tax withheld" hint="W-2 box 17 (state MI)" value={d.withholding} onChange={(n) => put({ withholding: n })} />
          <MoneyField label="Estimated tax, extension payments and 2024 credit forward" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <TextField label="People with a special exemption" hint="Deaf, blind, paraplegic, quadriplegic, hemiplegic, or totally and permanently disabled" value={d.specialExemptions ? String(d.specialExemptions) : ''} onChange={(s) => put({ specialExemptions: Number(s.replace(/\D/g, '').slice(0, 1)) || 0 })} />
          <TextField label="Qualified disabled veterans" value={d.disabledVeterans ? String(d.disabledVeterans) : ''} onChange={(s) => put({ disabledVeterans: Number(s.replace(/\D/g, '').slice(0, 1)) || 0 })} />
        </div>
      </Section>

      {hasRetirement && (
        <Section title="Retirement and pension benefits" intro="People born before 1967 can subtract retirement income: up to 75% of $65,897 ($131,794 joint) in 2025, or more if born before 1946.">
          <div className="grid">
            {owners.map((o) => (
              <TextField key={o} label={`${names[o]}’s year of birth`} placeholder="19xx" value={d.birthYear[o] ? String(d.birthYear[o]) : ''} onChange={(s) => put({ birthYear: { ...d.birthYear, [o]: Number(s.replace(/\D/g, '').slice(0, 4)) || 0 } })} />
            ))}
            {owners.map((o) => (
              <MoneyField key={`p${o}`} label={`${names[o]}: government (public) pensions`} hint="Federal, state or local government plans" value={d.publicPensions[o]} onChange={(n) => put({ publicPensions: { ...d.publicPensions, [o]: n } })} />
            ))}
            <MoneyField label="Military or railroad retirement" hint="Schedule 1 line 11" value={d.militaryRetirement} onChange={(n) => put({ militaryRetirement: n })} />
          </div>
          <p className="why">{mi.retirement.section ? `Retirement subtraction (Form 4884, Section ${mi.retirement.section}): ${usd(mi.retirement.deduction)}.` : 'No retirement subtraction at your year of birth.'}</p>
        </Section>
      )}

      <Section title="Homestead property tax credit (MI-1040CR)" intro="Homeowners and renters with total household resources up to $71,500 can get up to $1,900 back. For renters, 23% of rent counts as property tax.">
        <div className="grid">
          <SelectField label="Your Michigan home" value={d.housing} onChange={(v) => put({ housing: v as MiInput['housing'] })}
            options={[{ value: 'none', label: 'Not claiming' }, { value: 'rent', label: 'I rented' }, { value: 'own', label: 'I owned it' }]} />
          {d.housing === 'own' && <MoneyField label="2025 property taxes levied" value={d.propertyTax} onChange={(n) => put({ propertyTax: n })} />}
          {d.housing === 'own' && <MoneyField label="2025 taxable value of the home" hint="From your assessment notice" value={d.taxableValue} onChange={(n) => put({ taxableValue: n })} />}
          {d.housing === 'rent' && <MoneyField label="Rent paid in 2025" value={d.rentPaid} onChange={(n) => put({ rentPaid: n })} />}
          {d.housing !== 'none' && <MoneyField label="Medical insurance premiums you paid" hint="Reduces household resources" value={d.medicalPremiums} onChange={(n) => put({ medicalPremiums: n })} />}
          {d.housing !== 'none' && <MoneyField label="Other household resources" hint="Child support, gifts, nontaxable income, FIP benefits" value={d.otherHouseholdResources} onChange={(n) => put({ otherHouseholdResources: n })} />}
        </div>
        {d.housing !== 'none' && <p className="why">{h.eligible ? `Household resources ${usd(h.thr)}; credit ${usd(h.credit)}.` : h.reason}</p>}
      </Section>

      <Section title="Other income, credits and refund">
        <div className="grid">
          <MoneyField label="Interest on U.S. obligations" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Taxed in Michigan" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Michigan tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Other additions (Schedule 1)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Other subtractions (Schedule 1)" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <MoneyField label="Tax paid to other states (line 18)" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <MoneyField label="Use tax" hint="On untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          <MoneyField label="Voluntary contributions (Form 4642)" value={d.contributions} onChange={(n) => put({ contributions: n })} />
          {L['37'] > 0 && <MoneyField label="Credit forward to 2026" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {mi.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{mi.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form MI-1040" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Michigan forms" intro="Filled in on this device from the official Michigan Department of Treasury PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Michigan forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. Do not send W-2s; include Schedule W instead. Returns are due April 15, 2026.</p>
      </Section>
    </div>
  )
}
