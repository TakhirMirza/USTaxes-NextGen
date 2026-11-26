/**
 * The California part of the State step: Form 540 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { CaInput, Owner, Person } from '../engine/model.ts'
import { CA_COUNTIES, caQualifyingChild, computeCalifornia } from '../engine/ca2025.ts'
import { CA_CONTRIBUTION_CODES, buildCaPacket } from '../pdf/ca2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { ExplainItems } from './creditrows'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import { SelectField } from './steps'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['13', 'Federal adjusted gross income'],
  ['14', 'California subtractions (Schedule CA)'],
  ['16', 'California additions (Schedule CA)'],
  ['17', 'California adjusted gross income'],
  ['18', 'Deduction'],
  ['19', 'Taxable income'],
  ['31', 'Tax'],
  ['32', 'Exemption credits'],
  ['40', 'Child and dependent care credit'],
  ['43', 'Special credit'],
  ['46', 'Renter’s credit'],
  ['48', 'Tax after credits'],
  ['62', 'Behavioral Health Services Tax'],
  ['63', 'Other taxes'],
  ['64', 'Total tax'],
  ['71', 'California tax withheld'],
  ['72', 'Estimated and extension payments'],
  ['75', 'California EITC'],
  ['76', 'Young Child Tax Credit'],
  ['78', 'Total payments'],
  ['91', 'Use tax'],
  ['92', 'Individual Shared Responsibility penalty'],
  ['98', 'Applied to 2026'],
  ['110', 'Contribution'],
  ['111', 'Amount you owe'],
  ['115', 'Refund']
]
const ALWAYS = new Set(['13', '17', '19', '31', '64'])
const KEY = new Set(['17', '19', '64', '111', '115'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const CONTRIBUTION_NAMES: Record<string, string> = {
  400: 'California Seniors Special Fund', 401: 'Alzheimer’s Disease and Related Dementia', 403: 'Rare and Endangered Species',
  405: 'Breast Cancer Research', 406: 'Firefighters’ Memorial', 407: 'Emergency Food for Families', 408: 'Peace Officer Memorial',
  413: 'Cancer Research', 422: 'School Supplies for Homeless Children', 423: 'State Parks Protection Fund', 424: 'Protect Our Coast and Oceans',
  431: 'Prevention of Animal Homelessness and Cruelty', 438: 'Senior Citizen Advocacy', 439: 'Native California Wildlife Rehabilitation',
  445: 'Mental Health Crisis Prevention', 447: 'ALS Research Network', 448: 'Pediatric Cancer Research', 449: 'Parkinson’s Disease Research'
}

export function CaliforniaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ca
  const ca = useMemo(() => computeCalifornia(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<CaInput>): void => set((r) => ({ ...r, ca: { ...r.ca, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildCaPacket(ret, result, ca, preparer)
  const L = ca.lines
  const owes = L['111'] > 0
  const w2Wages = Math.round(ret.w2s.filter((w) => joint || w.owner === 'taxpayer').reduce((s, w) => s + w.wages, 0))
  const kids = ret.dependents.filter((x) => caQualifyingChild(x) || x.age < 13)

  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadCaliforniaForms }) => downloadCaliforniaForms(ret, result, ca, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'California: you owe' : 'California refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['111'] : L['115'])}</p>
        </div>
        <dl>
          <div><dt>California AGI</dt><dd>{usd(L['17'])}</dd></div>
          <div><dt>Taxable income</dt><dd>{usd(L['19'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['64'])}</dd></div>
        </dl>
      </div>

      <Section title="California return" intro={`California starts from your federal AGI, uses its own standard deduction (${usd(ca.deduction.standard)} for your filing status) and gives exemption credits of ${usd(L['11'])} instead of exemptions.`}>
        <div className="grid">
          <SelectField label="County you live in" value={d.county} onChange={(v) => put({ county: v })}
            options={[{ value: '', label: 'Choose a county' }, ...CA_COUNTIES.map((c) => ({ value: c, label: c }))]} />
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" hint="Printed on Form 540; required for the CalEITC" autoComplete="off"
              value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
          {kids.map((dep, i) => (
            <TextField key={dep.id} label={`${dep.name.trim() || `Dependent ${i + 1}`}’s date of birth`} placeholder="MM/DD/YYYY" hint="For FTB 3514 and FTB 3506" autoComplete="off"
              value={d.dependentBirthDates[dep.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [dep.id]: date(s) } })} />
          ))}
        </div>
        <div className="checks">
          <Check label="Everyone in the household had health coverage all year" hint="Otherwise California’s Individual Shared Responsibility penalty may apply (FTB 3853)"
            checked={d.fullYearCoverage} onChange={(on) => put({ fullYearCoverage: on })} />
          {ret.filingStatus === 'mfs' && <Check label="My spouse itemizes on their California return" hint="Then you must itemize too" checked={d.spouseItemizes} onChange={(on) => put({ spouseItemizes: on })} />}
        </div>
        {!d.fullYearCoverage && (
          <div className="grid" style={{ marginTop: 12 }}>
            <MoneyField label="ISR penalty (FTB 3853)" value={d.isrPenalty} onChange={(n) => put({ isrPenalty: n })} />
          </div>
        )}
      </Section>

      <Section title="California tax withheld and paid" intro="California tax withheld shows in W-2 box 17 (state CA) and the state boxes of 1099 forms.">
        <div className="grid">
          <MoneyField label="State wages (W-2 box 16)" hint={d.stateWages === null ? 'Using W-2 box 1; change it if box 16 differs' : 'Line 12'} value={d.stateWages ?? w2Wages} onChange={(n) => put({ stateWages: n })} />
          <MoneyField label="California income tax withheld" value={d.withholding} onChange={(n) => put({ withholding: n })} />
          <MoneyField label="2025 estimated payments" hint="Include a 2024 overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with an extension (FTB 3519)" value={d.extensionPayments} onChange={(n) => put({ extensionPayments: n })} />
        </div>
      </Section>

      <Section title="Renter’s credit" intro="Renters with California AGI up to $53,994 ($107,988 if married filing jointly, head of household or surviving spouse) get $60 or $120 off their tax.">
        <div className="checks">
          <Check label="I paid rent on my California home for at least half of 2025" hint="Not for property exempt from property tax, such as government housing or dorms"
            checked={d.rentedHome} onChange={(on) => put({ rentedHome: on })} />
          {d.rentedHome && <Check label="I (or my spouse) claimed the homeowner’s property tax exemption in 2025" checked={d.homeownerExemption} onChange={(on) => put({ homeownerExemption: on })} />}
        </div>
        {d.rentedHome && <p className="why">{ca.renters.eligible ? `Renter’s credit: ${usd(L['46'])}${L['46'] > 0 && L['48'] === 0 ? ' (it can only lower your tax to zero)' : ''}.` : ca.renters.reason}</p>}
      </Section>

      <Section title="Income California treats differently" intro="Unemployment, Social Security, HSAs and educator expenses are handled from your federal return.">
        <div className="grid">
          <MoneyField label="State tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. obligations" hint="Treasury bills, notes, savings bonds" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="California bonds stay exempt" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other subtractions (Schedule CA)" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <ExplainItems ret={ret} set={set} k="ca.otherSubtractions" setTotal={(r, n) => ({ ...r, ca: { ...r.ca, otherSubtractions: n } })} />
          <MoneyField label="Other additions (Schedule CA)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <ExplainItems ret={ret} set={set} k="ca.otherAdditions" setTotal={(r, n) => ({ ...r, ca: { ...r.ca, otherAdditions: n } })} />
          <MoneyField label="Other itemized deduction adjustments" hint="Schedule CA, Part II, line 27 (+ or −)" allowNegative value={d.itemizedAdjustment} onChange={(n) => put({ itemizedAdjustment: n })} />
          <ExplainItems ret={ret} set={set} k="ca.itemizedAdjustment" setTotal={(r, n) => ({ ...r, ca: { ...r.ca, itemizedAdjustment: n } })} />
        </div>
      </Section>

      <Section title="Credits">
        <dl className="facts">
          <div><dt>California EITC</dt><dd>{usd(L['75'])}</dd></div>
          <div><dt>Young Child Tax Credit</dt><dd>{usd(L['76'])}</dd></div>
          <div><dt>Child care credit</dt><dd>{usd(L['40'])}</dd></div>
        </dl>
        {L['75'] === 0 && ca.eitc.reason && ca.eitc.earned > 0 && <p className="why">CalEITC: {ca.eitc.reason}</p>}
        {ca.care.expenses > 0 && <p className="why">{ca.care.reason || `Child care credit: ${usd(ca.care.expenses)} × ${Math.round(ca.care.federalRate * 100)}% × ${Math.round(ca.care.percent * 100)}% (FTB 3506).`}</p>}
        <div className="checks">
          {ca.care.expenses > 0 && <Check label="The child or dependent care was provided in California" checked={d.careInCalifornia} onChange={(on) => put({ careInCalifornia: on })} />}
          {ret.filingStatus === 'mfs' && <Check label="I am separated from my spouse (for the CalEITC)" checked={d.separatedSpouse} onChange={(on) => put({ separatedSpouse: on })} />}
        </div>
        <div className="grid">
          <TextField label="Special credit code (line 43)" placeholder="e.g. 188" value={d.specialCredit.code} onChange={(s) => put({ specialCredit: { ...d.specialCredit, code: s.replace(/\D/g, '').slice(0, 3) } })} />
          {d.specialCredit.code && <TextField label="Credit name" value={d.specialCredit.name} onChange={(s) => put({ specialCredit: { ...d.specialCredit, name: s } })} />}
          {d.specialCredit.code && <MoneyField label="Credit amount" value={d.specialCredit.amount} onChange={(n) => put({ specialCredit: { ...d.specialCredit, amount: n } })} />}
          <MoneyField label="Other taxes and recapture (line 63)" hint="For example, FTB 3805P on early retirement distributions" value={d.otherTaxes} onChange={(n) => put({ otherTaxes: n })} />
        </div>
      </Section>

      <Section title="Use tax and refund" intro="Use tax is owed on items bought from out-of-state sellers that did not charge California sales tax. Line 91 cannot be left blank.">
        <div className="grid">
          <MoneyField label="Use tax (line 91)" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['97'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          <SelectField label="Voluntary contribution" value={d.contribution.code} onChange={(v) => put({ contribution: { ...d.contribution, code: v } })}
            options={[{ value: '', label: 'None' }, ...CA_CONTRIBUTION_CODES.map((c) => ({ value: c, label: `${c} — ${CONTRIBUTION_NAMES[c]}` }))]} />
          {d.contribution.code && <MoneyField label="Contribution amount" value={d.contribution.amount} onChange={(n) => put({ contribution: { ...d.contribution, amount: n } })} />}
        </div>
        {d.useTax === 0 && (
          <div className="checks">
            <Check label="I paid my use tax directly to CDTFA" hint="Otherwise the form says no use tax is owed" checked={d.useTaxPaidDirectly} onChange={(on) => put({ useTaxPaidDirectly: on })} />
          </div>
        )}
      </Section>

      {ca.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">
            {ca.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}
          </ul>
        </Section>
      )}

      <Section title="Form 540" intro="Whole dollars, as the FTB requires.">
        <table className="lines">
          <tbody>
            {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
              <tr key={k} className={KEY.has(k) ? 'is-key' : ''}>
                <th scope="row"><span className="line-no">{k}</span>{label}</th>
                <td>{L[k] < 0 ? `(${usd(-L[k])})` : usd(L[k] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="California forms" intro="Filled in on this device from the official Franchise Tax Board PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong>
            <ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        <div className="actions">
          <button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download California forms (PDF)'}</button>
        </div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign Side 6 of Form 540 and attach your W-2s and any 1099 forms that show California tax withheld. If your federal return had forms or schedules other than Schedule A or B, attach a copy of it with all of them; if you itemize for California only, attach federal Schedule A. California returns are due April 15, 2026; CalFile lets you e-file for free on ftb.ca.gov.</p>
      </Section>
    </div>
  )
}
