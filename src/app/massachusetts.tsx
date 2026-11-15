/**
 * The Massachusetts part of the State step: Form 1 for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MaInput, Owner, Person } from '../engine/model.ts'
import { computeMassachusetts, MA_DONATION_LETTERS } from '../engine/ma2025.ts'
import { buildMaPacket } from '../pdf/ma2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, usd } from './fields'
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
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function MassachusettsStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ma
  const ma = useMemo(() => computeMassachusetts(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MaInput>): void => set((r) => ({ ...r, ma: { ...r.ma, ...p } }))
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
          <MoneyField label="Other Schedule Y deductions" value={d.otherDeductions} onChange={(n) => put({ otherDeductions: n })} />
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
