/**
 * The Kansas part of the State step: Form K-40 with Schedule S for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { KsInput, Owner, Person } from '../engine/model.ts'
import { computeKansas } from '../engine/ks2025.ts'
import { buildKsPacket } from '../pdf/ks2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { OtherStatesList } from './otherstates'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Modifications (Schedule S)'], ['3', 'Kansas adjusted gross income'], ['4', 'Standard or itemized deduction'],
  ['5', 'Exemption allowance'], ['7', 'Taxable income'], ['8', 'Tax (5.2% / 5.58%)'], ['13', 'Credit for taxes paid to other states'],
  ['14', 'Child and dependent care credit (50% of federal)'], ['15', 'Other credits'], ['17', 'Earned income credit (nonrefundable part)'], ['18', 'Total tax balance'],
  ['19', 'Kansas tax withheld'], ['20', 'Estimated tax paid'], ['21', 'Paid with extension'], ['22', 'Refundable earned income credit'], ['27', 'Total refundable credits and payments'],
  ['28', 'Underpayment'], ['34', 'Credit forward'], ['32', 'Amount you owe'], ['43', 'Refund']
]
const S_LINES: [line: string, label: string][] = [
  ['A1', 'Other states’ bond interest'], ['A2', 'KPERS contributions'], ['A8', 'Other additions'], ['A10', 'Social Security benefits'], ['A12', 'U.S. government interest'],
  ['A13', 'State or local income tax refund'], ['A14', 'Exempt retirement benefits'], ['A16', '529 contributions'], ['A21', 'ABLE contributions'], ['A25', 'Other subtractions']
]
const GIFTS: [line: string, label: string][] = [
  ['35', 'Chickadee Checkoff (nongame wildlife)'], ['36', 'Senior Citizens Meals on Wheels'], ['37', 'Breast Cancer Research Fund'], ['38', 'Military Emergency Relief Fund'],
  ['39', 'Kansas Hometown Heroes Fund'], ['40', 'Kansas Creative Arts Industry Fund'], ['41', 'Local school district'], ['42', 'Kansas historic site']
]
const ALWAYS = new Set(['1', '3', '7', '8', '18', '27'])
const KEY = new Set(['18', '32', '43'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function KansasStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ks
  const ks = useMemo(() => computeKansas(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<KsInput>): void => set((r) => ({ ...r, ks: { ...r.ks, ...p } }))
  const putA = (p: Partial<KsInput['schA']>): void => put({ schA: { ...d.schA, ...p } })
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildKsPacket(ret, result, ks, preparer)
  const L = ks.lines
  const owes = L['32'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadKansasForms }) => downloadKansasForms(ret, result, ks, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const sRows = S_LINES.filter(([k]) => (ks.scheduleS[k] ?? 0) !== 0)
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Kansas: you owe' : 'Kansas refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['32'] : L['43'])}</p>
        </div>
        <dl>
          <div><dt>Kansas taxable income</dt><dd>{usd(L['7'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['8'])}</dd></div>
          <div><dt>Exemptions</dt><dd>{usd(L['5'])}</dd></div>
        </dl>
      </div>

      <Section title="Kansas return" intro="Kansas starts from federal adjusted gross income, exempts Social Security, and taxes income at 5.2% up to $23,000 ($46,000 joint) and 5.58% above, after a standard deduction and exemptions of $9,160 ($18,320 joint) plus $2,320 per dependent.">
        <div className="grid">
          <TextField label="School district number" hint="Three digits, where you lived on Dec. 31 (see the booklet)" autoComplete="off" value={d.schoolDistrict} onChange={(s) => put({ schoolDistrict: s })} />
          <TextField label="County abbreviation" hint="Two letters, from the booklet" autoComplete="off" value={d.county} onChange={(s) => put({ county: s.toUpperCase().slice(0, 2) })} />
          <NumberField label="Disabled veterans claimed (including yourself)" hint="$2,320 each" max={4} value={d.disabledVeterans} onChange={(n) => put({ disabledVeterans: n })} />
        </div>
      </Section>

      <Section title="Kansas withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Kansas" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Kansas tax withheld on 1099s" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="2025 estimated tax paid" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
          {L['33'] > 0 && <MoneyField label="Credit forward to 2026" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Exempt retirement (Schedule S line A14)" intro="KPERS, federal civil service, military and railroad retirement are not taxed in Kansas. Other pensions and IRA distributions are.">
          {r1099.map((x) => (
            <label key={x.id} className="check"><input type="checkbox" checked={!!d.exemptRetirement[x.id]} onChange={(e) => put({ exemptRetirement: { ...d.exemptRetirement, [x.id]: e.target.checked } })} /> {x.payer.trim() || '1099-R'} ({names[x.owner]}, {usd(x.taxableAmount)}) is KPERS, federal, military or railroad retirement</label>
          ))}
        </Section>
      )}

      <Section title="Modifications (Schedule S) and credits">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="A12" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="A1" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="KPERS contributions" hint="A2; from W-2 box 14" value={d.kpersContributions} onChange={(n) => put({ kpersContributions: n })} />
          <MoneyField label="State income tax refund in federal AGI" hint="A13" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="529 plan contributions" hint="A16; up to $3,000 per beneficiary ($6,000 joint)" value={d.qtp529} onChange={(n) => put({ qtp529: n })} />
          <MoneyField label="ABLE account contributions" hint="A21" value={d.able} onChange={(n) => put({ able: n })} />
          <MoneyField label="Other additions" hint="A8; enclose a list" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Other subtractions" hint="A25; enclose a list" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          {d.otherStateCredit > 0 && d.otherStates.length === 0 && <MoneyField label="Credit for taxes paid to other states (amount you figured)" hint="Line 13; or use the worksheet below" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />}
          <MoneyField label="Other credits" hint="Line 15; enclose the credit schedules" value={d.otherCredits} onChange={(n) => put({ otherCredits: n })} />
        </div>
        {sRows.length > 0 && (
          <table className="lines"><tbody>
            {sRows.map(([k, label]) => <tr key={k}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(ks.scheduleS[k])}</td></tr>)}
          </tbody></table>
        )}
      </Section>

      <Section title="Credit for taxes paid to other states (line 13)" intro="Worksheet for Residents, one per state: the income tax you actually owed to that state and its localities (from that state’s return, not the amount withheld) and the income from that state included in your Kansas AGI. The credit is the smaller of that tax and the Kansas tax times that income’s share of KAGI. Enclose the other state’s return.">
        <OtherStatesList rows={d.otherStates} max={10} empty={() => ({ state: '', tax: 0, income: 0 })} onChange={(rows) => put({ otherStates: rows, ...(rows.length ? { otherStateCredit: 0 } : {}) })}
          fields={[['tax', '2025 income tax paid to that state', 'Line 1; including its cities and counties'], ['income', 'Income from that state included in KAGI', 'Line 3']]} />
        <details>
          <summary>Tax paid to a foreign country</summary>
          <p className="why">Kansas allows only the part of the foreign tax that the federal foreign tax credit did not cover. No credit if you deducted the foreign tax on federal Schedule A.</p>
          <div className="grid">
            <TextField label="Country" autoComplete="off" value={d.foreign.country} onChange={(s) => put({ foreign: { ...d.foreign, country: s } })} />
            <MoneyField label="2025 tax paid to the foreign country" value={d.foreign.taxPaid} onChange={(n) => put({ foreign: { ...d.foreign, taxPaid: n } })} />
            <MoneyField label="Federal foreign tax credit allowed" hint="Schedule 3 line 1" value={d.foreign.federalCredit} onChange={(n) => put({ foreign: { ...d.foreign, federalCredit: n } })} />
            <MoneyField label="Foreign income included in KAGI" value={d.foreign.income} onChange={(n) => put({ foreign: { ...d.foreign, income: n } })} />
          </div>
        </details>
        {ks.otherStates.length > 0 && (
          <table className="lines"><tbody>
            {ks.otherStates.map((o) => <tr key={o.name}><th scope="row">{o.name}: lesser of {usd(o.l1)} and {usd(o.l2)} × {o.l5.toFixed(4)}% = {usd(o.l6)}</th><td>{usd(o.l7)}</td></tr>)}
            <tr><th scope="row"><span className="line-no">13</span>Credit for taxes paid to other states</th><td>{usd(ks.lines['13'])}</td></tr>
          </tbody></table>
        )}
      </Section>

      <Section title="Itemized deductions (Kansas Schedule A)" intro={`Kansas lets you itemize whether or not you itemized federally. Medical expenses (over 7.5% of federal AGI), real estate and personal property taxes, Form 1098 mortgage interest and gifts come from your federal entries; Kansas income tax and sales tax are not deductible. Schedule A total: ${usd(ks.itemized)}${ks.itemize ? ' — used on line 4.' : ` — the standard deduction (${usd(ks.standard)}) is larger.`}`}>
        <div className="grid">
          <MoneyField label="Mortgage interest not on a Form 1098" hint="Line 8b" value={d.schA.individualMortgage} onChange={(n) => putA({ individualMortgage: n })} />
          {d.schA.individualMortgage > 0 && <TextField label="Paid to: name, identifying number and address" autoComplete="off" value={d.schA.individualInfo} onChange={(s) => putA({ individualInfo: s })} />}
          <MoneyField label="Points not on a Form 1098" hint="Line 8c" value={d.schA.points} onChange={(n) => putA({ points: n })} />
          <MoneyField label="Charitable contribution carryover from a prior year" hint="Line 12" value={d.schA.carryover} onChange={(n) => putA({ carryover: n })} />
        </div>
        <Check label="Not all of my home mortgage loans were used to buy, build or improve my home" hint="Line 8 box; the interest may be limited" checked={d.schA.mixedUseMortgage} onChange={(on) => putA({ mixedUseMortgage: on })} />
      </Section>

      <Section title="Contributions" intro="Lines 35–42. They reduce your refund or add to what you owe.">
        <div className="grid">
          {GIFTS.map(([k, label]) => <MoneyField key={k} label={label} hint={`Line ${k}`} value={d.contributions[k] ?? 0} onChange={(n) => put({ contributions: { ...d.contributions, [k]: n } })} />)}
        </div>
      </Section>

      {ks.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ks.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form K-40" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Kansas forms" intro="Filled in on this device from the official Kansas Department of Revenue K-40 and Schedule S.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Kansas forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2. Mail to Kansas Income Tax, Kansas Dept. of Revenue, PO Box 750260, Topeka KS 66699-0260. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
