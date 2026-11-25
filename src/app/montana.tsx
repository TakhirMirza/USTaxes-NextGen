/**
 * The Montana part of the State step: Form 2 with Schedules I, III, IV and 2EC for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MtInput, Owner, Person } from '../engine/model.ts'
import { computeMontana } from '../engine/mt2025.ts'
import { buildMtPacket } from '../pdf/mt2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { RowList } from './creditrows'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Federal deduction (Form 1040 lines 12e + 13b)'], ['3', 'Federal taxable income for Montana'],
  ['4', 'Montana additions (Schedule I)'], ['5', 'Montana subtractions (Schedule I)'], ['6', '65-or-older subtraction'], ['7', 'Montana taxable income'],
  ['8', 'Tax'], ['9', 'Nonrefundable credits (Schedule III)'], ['10', 'Tax after credits'], ['11', 'Montana tax withheld'], ['12', 'Estimated payments'],
  ['13', 'Overpayment applied from 2024'], ['14', 'Extension payment'], ['15', 'Montana earned income credit (10%)'], ['16', 'Elderly homeowner/renter credit'],
  ['17', 'Refundable credits (Schedule III)'], ['19', 'Contributions (Schedule IV)'], ['21', 'Total payments'], ['24', 'Applied to 2026'], ['22', 'Tax due'], ['26', 'Refund']
]
const ALWAYS = new Set(['1', '7', '8', '10', '21'])
const KEY = new Set(['10', '22', '26'])
const CHECKOFFS: [string, string][] = [['1a', 'Nongame Wildlife Program'], ['1b', 'Child Abuse Prevention'], ['1c', 'Agriculture Literacy in Montana Schools'], ['1d', 'Montana Military Family Relief Fund']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function MontanaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.mt
  const mt = useMemo(() => computeMontana(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MtInput>): void => set((r) => ({ ...r, mt: { ...r.mt, ...p } }))
  const putElderly = (p: Partial<MtInput['elderly']>): void => put({ elderly: { ...d.elderly, ...p } })
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildMtPacket(ret, result, mt, preparer)
  const L = mt.lines
  const owes = L['22'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const age62 = owners.some((o) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age >= 62)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadMontanaForms }) => downloadMontanaForms(ret, result, mt, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Montana: you owe' : 'Montana refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['22'] : L['26'])}</p>
        </div>
        <dl>
          <div><dt>Montana taxable income</dt><dd>{usd(L['7'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['10'])}</dd></div>
          <div><dt>Earned income credit</dt><dd>{usd(L['15'])}</dd></div>
        </dl>
      </div>

      <Section title="Montana return" intro="Montana starts from your federal taxable income (without the QBI deduction) and taxes it at 4.7%, then 5.9% above $21,100 ($42,200 joint, $31,700 head of household). Long-term capital gains are taxed at 3% or 4.1%.">
        <div className="grid">
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}: date of birth`} hint="Asked for next to the signature" placeholder="mm/dd/yyyy" autoComplete="off" value={d.birthDates[o]} onChange={(s) => put({ birthDates: { ...d.birthDates, [o]: date(s) } })} />
          ))}
        </div>
      </Section>

      <Section title="Montana withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Montana" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Montana tax withheld on 1099s" hint="Line 11b" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="Pass-through entity tax credit" hint="Line 11c; from Montana Schedule K-1" value={d.passThroughCredit} onChange={(n) => put({ passThroughCredit: n })} />
          <MoneyField label="Withholding from Montana Schedule K-1" hint="Line 11d" value={d.k1Withholding} onChange={(n) => put({ k1Withholding: n })} />
          <MoneyField label="2025 estimated tax payments" hint="Line 12" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="2024 overpayment applied" hint="Line 13" value={d.priorYearApplied} onChange={(n) => put({ priorYearApplied: n })} />
          <MoneyField label="Extension payment" hint="Line 14" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
          {L['23'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 24" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      <Section title="Additions and subtractions (Schedule I)" intro={mt.s1['4'] > 0 ? `State income tax you itemized federally is added back: ${usd(mt.s1['4'])}.` : undefined}>
        <div className="grid">
          <MoneyField label="Interest on other states’ municipal bonds" hint="Line 1" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other additions" hint="Line 6" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          {d.otherAdditions > 0 && <TextField label="Addition code" hint="Two letters, e.g. AZ" autoComplete="off" value={d.otherAdditionsCode} onChange={(s) => put({ otherAdditionsCode: s })} />}
          <MoneyField label="State income tax refund in federal income" hint="Line 8" value={d.stateRefund} onChange={(n) => put({ stateRefund: n })} />
          <MoneyField label="Interest on U.S. government obligations" hint="Line 9" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Active-duty military salary" hint="Line 12" value={d.activeDutyPay} onChange={(n) => put({ activeDutyPay: n })} />
          <MoneyField label="Military retirement for working retirees / survivor benefits" hint="Line 13; from Form WMRE" value={d.workingMilitaryRetirement} onChange={(n) => put({ workingMilitaryRetirement: n })} />
          <MoneyField label="529 plan deposits" hint="Line 16; up to $4,500 ($9,000 joint)" value={d.tuition529} onChange={(n) => put({ tuition529: n })} />
          <MoneyField label="ABLE account deposits" hint="Line 17; up to $3,000 ($6,000 joint)" value={d.ableDeposits} onChange={(n) => put({ ableDeposits: n })} />
          <MoneyField label="Tier I railroad retirement in federal income" hint="Line 22" value={d.tier1Railroad} onChange={(n) => put({ tier1Railroad: n })} />
          <MoneyField label="Tier II railroad retirement in federal income" hint="Line 23" value={d.tier2Railroad} onChange={(n) => put({ tier2Railroad: n })} />
          <MoneyField label="Other subtractions" hint="Line 21" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          {d.otherSubtractions > 0 && <TextField label="Subtraction code" autoComplete="off" value={d.otherSubtractionsCode} onChange={(s) => put({ otherSubtractionsCode: s })} />}
        </div>
      </Section>

      <Section title="Credits (Schedule III)" intro="The earned income credit (10% of your federal credit) is worked out from your return.">
        <div className="grid">
          <MoneyField label="Other nonrefundable credits" hint="Schedule III lines 2–13" value={d.otherNonrefundableCredits} onChange={(n) => put({ otherNonrefundableCredits: n })} />
          <MoneyField label="Refundable credits" hint="Adoption, unlocking public lands" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
        </div>
        <h3>Credit for income tax paid to another state or country (Part II)</h3>
        <p className="why">Use the figures from the other state’s return. The credit is the smallest of that state’s tax, that tax times the share of its income sourced there, and the Montana tax times the share of your Montana income sourced there; long-term capital gains are figured separately.</p>
        <div className="grid">
          <TextField label="State abbreviation or country" autoComplete="off" value={d.otherStateCredit.state} onChange={(s) => put({ otherStateCredit: { ...d.otherStateCredit, state: s } })} />
          <MoneyField label="Income sourced and taxed there, without net long-term gains" hint="Line 1; included in Montana taxable income" value={d.otherStateCredit.income} onChange={(n) => put({ otherStateCredit: { ...d.otherStateCredit, income: n, amount: 0 } })} />
          <MoneyField label="All income taxed by that state" hint="Lines 2 and 12" value={d.otherStateCredit.stateIncome} onChange={(n) => put({ otherStateCredit: { ...d.otherStateCredit, stateIncome: n, amount: 0 } })} />
          <MoneyField label="Expenses related to that income" hint="Line 3b" value={d.otherStateCredit.expenses} onChange={(n) => put({ otherStateCredit: { ...d.otherStateCredit, expenses: n } })} />
          <MoneyField label="That state’s tax on the ordinary income" hint="Line 4; the tax liability, not the amount withheld" value={d.otherStateCredit.tax} onChange={(n) => put({ otherStateCredit: { ...d.otherStateCredit, tax: n, amount: 0 } })} />
          <MoneyField label="Net long-term capital gain sourced there" hint="Line 11" value={d.otherStateCredit.ltcgIncome} onChange={(n) => put({ otherStateCredit: { ...d.otherStateCredit, ltcgIncome: n, amount: 0 } })} />
          {d.otherStateCredit.ltcgIncome > 0 && <MoneyField label="That state’s tax on the long-term gain" hint="Line 14" value={d.otherStateCredit.ltcgTax} onChange={(n) => put({ otherStateCredit: { ...d.otherStateCredit, ltcgTax: n } })} />}
          {!mt.s3p2 && d.otherStateCredit.amount > 0 && <MoneyField label="Credit figured yourself" hint="Part I line 1; or enter the figures above" value={d.otherStateCredit.amount} onChange={(n) => put({ otherStateCredit: { ...d.otherStateCredit, amount: n } })} />}
        </div>
        {mt.s3p2 && <p className="why">Ordinary income part (line 10): {usd(mt.s3p2['10'])}; long-term gain part (line 20): {usd(mt.s3p2['20'])}; credit (line 21): {usd(mt.s3p2['21'])}.</p>}
        <h3>More states or countries (a separate Part II page each)</h3>
        <RowList rows={d.moreStates} max={5} noun="state" empty={() => ({ state: '', amount: 0, income: 0, stateIncome: 0, expenses: 0, tax: 0, ltcgIncome: 0, ltcgTax: 0 })} onChange={(rows) => put({ moreStates: rows })}
          fields={[['state', 'State abbreviation or country', 'text'], ['income', 'Income sourced and taxed there, without net long-term gains', 'money', 'Line 1'], ['stateIncome', 'All income taxed by that state', 'money', 'Lines 2 and 12'], ['expenses', 'Expenses related to that income', 'money', 'Line 3b'], ['tax', 'That state’s tax on the ordinary income', 'money', 'Line 4'], ['ltcgIncome', 'Net long-term capital gain sourced there', 'money', 'Line 11'], ['ltcgTax', 'That state’s tax on the long-term gain', 'money', 'Line 14']]} />
        {mt.s3p2More.length > 0 && <p className="why">{mt.s3p2More.map((x) => `${x.state.toUpperCase()}: ${usd(x.lines['21'])}`).join('; ')}. Part I line 1 (all states): {usd(mt.s3['1'])}.</p>}
      </Section>

      <Section title="Elderly homeowner/renter credit (Schedule 2EC)" intro="Up to $1,150 if you are 62 or older, lived in Montana at least nine months, and your household’s total income was under $45,000.">
        <div className="grid">
          <Check label="Claim the elderly homeowner/renter credit" hint={age62 ? undefined : 'You (or your spouse) must be 62 or older'} checked={d.elderly.claim} onChange={(v) => putElderly({ claim: v })} />
          {d.elderly.claim && <>
            <NumberField label="People in your household" max={20} value={d.elderly.householdSize} onChange={(n) => putElderly({ householdSize: n })} />
            <MoneyField label="Property tax billed on your home (up to one acre)" value={d.elderly.propertyTaxBilled} onChange={(n) => putElderly({ propertyTaxBilled: n })} />
            <MoneyField label="Rent paid for your home" value={d.elderly.rentPaid} onChange={(n) => putElderly({ rentPaid: n })} />
            <MoneyField label="Government assistance received" hint="Veterans’ benefits, SSI, workers’ comp" value={d.elderly.governmentAssistance} onChange={(n) => putElderly({ governmentAssistance: n })} />
            <MoneyField label="Income of other household members" value={d.elderly.otherHouseholdIncome} onChange={(n) => putElderly({ otherHouseholdIncome: n })} />
            <TextField label="Address of the home (if not your mailing address)" autoComplete="off" value={d.elderly.physicalAddress} onChange={(s) => putElderly({ physicalAddress: s })} />
          </>}
        </div>
        {mt.ec && <p className="why">Gross household income {usd(mt.ec['18'])}; credit {usd(L['16'])}.</p>}
      </Section>

      <Section title="Voluntary contributions (Schedule IV)" intro="Each amount is taken from your refund or added to what you owe.">
        <div className="grid">
          {CHECKOFFS.map(([k, label]) => (
            <MoneyField key={k} label={label} hint={`Line ${k}`} value={d.contributions[k] ?? 0} onChange={(n) => put({ contributions: { ...d.contributions, [k]: n } })} />
          ))}
        </div>
      </Section>

      {mt.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{mt.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 2" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Montana forms" intro="Filled in on this device from the official Montana Department of Revenue Form 2.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Include these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Montana forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2. With a payment, mail to Montana Department of Revenue, PO Box 6308, Helena MT 59604-6308; otherwise to PO Box 6577, Helena MT 59604-6577. No staples. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
