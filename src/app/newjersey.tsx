/**
 * The New Jersey part of the State step: Form NJ-1040 for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { NjInput, Owner, Person } from '../engine/model.ts'
import { computeNewJersey, NJ_DONATION_LINES } from '../engine/nj2025.ts'
import { buildNjPacket } from '../pdf/nj2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import { SelectField } from './steps'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['15', 'Wages (W-2 box 16)'], ['16a', 'Taxable interest'], ['17', 'Dividends'], ['18', 'Business profits'], ['19', 'Net gains from property'],
  ['20a', 'Taxable pensions, annuities and IRAs'], ['21', 'Partnership income'], ['22', 'S corporation income'], ['23', 'Rents and royalties'],
  ['24', 'Gambling winnings'], ['25', 'Alimony received'], ['26', 'Other income'], ['27', 'Total income'], ['28c', 'Retirement exclusions'],
  ['29', 'New Jersey gross income'], ['30', 'Exemptions'], ['31', 'Medical expenses'], ['32', 'Alimony paid'], ['39', 'Taxable income'],
  ['41', 'Property Tax Deduction'], ['42', 'New Jersey taxable income'], ['43', 'Tax'], ['44', 'Credit for taxes paid elsewhere'],
  ['51', 'Use tax'], ['54', 'Total tax due'], ['55', 'NJ tax withheld'], ['56', 'Property Tax Credit'], ['57', 'Estimated payments'],
  ['58', 'NJ Earned Income Tax Credit'], ['64', 'Child and Dependent Care Credit'], ['65', 'NJ Child Tax Credit'], ['66', 'Total payments and credits'],
  ['69', 'Credited to 2026'], ['79', 'Balance due'], ['80', 'Refund']
]
const ALWAYS = new Set(['27', '29', '39', '42', '43', '54', '66'])
const KEY = new Set(['42', '54', '79', '80'])
const DONATIONS: Record<string, string> = { '70': 'Endangered Wildlife Fund', '71': 'Children’s Trust Fund', '72': 'Vietnam Veterans’ Memorial Fund', '73': 'Breast Cancer Research Fund', '74': 'U.S.S. New Jersey Educational Museum' }
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function NewJerseyStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.nj
  const nj = useMemo(() => computeNewJersey(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<NjInput>): void => set((r) => ({ ...r, nj: { ...r.nj, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildNjPacket(ret, result, nj, preparer)
  const L = nj.lines
  const owes = L['79'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const hasRetirement = ret.retirement.some((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadNewJerseyForms }) => downloadNewJerseyForms(ret, result, nj, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'New Jersey: you owe' : 'New Jersey refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['79'] : L['80'])}</p>
        </div>
        <dl>
          <div><dt>NJ gross income</dt><dd>{usd(L['29'])}</dd></div>
          <div><dt>Taxable income</dt><dd>{usd(L['42'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['43'])}</dd></div>
        </dl>
      </div>

      <Section title="New Jersey return" intro="New Jersey taxes income by category, not from your federal AGI: a loss in one category does not reduce another, and Social Security and unemployment are not taxed.">
        <div className="grid">
          <TextField label="County/municipality code" placeholder="4 digits" hint="From the table in the NJ-1040 instructions" autoComplete="off" value={d.municipalityCode} onChange={(s) => put({ municipalityCode: s.replace(/\D/g, '').slice(0, 4) })} />
          <MoneyField label="Estimated payments and 2024 credit" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="NJ tax withheld on 1099s and W-2Gs" value={d.otherWithholding} onChange={(n) => put({ otherWithholding: n })} />
          {ret.dependents.length > 0 && <NumberField label="Dependents attending college full time" hint="Under 22; $1,000 each" max={9} value={d.collegeDependents} onChange={(n) => put({ collegeDependents: n })} />}
        </div>
        <div className="checks">
          {owners.map((o) => <Check key={`v${o}`} label={`${names[o]} is an honorably discharged veteran`} hint="$6,000 exemption" checked={d.veteran[o]} onChange={(on) => put({ veteran: { ...d.veteran, [o]: on } })} />)}
          {owners.map((o) => <Check key={`d${o}`} label={`${names[o]} is disabled (Social Security guidelines)`} hint="$1,000 exemption; also qualifies for the pension exclusion" checked={d.disabled[o]} onChange={(on) => put({ disabled: { ...d.disabled, [o]: on } })} />)}
          {owners.map((o) => <Check key={`e${o}`} label={`$1 to the Gubernatorial Elections Fund (${names[o]})`} checked={d.electionFund[o]} onChange={(on) => put({ electionFund: { ...d.electionFund, [o]: on } })} />)}
        </div>
      </Section>

      <Section title="New Jersey withholding and wages" intro="Line 15 uses W-2 box 16. New Jersey taxes contributions to retirement plans other than 401(k)s, so box 16 can be higher than box 1.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="NJ" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
      </Section>

      <Section title="Your home" intro="Homeowners and renters get a Property Tax Deduction (up to $15,000) or a $50 credit, whichever helps more. Renters count 18% of rent as property tax.">
        <div className="grid">
          <SelectField label="Your main home in New Jersey" value={d.housing} onChange={(v) => put({ housing: v as NjInput['housing'] })}
            options={[{ value: 'none', label: 'Not claiming' }, { value: 'own', label: 'I owned it' }, { value: 'rent', label: 'I rented' }, { value: 'both', label: 'Both during the year' }]} />
          {(d.housing === 'own' || d.housing === 'both') && <MoneyField label="2025 property taxes paid (your share)" value={d.propertyTax} onChange={(n) => put({ propertyTax: n })} />}
          {(d.housing === 'rent' || d.housing === 'both') && <MoneyField label="2025 rent paid (your share)" value={d.rentPaid} onChange={(n) => put({ rentPaid: n })} />}
        </div>
        {nj.propertyTax.eligible && <p className="why">{nj.propertyTax.method === 'deduction' ? `Deduction of ${usd(L['41'])} saves ${usd(nj.propertyTax.benefit)} in tax.` : nj.propertyTax.method === 'credit' ? `The ${usd(L['56'])} credit helps more than the deduction (which would save ${usd(nj.propertyTax.benefit)}).` : 'Income is under the filing threshold, so no credit applies.'}</p>}
      </Section>

      <Section title="Income and deductions New Jersey treats differently">
        <div className="grid">
          <MoneyField label="Interest on U.S. obligations" hint="Not taxed in NJ" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Taxed in NJ" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          {hasRetirement && <MoneyField label="Taxable pensions and IRAs under NJ rules (line 20a)" hint={`Leave as is to use the federal taxable amount`} value={d.pensionTaxable ?? L['20a']} onChange={(n) => put({ pensionTaxable: n })} />}
          {hasRetirement && <MoneyField label="Excludable pensions and IRAs (line 20b)" value={d.pensionExcludable ?? L['20b']} onChange={(n) => put({ pensionExcludable: n })} />}
          <MoneyField label="Net gambling winnings" value={d.gamblingWinnings} onChange={(n) => put({ gamblingWinnings: n })} />
          <MoneyField label="Alimony received" value={d.alimonyReceived} onChange={(n) => put({ alimonyReceived: n })} />
          <MoneyField label="Other income (line 26)" value={d.otherIncome} onChange={(n) => put({ otherIncome: n })} />
          <MoneyField label="Alimony paid" value={d.alimonyPaid} onChange={(n) => put({ alimonyPaid: n })} />
          <MoneyField label="Unreimbursed medical expenses" hint="The part over 2% of NJ gross income is deducted" value={d.medicalExpenses} onChange={(n) => put({ medicalExpenses: n })} />
          <MoneyField label="Credit for taxes paid to other jurisdictions" hint="From Schedule NJ-COJ" value={d.otherJurisdictionCredit} onChange={(n) => put({ otherJurisdictionCredit: n })} />
          <MoneyField label="Use tax" hint="On untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['68'] > 0 && <MoneyField label="Credit to 2026 tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        {(d.pensionTaxable !== null || d.pensionExcludable !== null) && (
          <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ pensionTaxable: null, pensionExcludable: null })}>Use the federal pension amounts</button></div>
        )}
        <div className="checks">
          <Check label="Someone in my household had no health coverage for part of 2025" hint="Schedule NJ-HCC Part II and the shared responsibility payment (line 53c)" checked={d.missingCoverage} onChange={(on) => put({ missingCoverage: on })} />
          <Check label="Someone in my household does not have health insurance now" hint="Line 53a; enclose the NJ-EZ Enroll form" checked={d.currentlyUninsured} onChange={(on) => put({ currentlyUninsured: on })} />
          {d.currentlyUninsured && <Check label="Let Get Covered New Jersey help us get coverage" hint="Line 53b" checked={d.getCoveredHelp} onChange={(on) => put({ getCoveredHelp: on })} />}
        </div>
        {d.missingCoverage && nj.hcc && (
          <div className="hcc">
            <p className="why">Check every month each person had minimum essential coverage or an exemption (coverage for part of a month counts as the whole month).</p>
            {nj.hcc.members.map((m) => {
              const cur = d.hcc[m.key] ?? { months: Array(12).fill(true), exemption: '', moreExemptions: false }
              const putM = (q: Partial<typeof cur>): void => put({ hcc: { ...d.hcc, [m.key]: { ...cur, ...q } } })
              return (
                <fieldset key={m.key} className="statement">
                  <legend>{m.name || 'Household member'}{m.under18 ? ' (under 18)' : ''}</legend>
                  <div className="checks months">
                    {MONTHS.map((mo, i) => <Check key={mo} label={mo} checked={cur.months[i] !== false} onChange={(on) => putM({ months: cur.months.map((x, j) => (j === i ? on : x)) })} />)}
                  </div>
                  <div className="grid">
                    <TextField label="Exemption number" hint="If an exemption covered some months" autoComplete="off" value={cur.exemption} onChange={(v) => putM({ exemption: v })} />
                    {cur.exemption.trim() !== '' && <Check label="This person has more than one exemption number" checked={cur.moreExemptions} onChange={(on) => putM({ moreExemptions: on })} />}
                  </div>
                </fieldset>
              )
            })}
            <div className="grid">
              <MoneyField label="Dependents’ income and tax-exempt interest" hint="Worksheet L line 3; include estimates for dependents who do not file" value={d.dependentIncome} onChange={(n) => put({ dependentIncome: n })} />
            </div>
            <p className="why">{nj.hcc.worksheet ? `Shared responsibility payment (line 53c): ${usd(L['53c'])}.` : 'Everyone was covered every month: no payment is due.'}</p>
          </div>
        )}
        <details className="more">
          <summary>Donate to a New Jersey fund (lines 70–74)</summary>
          <div className="grid">
            {NJ_DONATION_LINES.map((k) => <MoneyField key={k} label={DONATIONS[k]} value={d.donations[k] ?? 0} onChange={(n) => put({ donations: { ...d.donations, [k]: n } })} />)}
          </div>
        </details>
      </Section>

      {nj.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{nj.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form NJ-1040" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="New Jersey forms" intro="Filled in on this device from the official NJ Division of Taxation PDF.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download New Jersey forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 4 and enclose your W-2s. Returns are due April 15, 2026. New Jersey offers free e-filing through NJ Online Income Tax Filing at nj.gov/taxation.</p>
      </Section>
    </div>
  )
}
