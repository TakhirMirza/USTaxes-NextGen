/**
 * The Wisconsin part of the State step: Form 1 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { Owner, Person, WiInput } from '../engine/model.ts'
import { WI_DONATION_LINES, computeWisconsin } from '../engine/wi2025.ts'
import { buildWiPacket } from '../pdf/wi2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Schedule I adjustments'], ['4', 'Additions (Schedule AD)'], ['6', 'Subtractions (Schedule SB)'],
  ['7', 'Wisconsin income'], ['8', 'Standard deduction'], ['10c', 'Exemptions'], ['11', 'Taxable income'], ['12', 'Tax'],
  ['13', 'Itemized deduction credit'], ['14', 'Additional child and dependent care credit'], ['16a', 'Renter’s school property tax credit'],
  ['16b', 'Homeowner’s school property tax credit'], ['18', 'Married couple credit'], ['19', 'Schedule CR credits'], ['20', 'Tax paid to another state'],
  ['22', 'Net tax'], ['23', 'Use tax'], ['24', 'Donations'], ['27', 'Total'], ['28', 'Wisconsin tax withheld'], ['29', 'Estimated payments'],
  ['30', 'Earned income credit'], ['33', 'Homestead credit'], ['35', 'Schedule CR refundable credits'], ['37', 'Total payments and credits'],
  ['42', 'Applied to 2026'], ['41', 'Refund'], ['45', 'Amount you owe']
]
const ALWAYS = new Set(['1', '7', '8', '11', '12', '22', '27', '37'])
const KEY = new Set(['11', '22', '41', '45'])
const DONATIONS: Record<string, string> = {
  '1a': 'Endangered resources', '1b': 'Cancer research', '1c': 'Veterans trust fund', '1d': 'Multiple sclerosis',
  '1e': 'Military family relief fund', '1f': 'Second Harvest/Feeding America', '1g': 'American Red Cross Badger Chapter', '1h': 'Special Olympics Wisconsin'
}
const SB: [key: string, label: string][] = [
  ['stateRefund', 'State income tax refund'], ['usInterest', 'U.S. government interest'], ['socialSecurity', 'Taxable Social Security'],
  ['capitalGain', '30% of net long-term capital gain'], ['retirement', 'Retirement benefits'], ['collegeSavings', 'Edvest/ABLE contributions'],
  ['medicalInsurance', 'Medical care insurance'], ['privateSchool', 'Private school tuition'], ['other', 'Other subtractions']
]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function WisconsinStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.wi
  const wi = useMemo(() => computeWisconsin(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<WiInput>): void => set((r) => ({ ...r, wi: { ...r.wi, ...p } }))
  const joint = wi.status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildWiPacket(ret, result, wi, preparer)
  const L = wi.lines
  const owes = L['45'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadWisconsinForms }) => downloadWisconsinForms(ret, result, wi, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Wisconsin: you owe' : 'Wisconsin refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['45'] : L['41'])}</p>
        </div>
        <dl>
          <div><dt>Wisconsin income</dt><dd>{usd(L['7'])}</dd></div>
          <div><dt>Taxable income</dt><dd>{usd(L['11'])}</dd></div>
          <div><dt>Net tax</dt><dd>{usd(L['22'])}</dd></div>
        </dl>
      </div>

      <Section title="Wisconsin return" intro="Wisconsin taxes income at 3.5% to 7.65%. The standard deduction shrinks as income rises, and each person and dependent is a $700 exemption ($250 more at 65 or older).">
        <div className="field">
          <label htmlFor="wi-district"><span>Where you lived on December 31, 2025</span></label>
          <select id="wi-district" className="select" value={d.districtType} onChange={(e) => put({ districtType: e.target.value as WiInput['districtType'] })}>
            <option value="">Choose</option><option value="city">City</option><option value="village">Village</option><option value="town">Town</option>
          </select>
        </div>
        <div className="grid">
          <TextField label="Name of the city, village or town" autoComplete="off" value={d.districtName} onChange={(s) => put({ districtName: s })} />
          <TextField label="County" autoComplete="off" value={d.county} onChange={(s) => put({ county: s })} />
          <TextField label="School district number" hint="4 digits, instructions page 45" autoComplete="off" value={d.schoolDistrict} onChange={(s) => put({ schoolDistrict: s.replace(/\D/g, '').slice(0, 4) })} />
        </div>
        {wi.status === 'hoh' && ret.filingStatus === 'hoh' && (
          <div className="checks"><Check label="I am married and file as head of household" hint="Wisconsin asks for your spouse’s name and SSN" checked={d.hohMarried} onChange={(on) => put({ hohMarried: on })} /></div>
        )}
        <p className="why">{ret.filingStatus === 'qss' ? 'A qualifying surviving spouse files as head of household in Wisconsin. ' : ''}Exemptions: {wi.exemptions.filers + wi.exemptions.dependents} × $700{wi.exemptions.age65 > 0 ? ` and ${wi.exemptions.age65} × $250` : ''}.</p>
      </Section>

      <Section title="Wisconsin withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Wisconsin" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Wisconsin tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2025 estimated payments" hint="Including your 2024 refund applied to 2025" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Additions and subtractions" intro="Taxable Social Security is not taxed in Wisconsin, and 30% of net long-term capital gains is excluded.">
        <div className="grid">
          <MoneyField label="State income tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="U.S. government interest" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Retirement benefits Wisconsin exempts" hint="Military, certain federal, state and local plans; the retirement income subtraction (67+) or the $5,000 subtraction (65+)" value={d.retirementSubtraction} onChange={(n) => put({ retirementSubtraction: n })} />
          <MoneyField label="Edvest, Tomorrow’s Scholar and ABLE contributions" hint="Up to the yearly limit per beneficiary" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <MoneyField label="Medical care insurance premiums" value={d.medicalInsurance} onChange={(n) => put({ medicalInsurance: n })} />
          <MoneyField label="Private school tuition" value={d.privateSchoolTuition} onChange={(n) => put({ privateSchoolTuition: n })} />
          <MoneyField label="Other subtractions (Schedule SB)" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Taxed in Wisconsin" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other additions (Schedule AD)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Schedule I adjustment" hint="Federal law Wisconsin has not adopted, such as bonus depreciation; negative if it lowers income" value={d.scheduleIAdjustment} onChange={(n) => put({ scheduleIAdjustment: n })} />
        </div>
        <table className="lines"><tbody>
          {SB.filter(([k]) => (wi.sb[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k}><th scope="row">{label}</th><td>{usd(wi.sb[k])}</td></tr>
          ))}
          <tr className="is-key"><th scope="row"><span className="line-no">6</span>Total subtractions</th><td>{usd(L['6'])}</td></tr>
        </tbody></table>
      </Section>

      <Section title="Credits" intro="The school property tax credit is 12% of property taxes on your home, or of the tax part of your rent, up to $300.">
        <div className="grid">
          <MoneyField label="Rent paid in 2025, heat included" value={d.rentHeatIncluded} onChange={(n) => put({ rentHeatIncluded: n })} />
          <MoneyField label="Rent paid in 2025, heat not included" value={d.rentHeatNotIncluded} onChange={(n) => put({ rentHeatNotIncluded: n })} />
          <MoneyField label="Property taxes paid on your home in 2025" value={d.propertyTaxes} onChange={(n) => put({ propertyTaxes: n })} />
          <MoneyField label="Additional child and dependent care credit" hint="Schedule WI-2441 line 14" value={d.additionalCareCredit} onChange={(n) => put({ additionalCareCredit: n })} />
          <MoneyField label="Schedule CR nonrefundable credits" value={d.nonrefundableCredits} onChange={(n) => put({ nonrefundableCredits: n })} />
          <MoneyField label="Net tax paid to another state (Schedule OS)" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          {d.otherStateCredit > 0 && <TextField label="Other state" placeholder="IL" autoComplete="off" value={d.otherStateCode} onChange={(s) => put({ otherStateCode: s.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() })} />}
          <MoneyField label="Homestead credit (Schedule H or H-EZ)" value={d.homesteadCredit} onChange={(n) => put({ homesteadCredit: n })} />
          <MoneyField label="Schedule CR refundable credits" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
          <MoneyField label="Use tax on untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['40'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <p className="why">
          {L['13'] > 0 ? `Itemized deduction credit: ${usd(L['13'])}. ` : ''}
          {L['18'] > 0 ? `Married couple credit: ${usd(L['18'])}. ` : ''}
          {L['30'] > 0 ? `Earned income credit: ${wi.eicPercent}% of the federal credit, ${usd(L['30'])}.` : ''}
        </p>
        <details className="more">
          <summary>Donations (Schedule 3)</summary>
          <div className="grid">
            {WI_DONATION_LINES.map((k) => (
              <MoneyField key={k} label={DONATIONS[k]} value={d.donations[k] ?? 0} onChange={(n) => put({ donations: { ...d.donations, [k]: n } })} />
            ))}
          </div>
        </details>
      </Section>

      {wi.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{wi.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 1" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Wisconsin forms" intro="Filled in on this device from the official Wisconsin Department of Revenue PDF.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Wisconsin forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3 and mail: with a payment to PO Box 268, Madison WI 53790-0001; refund or no payment to PO Box 59, Madison WI 53785-0001. Wisconsin e-file is free through WisTax. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
