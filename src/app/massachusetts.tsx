/**
 * The Massachusetts part of the State step: Form 1 for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MaHealth, MaInput, Owner, Person } from '../engine/model.ts'
import { computeMassachusetts, MA_DONATION_LETTERS } from '../engine/ma2025.ts'
import { buildMaPacket } from '../pdf/ma2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { SelectField } from './steps'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['3', 'Wages'], ['4', 'Taxable pensions'], ['5', 'Massachusetts bank interest'], ['6a', 'Business income'], ['7', 'Rental and pass-through income'],
  ['8a', 'Unemployment'], ['8b', 'Massachusetts lottery'], ['9', 'Other income (Schedule X)'], ['10', 'Total 5.0% income'],
  ['16', 'Deductions'], ['18', 'Exemptions'], ['19', '5.0% income after exemptions'], ['20', 'Interest and dividends (Schedule B)'],
  ['21', 'Total taxable 5.0% income'], ['22', 'Tax at 5.0%'], ['23', 'Tax on short-term gains (8.5%)'], ['24', 'Tax on long-term gains'],
  ['28b', '4% surtax'], ['28', 'Total tax'], ['29', 'Limited Income Credit'], ['30', 'Credit for tax paid to other states'], ['32', 'Tax after credits'],
  ['33', 'Voluntary contributions'], ['34', 'Use tax'], ['38', 'Massachusetts tax withheld'], ['40', 'Estimated payments'],
  ['43', 'Earned Income Credit (40%)'], ['44', 'Senior Circuit Breaker Credit'], ['46', 'Child and Family Tax Credit'], ['51', 'Total payments and credits'],
  ['53', 'Applied to 2026'], ['55', 'Tax due'], ['54', 'Refund']
]
const ALWAYS = new Set(['10', '19', '21', '22', '28', '32', '51'])
const KEY = new Set(['21', '28', '54', '55'])
const DONATIONS: Record<string, string> = { a: 'Endangered Wildlife Conservation', b: 'Organ Transplant', c: 'Public Health HIV and Hepatitis Fund', d: 'U.S. Olympic', e: 'Military Family Relief', f: 'Homeless Animal Prevention and Care' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function MassachusettsStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ma
  const ma = useMemo(() => computeMassachusetts(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MaInput>): void => set((r) => ({ ...r, ma: { ...r.ma, ...p } }))
  const putHealth = (o: Owner, p: Partial<MaHealth>): void => set((r) => ({ ...r, ma: { ...r.ma, health: { ...r.ma.health, [o]: { ...r.ma.health[o], ...p } } } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildMaPacket(ret, result, ma, preparer)
  const L = ma.lines
  const owes = L['55'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const hasPension = ret.retirement.some((x) => owners.includes(x.owner) && !x.ira && x.taxableAmount > 0)
  const hasIra = ret.retirement.some((x) => owners.includes(x.owner) && x.ira && x.taxableAmount > 0)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadMassachusettsForms }) => downloadMassachusettsForms(ret, result, ma, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Massachusetts: you owe' : 'Massachusetts refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['55'] : L['54'])}</p>
        </div>
        <dl>
          <div><dt>Taxable 5.0% income</dt><dd>{usd(L['21'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['28'])}</dd></div>
          <div><dt>Refundable credits</dt><dd>{usd(L['48'])}</dd></div>
        </dl>
      </div>

      <Section title="Massachusetts return" intro={`Massachusetts taxes most income at 5.0% (short-term capital gains at 8.5%) after exemptions of ${usd(L['2g'])} for your household. Social Security is not taxed.`}>
        <div className="checks">
          {owners.map((o) => <Check key={`v${o}`} label={`${names[o]} served in Operation Enduring Freedom, Iraqi Freedom, Noble Eagle or Sinai Peninsula`} checked={d.veteran[o]} onChange={(on) => put({ veteran: { ...d.veteran, [o]: on } })} />)}
          {owners.map((o) => <Check key={`e${o}`} label={`$1 to the State Election Campaign Fund (${names[o]})`} checked={d.electionFund[o]} onChange={(on) => put({ electionFund: { ...d.electionFund, [o]: on } })} />)}
        </div>
      </Section>

      <Section title="Dates of birth" intro="Schedule HC asks for your date of birth; Schedule DI for each dependent's.">
        <div className="grid">
          {owners.map((o) => <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(v) => put({ birthDate: { ...d.birthDate, [o]: date(v) } })} />)}
          {ret.dependents.map((dep, i) => <TextField key={dep.id} label={`${dep.name.trim() || `Dependent ${i + 1}`}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.dependentBirthDates[dep.id] ?? ''} onChange={(v) => put({ dependentBirthDates: { ...d.dependentBirthDates, [dep.id]: date(v) } })} />)}
        </div>
      </Section>

      <Section title="Health coverage (Schedule HC)" intro="Every Massachusetts resident files Schedule HC. Coverage that met Minimum Creditable Coverage (MCC) all year — employer, ConnectorCare, MassHealth, Medicare or military — means no penalty. Your insurer's Form MA 1099-HC has the details.">
        {owners.map((o) => {
          const h = d.health[o]
          return (
            <fieldset key={o} className="statement">
              <legend>{names[o]}</legend>
              <div className="grid">
                <SelectField label="MCC coverage in 2025" value={h.coverage} onChange={(v) => putHealth(o, { coverage: v as MaHealth['coverage'] })}
                  options={[{ value: 'full', label: 'Full year' }, { value: 'part', label: 'Part of the year' }, { value: 'none', label: 'None' }]} />
                {h.coverage !== 'none' && (h.plans.private || h.plans.other) && <TextField label="Insurer or program (1099-HC box 1)" autoComplete="off" value={h.insurer} onChange={(v) => putHealth(o, { insurer: v })} />}
                {h.coverage !== 'none' && (h.plans.private || h.plans.other) && <TextField label="Subscriber number" hint="From Form MA 1099-HC or your insurance card" autoComplete="off" value={h.subscriber} onChange={(v) => putHealth(o, { subscriber: v })} />}
              </div>
              {h.coverage !== 'none' && (
                <div className="checks">
                  <Check label="Private insurance, including ConnectorCare and employer plans" checked={h.plans.private} onChange={(on) => putHealth(o, { plans: { ...h.plans, private: on } })} />
                  <Check label="MassHealth" checked={h.plans.masshealth} onChange={(on) => putHealth(o, { plans: { ...h.plans, masshealth: on } })} />
                  <Check label="Medicare" checked={h.plans.medicare} onChange={(on) => putHealth(o, { plans: { ...h.plans, medicare: on } })} />
                  <Check label="U.S. military, VA or Tricare" checked={h.plans.military} onChange={(on) => putHealth(o, { plans: { ...h.plans, military: on } })} />
                  <Check label="Other government program" checked={h.plans.other} onChange={(on) => putHealth(o, { plans: { ...h.plans, other: on } })} />
                </div>
              )}
              {h.coverage === 'part' && (
                <div className="checks months" role="group" aria-label={`Months ${names[o]} had MCC coverage`}>
                  {MONTHS.map((m, i) => <Check key={m} label={m} checked={h.months[i] !== false} onChange={(on) => putHealth(o, { months: h.months.map((x, j) => (j === i ? on : x)) })} />)}
                </div>
              )}
            </fieldset>
          )
        })}
        {(ma.health.penaltyPossible.taxpayer || ma.health.penaltyPossible.spouse) && (
          <>
            <h3>Lines 8–12: exemptions and whether insurance was affordable</h3>
            <div className="grid">
              <SelectField label="Region of your county (Table 4 premiums)" value={String(d.hcRegion)} onChange={(v) => put({ hcRegion: Number(v) as 1 | 2 | 3 })}
                options={[{ value: '1', label: 'Berkshire, Franklin, Hampden or Hampshire' }, { value: '2', label: 'Barnstable, Bristol, Essex, Middlesex, Norfolk, Plymouth, Suffolk or Worcester' }, { value: '3', label: 'Dukes or Nantucket' }]} />
            </div>
            {(['taxpayer', 'spouse'] as Owner[]).filter((o) => ma.health.penaltyPossible[o]).map((o) => {
              const p = d.hcPenalty[o]
              const x = ma.health.hc[o]
              const putP = (q: Partial<MaInput['hcPenalty']['taxpayer']>): void => put({ hcPenalty: { ...d.hcPenalty, [o]: { ...p, ...q } } })
              return (
                <fieldset key={o} className="statement">
                  <legend>{o === 'taxpayer' ? 'You' : 'Your spouse'}</legend>
                  <div className="grid">
                    <Check label="Religious exemption" hint="Line 8a" checked={p.religious} onChange={(on) => putP({ religious: on })} />
                    {p.religious && <Check label="Received medical care in 2025" hint="Line 8b" checked={p.receivedCare} onChange={(on) => putP({ receivedCare: on })} />}
                    <TextField label="Health Connector certificate of exemption number" hint="Line 9; leave blank if none" autoComplete="off" value={p.certificate} onChange={(s) => putP({ certificate: s })} />
                    <Check label="An employer offered coverage that met MCC for the whole uninsured period" hint="Line 10" checked={p.employerOffered} onChange={(on) => putP({ employerOffered: on })} />
                    {p.employerOffered && <MoneyField label="Lowest monthly premium for that coverage" hint="Your share, covering your family; 0 if free" value={p.employerPremium} onChange={(n) => putP({ employerPremium: n })} />}
                    <Check label="Not eligible for subsidized coverage" hint="Line 11: not legally residing in the U.S., offered an employer plan under 9.02% of income, or denied MassHealth / Connector subsidies" checked={p.govIneligible} onChange={(on) => putP({ govIneligible: on })} />
                    <Check label="Appeal the penalty" hint="No penalty is entered on line 35; DOR and the Health Connector review it" checked={p.appeal} onChange={(on) => putP({ appeal: on })} />
                  </div>
                  {x && <p className="why">{x.worksheet
                    ? `Line ${x.l10 ? '10' : x.l11 ? '11' : '12'}: Yes. Penalty: ${x.worksheet.l7} months × ${usd(x.worksheet.l3)} (column ${x.worksheet.l2}) = ${usd(x.worksheet.l8)}${p.appeal ? ', appealed — not entered on line 35' : ` on Form 1 line 35${o === 'taxpayer' ? 'a' : 'b'}`}.`
                    : 'No penalty: an exemption applies or insurance was not affordable.'}</p>}
                </fieldset>
              )
            })}
          </>
        )}
        <p className="why">{ma.health.penaltyPossible.taxpayer || ma.health.penaltyPossible.spouse
          ? `Line 35 health care penalty: ${usd(L['35'])}.`
          : ma.health.askLine6 && ma.health.atOrBelowFpl
            ? `No penalty: your federal AGI is at or below 150% of the poverty level (${usd(ma.health.fpl150)} for ${ma.health.familySize}).`
            : 'No health care penalty applies.'}</p>
      </Section>

      <Section title="Massachusetts withholding" intro="From the state section of each W-2 (boxes 16 and 17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="MA" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Massachusetts tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="Withheld on other forms" hint="62-WH, PWH, LOA" value={d.otherWithholding} onChange={(n) => put({ otherWithholding: n })} />
          <MoneyField label="2024 overpayment applied" value={d.priorOverpayment} onChange={(n) => put({ priorOverpayment: n })} />
          <MoneyField label="2025 estimated tax payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
      </Section>

      <Section title="Rent, commuting and other deductions" intro="Renters deduct half their rent, up to $4,000. Charitable gifts, HSA, self-employed health insurance and student loan interest come from your federal return.">
        <div className="grid">
          <MoneyField label="Rent paid for your Massachusetts home" value={d.rentPaid} onChange={(n) => put({ rentPaid: n })} />
          {owners.map((o) => <MoneyField key={o} label={`${names[o]}: MBTA fares, E-ZPass tolls, bike costs`} hint="The amount over $150 is deducted, up to $750" value={d.commuter[o]} onChange={(n) => put({ commuter: { ...d.commuter, [o]: n } })} />)}
          <MoneyField label="Massachusetts 529 contributions" hint="Up to $1,000 ($2,000 joint)" value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <MoneyField label="Alimony paid (deductible)" hint="Divorce before 2019" value={d.alimonyPaid} onChange={(n) => put({ alimonyPaid: n })} />
          <MoneyField label="Penalty on early savings withdrawal" value={d.earlyWithdrawalPenalty} onChange={(n) => put({ earlyWithdrawalPenalty: n })} />
          <MoneyField label="Undergraduate student loan interest" hint="Schedule Y line 12 — only if not the same interest as line 10" value={d.undergradLoanInterest} onChange={(n) => put({ undergradLoanInterest: n })} />
          <MoneyField label="Other Schedule Y deductions" hint="Shown on line 9a; move to the matching line" value={d.otherDeductions} onChange={(n) => put({ otherDeductions: n })} />
        </div>
      </Section>

      <Section title="Income Massachusetts treats differently">
        <div className="grid">
          <MoneyField label="Interest from Massachusetts banks" hint="Line 5; other interest goes to Schedule B" value={d.maBankInterest} onChange={(n) => put({ maBankInterest: n })} />
          <MoneyField label="Interest on U.S. obligations" hint="Not taxed" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Taxed" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          {hasPension && <MoneyField label="Exempt government or military pensions" hint="Contributory U.S. or Massachusetts pensions, military retirement" value={d.governmentPension} onChange={(n) => put({ governmentPension: n })} />}
          {hasIra && <MoneyField label="IRA contributions recovered this year" hint="Massachusetts already taxed your contributions" value={d.iraBasisRecovered} onChange={(n) => put({ iraBasisRecovered: n })} />}
          <MoneyField label="Massachusetts lottery winnings" value={d.lotteryWinnings} onChange={(n) => put({ lotteryWinnings: n })} />
          <MoneyField label="Other gambling winnings" hint="Casinos, sports betting (Schedule X)" value={d.otherGambling} onChange={(n) => put({ otherGambling: n })} />
          <MoneyField label="Alimony received (taxable)" hint="Divorce before 2019" value={d.alimonyReceived} onChange={(n) => put({ alimonyReceived: n })} />
          <MoneyField label="Fees and other 5.0% income" hint="Schedule X line 4" value={d.otherIncome} onChange={(n) => put({ otherIncome: n })} />
          <MoneyField label="Massachusetts short-term losses from 2024" hint="2024 Schedule B line 40" value={d.shortTermCarryover} onChange={(n) => put({ shortTermCarryover: n })} />
          <MoneyField label="Massachusetts long-term losses from 2024" hint="2024 Schedule D line 23" value={d.longTermCarryover} onChange={(n) => put({ longTermCarryover: n })} />
        </div>
      </Section>

      <Section title="Credits and refund">
        <div className="grid">
          <MoneyField label="Credit for tax paid to other states (line 30)" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <MoneyField label="Other credits (Schedule CMS)" value={d.otherCredits} onChange={(n) => put({ otherCredits: n })} />
          <MoneyField label="Senior Circuit Breaker Credit (Schedule CB)" hint="Up to $2,820 for homeowners and renters 65+" value={d.circuitBreaker} onChange={(n) => put({ circuitBreaker: n })} />
          <NumberField label="Other dependents for the $440 credit" hint="Disabled, or 65 and older (children under 13 are counted for you)" max={9} value={d.extraFamilyCredit} onChange={(n) => put({ extraFamilyCredit: n })} />
          <MoneyField label="Use tax" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['52'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <details className="more">
          <summary>Voluntary contributions (line 33)</summary>
          <div className="grid">
            {MA_DONATION_LETTERS.map((k) => <MoneyField key={k} label={DONATIONS[k]} value={d.donations[k] ?? 0} onChange={(n) => put({ donations: { ...d.donations, [k]: n } })} />)}
          </div>
        </details>
      </Section>

      {ma.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ma.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 1" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Massachusetts forms" intro="Filled in on this device from the official Massachusetts DOR PDF.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Massachusetts forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 1. Returns are due April 15, 2026. MassTaxConnect (mass.gov/masstaxconnect) offers free e-filing.</p>
      </Section>
    </div>
  )
}
