/**
 * The North Dakota part of the State step: Form ND-1 for full-year residents, with Schedules ND-1SA, ND-1CR and ND-1TC.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { NdInput, Owner, Person } from '../engine/model.ts'
import { computeNorthDakota } from '../engine/nd2025.ts'
import { buildNdPacket } from '../pdf/nd2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, Choice, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1a', 'Federal adjusted gross income'], ['1b', 'Federal taxable income'], ['4a', 'Additions'], ['5', 'U.S. obligation interest'], ['6', 'Net long-term capital gain exclusion (40%)'],
  ['7', 'Native American exempt income'], ['8', 'Railroad Retirement Board benefits'], ['9', 'Peace officer retirement exclusion'], ['11', 'Military pay exclusion'],
  ['12', 'College SAVE deduction'], ['13', 'Qualified dividend exclusion (40%)'], ['14', 'Military retirement exclusion'], ['15', 'Social Security exclusion'],
  ['16', 'Other subtractions (ND-1SA)'], ['3', 'Other additions (ND-1SA)'], ['17', 'Total subtractions'], ['18', 'North Dakota taxable income'], ['20', 'Tax'], ['21', 'Credit for tax paid to another state'],
  ['22', 'Marriage penalty credit'], ['23', 'Other credits (ND-1TC)'], ['25', 'Net tax liability'], ['26', 'North Dakota tax withheld'], ['27', 'Estimated payments'],
  ['28', 'Total payments'], ['30', 'Applied to 2026'], ['31', 'Contributions'], ['32', 'Refund'], ['35', 'Contributions'], ['36', 'Balance due']
]
const ALWAYS = new Set(['1a', '1b', '18', '20', '25', '28'])
const KEY = new Set(['25', '32', '36'])
const SOURCES: [string, string][] = [
  ['1', 'Farming, ranching, agricultural production'], ['2', 'Retail, wholesale, eating and drinking places'], ['3', 'Federal, state, county or city government'],
  ['4', 'Public or private education'], ['5', 'Professional and personal services'], ['6', 'Construction'], ['7', 'Manufacturing'],
  ['8', 'Transportation, communication, utilities'], ['9', 'Coal, oil and natural gas'], ['10', 'Banking, insurance, real estate, finance'], ['11', 'Military service'],
  ['12', 'Retirement (pensions, annuities, IRAs)']
]
/** Schedule ND-1TC: [line, label, kind] — money lines add to line 26; info lines are counts, wages or a date. */
const TC: [string, string, 'money' | 'info'][] = [
  ['1', 'Family member care (Schedule ND-1FC)', 'money'], ['2', 'Renaissance zone (Schedule RZ)', 'money'],
  ['3', 'Agricultural commodity processing facility investment', 'money'], ['4', 'Seed capital investment', 'money'],
  ['5', 'Planned gift (Schedule ND-1PG)', 'money'], ['6', 'Biodiesel or green diesel fuel blending', 'money'],
  ['7', 'Biodiesel or green diesel fuel sales equipment', 'money'], ['8a', 'Employer internship program', 'money'],
  ['8b', 'Number of eligible interns employed in 2025', 'info'], ['8c', 'Compensation paid to those interns', 'info'],
  ['9a', 'Research expense', 'money'], ['9b', 'Research expense credit bought from another taxpayer', 'money'],
  ['10', 'Employer child care contribution (Schedule ECC)', 'money'], ['11a', 'Workforce recruitment', 'money'],
  ['11b', 'Eligible employees whose 12th month ended in 2024', 'info'], ['11c', 'Their compensation for the first 12 months', 'info'],
  ['12a', 'Geothermal device installation date (mm/dd/yyyy)', 'info'], ['12b', 'Geothermal energy device unused carryover', 'money'],
  ['13', 'Wages paid to a mobilized employee (Schedule ME)', 'money'], ['14', 'Partnership plan long-term care insurance', 'money'],
  ['15a', 'Endowment fund, from Schedule ND-1QEC line 8', 'money'], ['15b', 'Endowment fund, from ND Schedule K-1', 'money'],
  ['15c', 'Contribution amount from ND Schedule K-1', 'info'], ['16', 'Housing incentive fund carryover', 'money'],
  ['17a', 'Automation', 'money'], ['17b', 'Automation carryover', 'money'],
  ['18', 'Nonprofit private primary school (ND-1PSC)', 'money'], ['19', 'Nonprofit private high school (ND-1PSC)', 'money'],
  ['20', 'Nonprofit private college (ND-1PSC)', 'money'], ['21', 'Angel investor investment (angel funds certified after June 30, 2017)', 'money'],
  ['22', 'Developmentally disabled or mentally ill employee', 'money'], ['23', 'Adoption (Schedule ND-1AC)', 'money'],
  ['24', 'Maternity home, child placing agency or pregnancy help center (Schedule MCP)', 'money'], ['25a', 'Apprentice', 'money'],
  ['25b', 'Number of eligible apprentices employed in 2025', 'info'], ['25c', 'Compensation paid to those apprentices', 'info']
]
const FUNDS: [string, string][] = [['veterans', 'Veterans’ Postwar Trust Fund'], ['wildlife', 'Watchable Wildlife Fund'], ['trees', 'Trees for ND Trust Fund']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function NorthDakotaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.nd
  const nd = useMemo(() => computeNorthDakota(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<NdInput>): void => set((r) => ({ ...r, nd: { ...r.nd, ...p } }))
  const putSa = (p: Partial<NdInput['sa']>): void => put({ sa: { ...d.sa, ...p } })
  const putCr = (p: Partial<NdInput['cr']>): void => put({ cr: { ...d.cr, ...p } })
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildNdPacket(ret, result, nd, preparer)
  const L = nd.lines
  const owes = L['36'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadNorthDakotaForms }) => downloadNorthDakotaForms(ret, result, nd, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'North Dakota: you owe' : 'North Dakota refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['36'] : L['32'])}</p>
        </div>
        <dl>
          <div><dt>North Dakota taxable income</dt><dd>{usd(L['18'])}</dd></div>
          <div><dt>Tax</dt><dd>{usd(L['20'])}</dd></div>
          <div><dt>Net tax liability</dt><dd>{usd(L['25'])}</dd></div>
        </dl>
      </div>

      <Section title="North Dakota return" intro="North Dakota starts from your federal taxable income. Income up to $48,475 ($80,975 joint, $64,950 head of household) is taxed at 0%, then 1.95%, and 2.5% at the top.">
        <div className="grid">
          <TextField label="School district code" hint="5 digits; list on page 19 of the instructions" autoComplete="off" value={d.schoolCode} onChange={(s) => put({ schoolCode: s.replace(/\D/g, '').slice(0, 5) })} />
        </div>
        <Choice legend="Income source code (where most of your North Dakota income came from)" value={d.incomeSourceCode} onChange={(incomeSourceCode) => put({ incomeSourceCode })} columns={2}
          options={SOURCES.map(([v, label]) => ({ value: v, label: `${v}. ${label}` }))} />
      </Section>

      <Section title="North Dakota withholding and payments" intro="From the state section of each W-2 (boxes 15–17) and 1099-R (boxes 14–16).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="North Dakota" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        {r1099.length > 0 && <StatementRows kind="1099r" state="North Dakota" items={r1099.map((x) => ({ id: x.id, title: `${x.payer.trim() || '1099-R'} (${names[x.owner]})`, federal: x.taxableAmount }))} value={d.r1099} onChange={(r) => put({ r1099: r })} />}
        <div className="grid">
          <MoneyField label="North Dakota tax withheld on other 1099s and ND Schedules K-1" hint="Line 26" value={d.otherWithholding} onChange={(n) => put({ otherWithholding: n })} />
          <MoneyField label="2025 estimated and extension payments" hint="Line 27, with any 2024 overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          {L['29'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 30" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          <Check label="Get Form 1099-G electronically instead of by mail" checked={d.consent1099g} onChange={(v) => put({ consent1099g: v })} />
        </div>
      </Section>

      <Section title="Additions and subtractions" intro="40% of your net long-term capital gain and of your qualified dividends, and your taxable Social Security, are subtracted automatically.">
        <div className="grid">
          <MoneyField label="Planned gift or endowment credit adjustment" hint="Line 2; from Schedule ND-1PG or ND-1QEC" value={d.plannedGift} onChange={(n) => put({ plannedGift: n })} />
          <MoneyField label="Interest on U.S. obligations" hint="Line 5" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Long-term gain already in lines 7 or 16" hint="Capital gain worksheet line 6" value={d.gainInOtherLines} onChange={(n) => put({ gainInOtherLines: n })} />
          <MoneyField label="Exempt income of an enrolled tribal member living on a reservation" hint="Line 7" value={d.nativeAmerican} onChange={(n) => put({ nativeAmerican: n })} />
          {owners.map((o) => (
            <MoneyField key={o} label={`${names[o]}: taxable Railroad Retirement Board benefits`} hint="Line 8" value={d.railroad[o]} onChange={(n) => put({ railroad: { ...d.railroad, [o]: n } })} />
          ))}
          <MoneyField label="Part of taxable Social Security that is Tier 1 RRB" hint="Moved from line 15 to line 8" value={d.rrbTier1InSs} onChange={(n) => put({ rrbTier1InSs: n })} />
          <MoneyField label="Licensed peace officer retirement benefits" hint="Line 9; 20 years or retired disabled" value={d.peaceOfficer} onChange={(n) => put({ peaceOfficer: n })} />
          <MoneyField label="Military pay (active, reserve, National Guard)" hint="Line 11" value={d.militaryPay} onChange={(n) => put({ militaryPay: n })} />
          <MoneyField label="North Dakota College SAVE contributions" hint="Line 12; up to $5,000 ($10,000 joint)" value={d.collegeSave} onChange={(n) => put({ collegeSave: n })} />
          <MoneyField label="Military retirement benefits" hint="Line 14" value={d.militaryRetirement} onChange={(n) => put({ militaryRetirement: n })} />
        </div>
        <details>
          <summary>Schedule ND-1SA adjustments</summary>
          <div className="grid">
            <MoneyField label="Lump-sum distribution (Form 4972 lines 6 + 10)" hint="ND-1SA line 1" value={d.sa.lumpSum} onChange={(n) => putSa({ lumpSum: n })} />
            <MoneyField label="Loss from an S corporation taxed as a C corporation" hint="Line 2" value={d.sa.sCorpLoss} onChange={(n) => putSa({ sCorpLoss: n })} />
            <MoneyField label="Renaissance zone income exemption" hint="Line 4; Schedule RZ" value={d.sa.renaissance} onChange={(n) => putSa({ renaissance: n })} />
            <MoneyField label="New or expanding business income exemption" hint="Line 5" value={d.sa.newBusiness} onChange={(n) => putSa({ newBusiness: n })} />
            <MoneyField label="Organ donor expenses" hint="Line 6; up to $10,000" value={d.sa.organDonor} onChange={(n) => putSa({ organDonor: n })} />
            <MoneyField label="Employee workforce recruitment payments" hint="Line 7; employer statement" value={d.sa.workforce} onChange={(n) => putSa({ workforce: n })} />
            <NumberField label="Stillborn children in 2025" hint="Line 8a; $5,241 each" max={10} value={d.sa.stillborn} onChange={(n) => putSa({ stillborn: n })} />
            {d.sa.stillborn > 0 && <>
              <TextField label="Fetal death certificate number" hint="Line 8b; 11 digits" autoComplete="off" value={d.sa.stillbornCertificate} onChange={(s) => putSa({ stillbornCertificate: s })} />
              <TextField label="Date of death" hint="Line 8c" placeholder="mm/dd/yyyy" autoComplete="off" value={d.sa.stillbornDate} onChange={(s) => putSa({ stillbornDate: s })} />
            </>}
            <MoneyField label="Employer college expense reimbursement in W-2 wages" hint="Line 9" value={d.sa.collegeReimbursement} onChange={(n) => putSa({ collegeReimbursement: n })} />
            <MoneyField label="Income from an S corporation taxed as a C corporation" hint="Line 10" value={d.sa.sCorpIncome} onChange={(n) => putSa({ sCorpIncome: n })} />
            <Check label="You or your spouse own 50% or more of real property in North Dakota" hint="Required with ND-1SA lines 4–5 and several ND-1TC credits" checked={d.sa.ownsNdRealProperty} onChange={(v) => putSa({ ownsNdRealProperty: v })} />
            {d.sa.ownsNdRealProperty && <TextField label="North Dakota counties" autoComplete="off" value={d.sa.counties} onChange={(s) => putSa({ counties: s })} />}
          </div>
        </details>
      </Section>

      <Section title="Credits" intro={nd.marriage ? `Marriage penalty credit: ${usd(L['22'])}, worked out from both spouses’ qualified income.` : 'The marriage penalty credit (joint filers) is worked out automatically.'}>
        <div className="grid">
          <TextField label="Other state where you paid income tax" hint="Schedule ND-1CR; one state" autoComplete="off" value={d.cr.state} onChange={(s) => putCr({ state: s })} />
          <MoneyField label="Income from that state included in federal AGI" hint="ND-1CR line 1b" value={d.cr.sourceIncome} onChange={(n) => putCr({ sourceIncome: n })} />
          <MoneyField label="Part of it earned while a North Dakota resident" hint="Line 1c; leave 0 if all of it" value={d.cr.residentIncome} onChange={(n) => putCr({ residentIncome: n })} />
          <MoneyField label="Net income tax owed to that state" hint="Line 6; from its 2025 return, not the amount withheld" value={d.cr.tax} onChange={(n) => putCr({ tax: n })} />
        </div>
        {nd.cr && <p className="why">Credit for tax paid to {d.cr.state.trim() || 'the other state'}: {usd(nd.cr['7'])} (the smaller of {usd(nd.cr['6'])} and {(nd.cr['3'] * 100).toFixed(2)}% of your North Dakota tax).</p>}
        <details open={nd.tc['26'] > 0}>
          <summary>Schedule ND-1TC credits{nd.tc['26'] > 0 ? ` — ${usd(nd.tc['26'])}` : ''}</summary>
          <p className="why">Credits on lines 2, 3, 4, 6, 7, 8a, 9a, 9b, 11a, 17a, 17b and 21 need the real property question below the ND-1SA adjustments answered and a Property Tax Clearance Record from each county.</p>
          <div className="grid">
            {TC.map(([k, label, kind]) => kind === 'money'
              ? <MoneyField key={k} label={label} hint={`Line ${k}`} value={d.tc[k] ?? 0} onChange={(n) => put({ tc: { ...d.tc, [k]: n } })} />
              : <TextField key={k} label={label} hint={`Line ${k}`} autoComplete="off" value={d.tcInfo[k] ?? ''} onChange={(s) => put({ tcInfo: { ...d.tcInfo, [k]: s } })} />)}
          </div>
        </details>
      </Section>

      <Section title="Voluntary contributions" intro="At least $1 each; taken from your refund or added to what you owe.">
        <div className="grid">
          {FUNDS.map(([k, label]) => <MoneyField key={k} label={label} value={d.contributions[k] ?? 0} onChange={(n) => put({ contributions: { ...d.contributions, [k]: n } })} />)}
        </div>
      </Section>

      {nd.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{nd.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form ND-1" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="North Dakota forms" intro="Filled in on this device from the official North Dakota Office of State Tax Commissioner Form ND-1.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Include these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download North Dakota forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2{married ? ' (both spouses)' : ''}. Mail to Office of State Tax Commissioner, PO Box 5621, Bismarck ND 58506-5621; with a payment, include Form ND-1PRV. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
