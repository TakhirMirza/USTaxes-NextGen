/**
 * The Iowa part of the State step: Form IA 1040 with Schedule 1, IA 130, IA 148 and IA 4136 for full-year residents (flat 3.8%).
 */
import { ReactElement, useMemo, useState } from 'react'
import { emptyIaCredit148 } from '../engine/model.ts'
import type { IaCredit148, IaFuel, IaFuelRow, IaInput, IaOutOfState, IaRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeIowa } from '../engine/ia2025.ts'
import { buildIaPacket } from '../pdf/ia2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Choice, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['2', 'Federal taxable income'], ['3', 'Net Iowa modifications (Schedule 1)'], ['4', 'Iowa taxable income'], ['5', 'Iowa tax (3.8% or alternate tax)'],
  ['8', 'Exemption credits'], ['9', 'Tuition and textbook credit (K-12)'], ['10', 'Volunteer firefighter / EMS credit'], ['12', 'Balance'],
  ['15', 'Out-of-state tax credit'], ['17', 'Other nonrefundable credits'], ['18', 'Balance'], ['19', 'School district / EMS surtax'], ['21', 'Contributions'],
  ['22', 'Total state tax, local tax and contributions'], ['23', 'Fuel tax credit'], ['24', 'Child care or early childhood credit'], ['25', 'Iowa earned income tax credit (15%)'],
  ['26', 'Other refundable credits'], ['28', 'Iowa tax withheld'], ['29', 'Estimated payments'], ['30', 'Total credits and payments'],
  ['33', 'Applied to 2026 estimated tax'], ['32', 'Refund'], ['37', 'Total amount due']
]
const SCH: [line: string, label: string, col: 'A' | 'B' | 'S'][] = [
  ['1', 'Other states’ bond interest', 'A'], ['1', 'U.S. government interest', 'B'], ['4', 'Military retirement', 'B'], ['5', 'Social Security benefits', 'B'],
  ['6', 'Active duty military pay', 'B'], ['7', 'IRA / pension / railroad retirement', 'B'], ['11', 'Other income (addition)', 'A'], ['11', 'Other income (subtraction)', 'B'],
  ['14', 'Iowa 529 contributions', 'S'], ['15', 'Health insurance (65+)', 'S'], ['16', 'Capital gains deduction', 'S'], ['19', 'Other adjustments', 'S']
]
const ALWAYS = new Set(['2', '4', '5', '22', '30'])
const KEY = new Set(['22', '32', '37'])
const KINDS: [IaRetirementKind, string][] = [['standard', 'IRA, pension or annuity'], ['military', 'Military retirement'], ['railroad', 'Railroad retirement'], ['nonqualified', 'Nonqualified plan (not excluded)']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

const FUEL: [IaFuelRow, string][] = [
  ['gasoline', 'Gasoline'], ['e10', 'Ethanol blend E-10 to E-14'], ['e15a', 'E-15 or higher, Jan 1 – Jun 30'], ['e15b', 'E-15 or higher, Jul 1 – Dec 31'],
  ['diesel', 'Undyed diesel / biodiesel B-0 to B-19'], ['biodiesel', 'Undyed biodiesel B-20 or higher'], ['lpg', 'Special fuel (LPG)']
]
const OOS: [keyof IaOutOfState, string, string][] = [
  ['wages', 'Wages, salaries, tips', '1'], ['interest', 'Taxable interest', '2'], ['dividends', 'Ordinary dividends', '3'], ['alimony', 'Taxable alimony received', '4'],
  ['business', 'Business income or (loss)', '5'], ['capitalGain', 'Capital gain or (loss)', '6'], ['otherGains', 'Other gains or (losses)', '7'],
  ['rents', 'Rents, royalties, partnerships, estates', '8'], ['farm', 'Farm income or (loss)', '9'], ['unemployment', 'Unemployment compensation', '10'],
  ['gambling', 'Gambling winnings', '11'], ['other', 'Other income, bonus depreciation and §179 adjustment', '12']
]

export function IowaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ia
  const ia = useMemo(() => computeIowa(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<IaInput>): void => set((r) => ({ ...r, ia: { ...r.ia, ...p } }))
  const putOos = (p: Partial<IaOutOfState>): void => put({ oos: { ...d.oos, ...p } })
  const putFuel = (p: Partial<IaFuel>): void => put({ fuel: { ...d.fuel, ...p } })
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildIaPacket(ret, result, ia, preparer)
  const L = ia.lines
  const owes = L['37'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const young = ret.dependents.filter((x) => x.age >= 3 && x.age <= 5)
  const school = ret.dependents.filter((x) => x.age >= 4 && x.age <= 19)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadIowaForms }) => downloadIowaForms(ret, result, ia, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const sch = SCH.map(([k, label, col]) => [k, label, col === 'S' ? ia.schedule1.lines[k] ?? 0 : ia.schedule1[col][k] ?? 0, col] as const).filter((x) => x[2] !== 0)
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Iowa: you owe' : 'Iowa refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['37'] : L['32'])}</p>
        </div>
        <dl>
          <div><dt>Iowa taxable income</dt><dd>{usd(L['4'])}</dd></div>
          <div><dt>State and local tax</dt><dd>{usd(L['20'])}</dd></div>
          <div><dt>Net income</dt><dd>{usd(ia.netIncome)}</dd></div>
        </dl>
      </div>

      <Section title="Iowa return" intro={`Iowa starts from federal taxable income, subtracts Social Security and (from age 55) retirement income, and taxes the rest at a flat 3.8%. With net income of ${usd(ia.threshold)} or less you owe no Iowa tax.`}>
        <div className="grid">
          {owners.map((o) => (
            <TextField key={`b-${o}`} label={`${names[o]}: date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: s } })} />
          ))}
          <TextField label="County number" hint="Two digits, residence on 12/31/2025 (table 41-027)" autoComplete="off" value={d.countyNo} onChange={(s) => put({ countyNo: s })} />
          <TextField label="School district number" hint="Four digits, from table 41-027 or tax-mapper.iowa.gov" autoComplete="off" value={d.schoolDistrictNo} onChange={(s) => put({ schoolDistrictNo: s })} />
          <NumberField label="School district / EMS surtax rate" hint="From table 41-027 for your district" suffix="%" max={20} decimal value={d.surtaxRate} onChange={(n) => put({ surtaxRate: n })} />
          {owners.map((o) => (
            <TextField key={`l-${o}`} label={`${names[o]}: driver’s license or state ID number`} hint="Optional" autoComplete="off" value={d.license[o]} onChange={(s) => put({ license: { ...d.license, [o]: s } })} />
          ))}
        </div>
      </Section>

      <Section title="Iowa withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Iowa" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Iowa tax withheld on 1099s" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="2025 estimated and other payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          {L['31a'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement income (Schedule 1 lines 4 and 7)" intro="IRA, pension and annuity income is excluded for anyone 55 or older or disabled; military and railroad retirement are excluded at any age.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`ia-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`ia-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as IaRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
          {owners.map((o) => (
            <label key={o} className="check"><input type="checkbox" checked={d.disabled[o]} onChange={(e) => put({ disabled: { ...d.disabled, [o]: e.target.checked } })} /> {names[o]} is disabled</label>
          ))}
        </Section>
      )}

      <Section title="Modifications (Schedule 1)">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Line 1, column B" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Line 1, column A" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Active duty military pay" hint="Line 6" value={d.activeDutyPay} onChange={(n) => put({ activeDutyPay: n })} />
          <MoneyField label="Iowa 529 contributions" hint="Line 14; up to $5,800 per beneficiary" value={d.iowa529} onChange={(n) => put({ iowa529: n })} />
          <MoneyField label="Health insurance premiums (65 or older)" hint="Line 15; post-tax premiums not deducted federally" value={d.healthInsurance} onChange={(n) => put({ healthInsurance: n })} />
          <MoneyField label="Iowa capital gains deduction" hint="Line 16, from IA 100" value={d.capitalGainsDeduction} onChange={(n) => put({ capitalGainsDeduction: n })} />
          <TextField label="Other income addition: code" hint="Line 11, column A" autoComplete="off" value={d.otherAddition.code} onChange={(s) => put({ otherAddition: { ...d.otherAddition, code: s.slice(0, 3) } })} />
          <MoneyField label="Other income addition: amount" value={d.otherAddition.amount} onChange={(n) => put({ otherAddition: { ...d.otherAddition, amount: n } })} />
          <TextField label="Other income subtraction: code" hint="Line 11, column B" autoComplete="off" value={d.otherSubtraction.code} onChange={(s) => put({ otherSubtraction: { ...d.otherSubtraction, code: s.slice(0, 3) } })} />
          <MoneyField label="Other income subtraction: amount" value={d.otherSubtraction.amount} onChange={(n) => put({ otherSubtraction: { ...d.otherSubtraction, amount: n } })} />
          <TextField label="Other adjustment: code" hint="Line 19" autoComplete="off" value={d.otherAdjustment.code} onChange={(s) => put({ otherAdjustment: { ...d.otherAdjustment, code: s.slice(0, 3) } })} />
          <MoneyField label="Other adjustment: amount" value={d.otherAdjustment.amount} onChange={(n) => put({ otherAdjustment: { ...d.otherAdjustment, amount: n } })} />
        </div>
        {sch.length > 0 && (
          <table className="lines"><tbody>
            {sch.map(([k, label, n, col]) => <tr key={`${k}${col}`}><th scope="row"><span className="line-no">{k}{col === 'S' ? '' : col}</span>{label}</th><td>{usd(n)}</td></tr>)}
          </tbody></table>
        )}
      </Section>

      <Section title="Credits and contributions">
        <div className="grid">
          {school.map((x) => (
            <MoneyField key={`t-${x.id}`} label={`${x.name.trim() || 'Dependent'}: K-12 tuition and textbooks`} hint="Line 9; 25% of up to $2,000" value={d.tuition[x.id] ?? 0} onChange={(n) => put({ tuition: { ...d.tuition, [x.id]: n } })} />
          ))}
          {young.map((x) => (
            <MoneyField key={`e-${x.id}`} label={`${x.name.trim() || 'Dependent'}: preschool and early childhood expenses`} hint="Line 24 ECDC; 25% of up to $1,000" value={d.earlyChildhood[x.id] ?? 0} onChange={(n) => put({ earlyChildhood: { ...d.earlyChildhood, [x.id]: n } })} />
          ))}
          <MoneyField label="Volunteer firefighter / EMS / reserve peace officer credit" hint="Line 10" value={d.volunteerCredit} onChange={(n) => put({ volunteerCredit: n })} />
          <MoneyField label="Fish and wildlife contribution" hint="Line 21" value={d.fishWildlife} onChange={(n) => put({ fishWildlife: n })} />
          <MoneyField label="Child abuse prevention contribution" hint="Line 21" value={d.childAbuse} onChange={(n) => put({ childAbuse: n })} />
        </div>
        <details open={ia.oos !== null}>
          <summary>Out-of-state tax credit (IA 130){ia.oos ? ` — ${usd(L['15'])}` : ''}</summary>
          <p className="why">For income that another state or jurisdiction also taxed. Enter each kind of that income as it is included on your Iowa return, and the tax that state imposed on it (from its return, not the amount withheld). One state; for more, complete another IA 130 by hand.</p>
          <div className="grid">
            <TextField label="State or jurisdiction" autoComplete="off" value={d.oos.state} onChange={(s) => putOos({ state: s })} />
            {OOS.map(([k, label, line]) => <MoneyField key={k} label={label} hint={`Line ${line}`} allowNegative={['business', 'capitalGain', 'otherGains', 'rents', 'farm', 'other'].includes(k)} value={d.oos[k] as number} onChange={(n) => putOos({ [k]: n })} />)}
            <MoneyField label="Tax imposed by that state and paid by you" hint="Line 20" value={d.oos.taxPaid} onChange={(n) => putOos({ taxPaid: n })} />
            <MoneyField label="Tax paid there by a pass-through entity or mutual fund" hint="Line 21" value={d.oos.passThroughTax} onChange={(n) => putOos({ passThroughTax: n })} />
          </div>
          {ia.oos && <p className="why">{ia.oos['17'].toFixed(4)}% of your Iowa income was taxed there, so the credit is the smaller of {usd(ia.oos['19'])} and {usd(ia.oos['22'])}: {usd(ia.oos['23'])}.</p>}
        </details>
        <details open={d.credits148.length > 0}>
          <summary>Business and other tax credits (IA 148){L['17'] + L['26'] > 0 ? ` — ${usd(L['17'] + L['26'])}` : ''}</summary>
          <p className="why">Use the two-digit tax credit code from the IA 148 instructions and the certificate number when one was issued. Nonrefundable credits (Part I) are applied in order up to your tax; refundable credits (Part II) are paid even with no tax.</p>
          {d.credits148.map((c, i) => {
            const set1 = (p: Partial<IaCredit148>): void => put({ credits148: d.credits148.map((y, j) => (j === i ? { ...y, ...p } : y)) })
            const row = c.refundable || !c.code.trim() ? null : ia.part1[d.credits148.slice(0, i).filter((y) => !y.refundable && y.code.trim()).length]
            return (
              <fieldset key={i} className="statement">
                <legend>{c.refundable ? 'Refundable' : 'Nonrefundable'} credit{c.code.trim() ? ` ${c.code.trim()}` : ''}</legend>
                <div className="grid">
                  <Choice legend="Kind" value={c.refundable ? 'r' : 'n'} onChange={(k) => set1({ refundable: k === 'r' })} options={[{ value: 'n', label: 'Nonrefundable (Part I)' }, { value: 'r', label: 'Refundable (Part II)' }]} />
                  <TextField label="Tax credit code" autoComplete="off" value={c.code} onChange={(s) => set1({ code: s.replace(/\D/g, '').slice(0, 2) })} />
                  <TextField label="Certificate number" hint="If one was issued" autoComplete="off" value={c.certificate} onChange={(s) => set1({ certificate: s })} />
                  {!c.refundable && <MoneyField label="Carried forward from prior years" hint="Column C" value={c.carryforward} onChange={(n) => set1({ carryforward: n })} />}
                  <MoneyField label="This year’s amount" hint={c.refundable ? 'Column K' : 'Column D; earned or from a pass-through entity'} value={c.current} onChange={(n) => set1({ current: n })} />
                  {!c.refundable && <MoneyField label="Expired amount" hint="Column G" value={c.expired} onChange={(n) => set1({ expired: n })} />}
                  <TextField label="Pass-through entity name" hint="Part IV; leave blank if earned yourself" autoComplete="off" value={c.entityName} onChange={(s) => set1({ entityName: s })} />
                  {c.entityName.trim() && <TextField label="Pass-through entity FEIN" autoComplete="off" value={c.entityFein} onChange={(s) => set1({ entityFein: s.replace(/[^\d-]/g, '').slice(0, 10) })} />}
                  {c.entityName.trim() && <TextField label="Disregarded entity’s FEIN" hint="Only if reported through one" autoComplete="off" value={c.disregardedFein} onChange={(s) => set1({ disregardedFein: s.replace(/[^\d-]/g, '').slice(0, 10) })} />}
                </div>
                {row && <p className="why">Applied this year: {usd(row.F)}; carried forward: {usd(row.H)}.</p>}
                <div className="actions"><button type="button" className="button" onClick={() => put({ credits148: d.credits148.filter((_, j) => j !== i) })}>Remove this credit</button></div>
              </fieldset>
            )
          })}
          <div className="actions"><button type="button" className="button" onClick={() => put({ credits148: [...d.credits148, emptyIaCredit148()] })}>Add an IA 148 credit</button></div>
        </details>
        <details open={ia.fuel.line9 > 0}>
          <summary>Fuel tax credit (IA 4136){ia.fuel.line9 > 0 ? ` — ${usd(ia.fuel.line9)}` : ''}</summary>
          <p className="why">For Iowa fuel tax paid on fuel used off the highway (farming, commercial or commercial fishing). Claimed gallons are invoice gallons minus highway gallons. Unless the use is sales-tax exempt (farming or processing), 6% sales tax on the fuel’s cost before Iowa fuel tax is subtracted.</p>
          <div className="checks">
            <label className="check"><input type="checkbox" checked={d.fuel.farming} onChange={(e) => putFuel({ farming: e.target.checked })} /> Farming</label>
            <label className="check"><input type="checkbox" checked={d.fuel.commercial} onChange={(e) => putFuel({ commercial: e.target.checked })} /> Commercial</label>
            <label className="check"><input type="checkbox" checked={d.fuel.fishing} onChange={(e) => putFuel({ fishing: e.target.checked })} /> Commercial fishing</label>
            <label className="check"><input type="checkbox" checked={d.fuel.other} onChange={(e) => putFuel({ other: e.target.checked })} /> Other</label>
            <label className="check"><input type="checkbox" checked={d.fuel.salesTaxExempt} onChange={(e) => putFuel({ salesTaxExempt: e.target.checked })} /> Sales-tax exempt use (farming or processing)</label>
          </div>
          <div className="grid">
            {d.fuel.other && <TextField label="Other use" autoComplete="off" value={d.fuel.otherText} onChange={(s) => putFuel({ otherText: s })} />}
            {FUEL.flatMap(([k, label]) => {
              const x = d.fuel.rows[k] ?? { invoice: 0, highway: 0, price: 0 }
              const setRow = (p: Partial<typeof x>): void => putFuel({ rows: { ...d.fuel.rows, [k]: { ...x, ...p } } })
              return [
                <NumberField key={`${k}-i`} label={`${label}: invoice gallons`} max={10000000} value={x.invoice} onChange={(n) => setRow({ invoice: n })} />,
                ...(x.invoice > 0 ? [
                  <NumberField key={`${k}-h`} label={`${label}: highway gallons`} max={10000000} value={x.highway} onChange={(n) => setRow({ highway: n })} />,
                  ...(d.fuel.salesTaxExempt ? [] : [<NumberField key={`${k}-p`} label={`${label}: average cost per gallon`} hint="Dollars, e.g. 3.159" decimal max={100} value={x.price} onChange={(n) => setRow({ price: n })} />])
                ] : [])
              ]
            })}
            <MoneyField label="Pass-through fuel tax credit received" hint="Line 8" value={d.fuel.passThrough} onChange={(n) => putFuel({ passThrough: n })} />
            {d.fuel.passThrough > 0 && <TextField label="Pass-through entity name" autoComplete="off" value={d.fuel.entityName} onChange={(s) => putFuel({ entityName: s })} />}
            {d.fuel.passThrough > 0 && <TextField label="Pass-through entity FEIN" autoComplete="off" value={d.fuel.entityFein} onChange={(s) => putFuel({ entityFein: s.replace(/[^\d-]/g, '').slice(0, 10) })} />}
          </div>
        </details>
        {ia.careCredit && <p className="why">Line 24 uses the {ia.careCredit === 'care' ? 'child and dependent care credit (a percentage of your federal credit)' : 'early childhood development credit'}, the larger of the two.</p>}
      </Section>

      {ia.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ia.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form IA 1040" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Iowa forms" intro="Filled in on this device from the official Iowa Department of Revenue fillable IA 1040.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Iowa forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 6. Mail to Iowa Income Tax Document Processing, PO Box 9187, Des Moines IA 50306-9187 (checks to the Iowa Department of Revenue). Due April 30, 2026.</p>
      </Section>
    </div>
  )
}
