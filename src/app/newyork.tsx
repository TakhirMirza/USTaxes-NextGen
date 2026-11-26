/**
 * The New York part of the State step: Form IT-201 for full-year residents (state, New York City and
 * Yonkers), built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { NyInput, Owner, Person } from '../engine/model.ts'
import { computeNewYork, salesTaxChart } from '../engine/ny2025.ts'
import { buildNyPacket } from '../pdf/ny2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import { SelectField } from './steps'
import type { StepProps } from './steps'

export const NY_COUNTIES = [
  'Albany', 'Allegany', 'Bronx', 'Broome', 'Cattaraugus', 'Cayuga', 'Chautauqua', 'Chemung', 'Chenango', 'Clinton', 'Columbia', 'Cortland',
  'Delaware', 'Dutchess', 'Erie', 'Essex', 'Franklin', 'Fulton', 'Genesee', 'Greene', 'Hamilton', 'Herkimer', 'Jefferson', 'Kings', 'Lewis',
  'Livingston', 'Madison', 'Monroe', 'Montgomery', 'Nassau', 'New York', 'Niagara', 'Oneida', 'Onondaga', 'Ontario', 'Orange', 'Orleans',
  'Oswego', 'Otsego', 'Putnam', 'Queens', 'Rensselaer', 'Richmond', 'Rockland', 'St. Lawrence', 'Saratoga', 'Schenectady', 'Schoharie',
  'Schuyler', 'Seneca', 'Steuben', 'Suffolk', 'Sullivan', 'Tioga', 'Tompkins', 'Ulster', 'Warren', 'Washington', 'Wayne', 'Westchester',
  'Wyoming', 'Yates'
]
const NYC_COUNTIES = new Set(['Bronx', 'Kings', 'New York', 'Queens', 'Richmond'])

const LINES: [line: string, label: string][] = [
  ['19', 'Federal adjusted gross income'],
  ['24', 'With New York additions'],
  ['32', 'New York subtractions'],
  ['33', 'New York adjusted gross income'],
  ['34', 'Deduction'],
  ['36', 'Dependent exemptions'],
  ['38', 'Taxable income'],
  ['39', 'New York State tax'],
  ['40', 'NYS household credit'],
  ['46', 'Total New York State taxes'],
  ['47a', 'NYC resident tax'],
  ['48', 'NYC household credit'],
  ['54', 'NYC tax after credits'],
  ['55', 'Yonkers surcharge'],
  ['59', 'Sales or use tax'],
  ['60', 'Voluntary contributions'],
  ['61', 'Total taxes'],
  ['63', 'Empire State child credit'],
  ['64', 'Child and dependent care credit'],
  ['65', 'NYS earned income credit'],
  ['67', 'Real property tax credit'],
  ['68', 'College tuition credit'],
  ['69', 'NYC school tax credit (fixed)'],
  ['69a', 'NYC school tax credit (rate reduction)'],
  ['70', 'NYC earned income credit'],
  ['70a', 'NYC income tax elimination credit'],
  ['71', 'Other refundable credits'],
  ['72', 'NYS tax withheld'],
  ['73', 'NYC tax withheld'],
  ['74', 'Yonkers tax withheld'],
  ['75', 'Estimated payments'],
  ['76', 'Total payments'],
  ['79', 'Applied to 2026'],
  ['80', 'Amount you owe'],
  ['78b', 'Refund']
]
const ALWAYS = new Set(['19', '33', '38', '39', '61', '76'])
const KEY = new Set(['33', '38', '61', '80', '78b'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function NewYorkStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ny
  const ny = useMemo(() => computeNewYork(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<NyInput>): void => set((r) => ({ ...r, ny: { ...r.ny, ...p } }))
  const r112 = (p: Partial<NyInput['it112r']>): void => set((r) => ({ ...r, ny: { ...r.ny, it112r: { ...r.ny.it112r, ...p } } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildNyPacket(ret, result, ny, preparer)
  const L = ny.lines
  const owes = L['80'] > 0
  const nyc = d.locality === 'nyc'
  const yonkers = d.locality === 'yonkers'

  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadNewYorkForms }) => downloadNewYorkForms(ret, result, ny, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'New York: you owe' : 'New York refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['80'] : L['78b'])}</p>
        </div>
        <dl>
          <div><dt>New York AGI</dt><dd>{usd(L['33'])}</dd></div>
          <div><dt>Taxable income</dt><dd>{usd(L['38'])}</dd></div>
          <div><dt>{nyc ? 'State + city tax' : 'Total tax'}</dt><dd>{usd(L['61'])}</dd></div>
        </dl>
      </div>

      <Section title="Where you lived" intro="New York City and Yonkers residents also pay city tax on this return.">
        <div className="grid">
          <SelectField label="County" value={d.county} onChange={(v) => put({ county: v, locality: NYC_COUNTIES.has(v) ? 'nyc' : d.locality === 'nyc' ? 'none' : d.locality })}
            options={[{ value: '', label: 'Choose a county' }, ...NY_COUNTIES.map((c) => ({ value: c, label: c }))]} />
          <SelectField label="City tax" value={d.locality} onChange={(v) => put({ locality: v as NyInput['locality'] })}
            options={[{ value: 'none', label: 'Neither' }, { value: 'nyc', label: 'New York City resident all year' }, { value: 'yonkers', label: 'Yonkers resident all year' }]} />
          <TextField label="School district name" value={d.schoolDistrict} onChange={(s) => put({ schoolDistrict: s })} />
          <TextField label="School district code" placeholder="3 digits" hint="From the school district list in the IT-201 instructions" value={d.schoolDistrictCode} onChange={(s) => put({ schoolDistrictCode: s.replace(/\D/g, '').slice(0, 3) })} />
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off"
              value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
          {ret.dependents.map((dep, i) => (
            <TextField key={dep.id} label={`${dep.name.trim() || `Dependent ${i + 1}`}’s date of birth`} placeholder="MM/DD/YYYY" hint="Item H and Form IT-213" autoComplete="off"
              value={d.dependentBirthDates[dep.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [dep.id]: date(s) } })} />
          ))}
        </div>
      </Section>

      <Section title="Tax withheld and paid" intro="W-2 box 17 (state NY) and box 19 (locality NYC or Yonkers).">
        <div className="grid">
          <MoneyField label="New York State tax withheld" value={d.withholding} onChange={(n) => put({ withholding: n })} />
          {nyc && <MoneyField label="New York City tax withheld" value={d.nycWithholding} onChange={(n) => put({ nycWithholding: n })} />}
          {yonkers && <MoneyField label="Yonkers tax withheld" value={d.yonkersWithholding} onChange={(n) => put({ yonkersWithholding: n })} />}
          <MoneyField label="Estimated payments and IT-370 payment" hint="Include a 2024 overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Income New York treats differently" intro="Social Security and state refunds are subtracted automatically; pensions of people 59½ or older are partly excluded.">
        <div className="grid">
          <MoneyField label="State or local tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Line 20; New York bonds stay exempt" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="414(h) retirement contributions" hint="Public employees: W-2 box 14" value={d.pension414h} onChange={(n) => put({ pension414h: n })} />
          <MoneyField label="Interest on U.S. government bonds" hint="Treasury bills, notes, savings bonds" value={d.usBondInterest} onChange={(n) => put({ usBondInterest: n })} />
          <MoneyField label="NY 529 plan contributions" hint={`Up to ${joint ? '$10,000' : '$5,000'}`} value={d.nys529Contributions} onChange={(n) => put({ nys529Contributions: n })} />
          {owners.map((o) => (
            <MoneyField key={o} label={`${names[o]}: NYS, local or federal government pension`} hint="Fully subtracted (line 26)" value={d.govPensions[o]} onChange={(n) => put({ govPensions: { ...d.govPensions, [o]: n } })} />
          ))}
          <MoneyField label="Other additions (Form IT-225)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Other subtractions (Form IT-225)" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <MoneyField label="Job and miscellaneous expenses (IT-196 lines 21–24)" hint="New York still allows these over 2% of AGI when you itemize" value={d.itemizedMiscellaneous} onChange={(n) => put({ itemizedMiscellaneous: n })} />
        </div>
        {L['29'] > 0 && <p className="why">Pension and annuity exclusion: {usd(L['29'])}.</p>}
        <p className="why">{ny.deduction.it196 ? `New York itemized deduction (Form IT-196): ${usd(ny.deduction.itemized)}; standard deduction: ${usd(ny.deduction.standard)}. Using the ${ny.deduction.method}.` : `Standard deduction: ${usd(ny.deduction.standard)}. Itemized deductions entered on the Deductions step are figured on Form IT-196 automatically.`}</p>
      </Section>

      <Section title="Credits">
        <dl className="facts">
          <div><dt>Empire State child credit</dt><dd>{usd(L['63'])}</dd></div>
          <div><dt>NYS earned income credit</dt><dd>{usd(L['65'])}</dd></div>
          {nyc && <div><dt>NYC earned income credit</dt><dd>{usd(L['70'])}</dd></div>}
          {nyc && <div><dt>NYC school tax credits</dt><dd>{usd(L['69'] + L['69a'])}</dd></div>}
          {L['64'] > 0 && <div><dt>Child and dependent care credit</dt><dd>{usd(L['64'])}</dd></div>}
          {nyc && L['70a'] > 0 && <div><dt>NYC income tax elimination credit</dt><dd>{usd(L['70a'])}</dd></div>}
        </dl>
        {ny.care.line14 > 0 && <p className="why">Child care (Form IT-216): {usd(ny.care.line8)} × {Math.round(ny.care.line10 * 100)}% × {ny.care.line13.toFixed(3)} = {usd(ny.care.line14)} New York State{ny.care.nycCredit ? `, plus ${usd(ny.care.nycCredit)} New York City for children under 4` : ''}.</p>}
        <div className="grid">
          {nyc && L['19'] <= 30000 && ny.care.persons > 0 && (
            <MoneyField label="Care expenses for children under 4" hint="For the NYC child care credit (IT-216 line 23)" value={d.careExpensesUnder4 ?? ny.care.under4Expenses} onChange={(n) => put({ careExpensesUnder4: n })} />
          )}
          <MoneyField label="Real property tax credit (Form IT-214)" value={d.realPropertyCredit} onChange={(n) => put({ realPropertyCredit: n })} />
          <MoneyField label="College tuition credit (Form IT-272)" value={d.collegeTuitionCredit} onChange={(n) => put({ collegeTuitionCredit: n })} />
          {!ny.it112r && <MoneyField label="Resident credit for tax paid to another state, if you figured it yourself" hint="Or fill in Form IT-112-R below" value={d.residentCredit} onChange={(n) => put({ residentCredit: n })} />}
          <MoneyField label="Other NYS nonrefundable credits (IT-201-ATT)" value={d.otherNonrefundableCredits} onChange={(n) => put({ otherNonrefundableCredits: n })} />
          <MoneyField label="Other refundable credits (IT-201-ATT)" value={d.otherRefundableCredits} onChange={(n) => put({ otherRefundableCredits: n })} />
          <MoneyField label="Other NYS taxes (IT-201-ATT)" value={d.otherTaxes} onChange={(n) => put({ otherTaxes: n })} />
        </div>
        <details className="explain" open={!!ny.it112r}>
          <summary>{ny.it112r ? `Form IT-112-R: resident credit ${usd(ny.it112r['34'])} (IT-201 line 41)` : 'Form IT-112-R (credit for income tax paid to another state, locality or D.C.)'}</summary>
          <div className="grid">
            <TextField label="Other state (two letters)" hint="Line 23" value={d.it112r.state} onChange={(v) => r112({ state: v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} />
            <TextField label="Locality name, if a local tax" value={d.it112r.locality} onChange={(v) => r112({ locality: v })} />
          </div>
          {d.it112r.state.trim() && (
            <>
              <p className="why">Column B: the income that the other jurisdiction sourced to itself and taxed. Column A comes from this return.</p>
              <div className="grid">
              <MoneyField label="Wages" hint="Column B, line 1" value={d.it112r.b['1'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '1': n } })} />
              <MoneyField label="Taxable interest" hint="Column B, line 2" value={d.it112r.b['2'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '2': n } })} />
              <MoneyField label="Ordinary dividends" hint="Column B, line 3" value={d.it112r.b['3'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '3': n } })} />
              <MoneyField label="Business income or loss" hint="Column B, line 6" value={d.it112r.b['6'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '6': n } })} />
              <MoneyField label="Capital gain or loss" hint="Column B, line 7" value={d.it112r.b['7'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '7': n } })} />
              <MoneyField label="Other gains or losses" hint="Column B, line 8" value={d.it112r.b['8'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '8': n } })} />
              <MoneyField label="IRA distributions" hint="Column B, line 9" value={d.it112r.b['9'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '9': n } })} />
              <MoneyField label="Pensions and annuities" hint="Column B, line 10" value={d.it112r.b['10'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '10': n } })} />
              <MoneyField label="Rental, royalties, partnerships, S corporations" hint="Column B, line 11" value={d.it112r.b['11'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '11': n } })} />
              <MoneyField label="Other income" hint="Column B, line 15" value={d.it112r.b['15'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '15': n } })} />
              <MoneyField label="Federal adjustments to income" hint="Column B, line 17" value={d.it112r.b['17'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '17': n } })} />
              <MoneyField label="Capital gain portion of lump-sum distributions" hint="Column B, line 21" value={d.it112r.b['21'] ?? 0} onChange={(n) => r112({ b: { ...d.it112r.b, '21': n } })} />
              </div>
              <div className="grid">
                <MoneyField label="Income tax imposed by the other jurisdiction" hint="Line 24a: tax on its return, not what was withheld" value={d.it112r.taxpayerTax} onChange={(n) => r112({ taxpayerTax: n })} />
                <MoneyField label="Pass-through entity tax paid for you (similar to NY PTET)" hint="Line 24b" value={d.it112r.entityTax} onChange={(n) => r112({ entityTax: n })} />
                <MoneyField label="Withholding and estimated payments to the other jurisdiction" hint="Line 35" value={d.it112r.prepayments} onChange={(n) => r112({ prepayments: n })} />
                <MoneyField label="Overpayment on the other return" hint="Line 36" value={d.it112r.overpayment} onChange={(n) => r112({ overpayment: n })} />
                <MoneyField label="Balance due on the other return" hint="Line 37" value={d.it112r.balanceDue} onChange={(n) => r112({ balanceDue: n })} />
                {d.it112r.composite && <TextField label="Group return EIN" value={d.it112r.groupEin} onChange={(v) => r112({ groupEin: v })} />}
              </div>
              <div className="checks"><Check label="The tax was paid on a group (composite) return" checked={d.it112r.composite} onChange={(on) => r112({ composite: on })} /></div>
            </>
          )}
        </details>
      </Section>

      <Section title="Sales or use tax and refund" intro="Line 59 cannot be left blank: enter the use tax you owe on purchases that were not taxed, or 0.">
        <div className="checks">
          <Check label={`Use the sales and use tax chart (${usd(salesTaxChart(L['19']))} for your income)`} hint="For purchases under $1,000 each" checked={d.salesTaxChart} onChange={(on) => put({ salesTaxChart: on })} />
        </div>
        <div className="grid">
          {!d.salesTaxChart && <MoneyField label="Sales or use tax owed" value={d.salesTax} onChange={(n) => put({ salesTax: n })} />}
          <MoneyField label="Voluntary contributions (Form IT-227)" value={d.contributions} onChange={(n) => put({ contributions: n })} />
          {L['77'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {ny.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">
            {ny.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}
          </ul>
        </Section>
      )}

      <Section title="Form IT-201" intro="Whole dollars, as New York requires.">
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

      <Section title="New York forms" intro="Filled in on this device from the official Department of Taxation and Finance PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong>
            <ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        <div className="actions">
          <button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download New York forms (PDF)'}</button>
        </div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 4. Do not send W-2s; New York gets them from employers. Returns are due April 15, 2026. Free e-file options are listed at tax.ny.gov (search: free file).</p>
      </Section>
    </div>
  )
}
