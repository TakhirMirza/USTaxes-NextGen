/**
 * The Maine part of the State step: Form 1040ME with Schedules 1A, 1S, 2, A and PTFC/STFC for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MeInput, MePensionKind, Owner, Person } from '../engine/model.ts'
import { computeMaine } from '../engine/me2025.ts'
import { buildMePacket } from '../pdf/me2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['14', 'Federal adjusted gross income'], ['15a', 'Additions (Schedule 1A)'], ['15b', 'Subtractions (Schedule 1S)'], ['16', 'Maine adjusted gross income'],
  ['17', 'Deduction'], ['18', 'Exemptions'], ['19', 'Taxable income'], ['20', 'Income tax'], ['23', 'Nonrefundable credits (Schedule A)'], ['24', 'Net tax'],
  ['25a', 'Maine tax withheld'], ['25b', 'Estimated and extension payments'], ['25c', 'Refundable credits (Schedule A)'], ['25d', 'Property tax fairness credit'],
  ['25e', 'Sales tax fairness credit'], ['25f', 'Total payments and credits'], ['30', 'Use tax'], ['31', 'Contributions and park passes'], ['34a', 'Credited to 2026'],
  ['35', 'Amount you owe'], ['34b', 'Refund']
]
const ALWAYS = new Set(['14', '16', '19', '20', '24', '25f'])
const KEY = new Set(['24', '35', '34b'])
const KINDS: [MePensionKind, string][] = [['none', 'Not deductible (early distribution, Roth conversion…)'], ['eligible', 'Pension, 401(k), 403(b), 457(b) or IRA'], ['military', 'U.S. military retirement pay']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function MaineStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.me
  const me = useMemo(() => computeMaine(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MeInput>): void => set((r) => ({ ...r, me: { ...r.me, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildMePacket(ret, result, me, preparer)
  const L = me.lines
  const owes = L['35'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadMaineForms }) => downloadMaineForms(ret, result, me, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Maine: you owe' : 'Maine refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['35'] : L['34b'])}</p>
        </div>
        <dl>
          <div><dt>Maine taxable income</dt><dd>{usd(L['19'])}</dd></div>
          <div><dt>Net tax</dt><dd>{usd(L['24'])}</dd></div>
          <div><dt>Refundable credits</dt><dd>{usd(L['25c'] + L['25d'] + L['25e'])}</dd></div>
        </dl>
      </div>

      <Section title="Maine return" intro="Maine starts from federal adjusted gross income, exempts Social Security, and taxes income at 5.8% to 7.15% after a $15,000 standard deduction ($30,000 joint, $22,500 head of household) and $5,150 per exemption.">
        <div className="grid">
          {owners.map((o) => (
            <Check key={o} label={`${names[o]}: $3 to the Maine Clean Election Fund`} hint="Doesn’t change your tax or refund" checked={d.cleanElection[o]} onChange={(v) => put({ cleanElection: { ...d.cleanElection, [o]: v } })} />
          ))}
          <Check label="Engaged in commercial farming or fishing in 2025" checked={d.farmingFishing} onChange={(v) => put({ farmingFishing: v })} />
        </div>
        <p className="why">{me.itemize ? `Itemizing on Schedule 2: ${usd(L['17'])}.` : `Standard deduction ${usd(L['17'])}.`}{me.deductionRatio > 0 ? ` Reduced from ${usd(L['17full'])} because Maine AGI is above the phase-out threshold.` : ''}</p>
      </Section>

      <Section title="Maine withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Maine" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Maine tax withheld on 1099s and 1099MEs" value={d.withholdingOther} onChange={(n) => put({ withholdingOther: n })} />
          <MoneyField label="2025 estimated and extension payments" hint="Line 25b; include the 2024 overpayment applied and real estate withholding" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          {L['33'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 34a" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Pension income deduction (Schedule 1S line 4)" intro="Up to $48,216 a person, less Social Security received. Military retirement pay is subtracted in full.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`me-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`me-kind-${x.id}`} className="select" value={d.pensionKind[x.id] ?? 'none'} onChange={(e) => put({ pensionKind: { ...d.pensionKind, [x.id]: e.target.value as MePensionKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
          {me.s1s['4'] > 0 && <p className="why">Pension income deduction: {usd(me.s1s['4'])}.</p>}
        </Section>
      )}

      <Section title="Additions and subtractions">
        <div className="grid">
          <MoneyField label="Interest on other states’ municipal bonds" hint="Schedule 1A line 1" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="MainePERS contributions" hint="Schedule 1A line 3; from your state or municipal W-2" value={d.mainePersContributions} onChange={(n) => put({ mainePersContributions: n })} />
          <MoneyField label="Other additions" hint="Schedule 1A line 10" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Interest on U.S. government obligations" hint="Schedule 1S line 1" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="State income tax refund in federal income" hint="Schedule 1S line 2" value={d.stateRefund} onChange={(n) => put({ stateRefund: n })} />
          <MoneyField label="MainePERS pick-up contributions" hint="Schedule 1S line 7; 1099-R box 2a minus box 16" value={d.mainePersPickup} onChange={(n) => put({ mainePersPickup: n })} />
          <MoneyField label="529 plan contributions" hint="Schedule 1S line 8" value={d.tuition529} onChange={(n) => put({ tuition529: n })} />
          <NumberField label="529 beneficiaries" hint="Up to $1,000 each" max={20} value={d.tuitionBeneficiaries} onChange={(n) => put({ tuitionBeneficiaries: n })} />
          <MoneyField label="Interest on Maine municipal bonds in federal income" hint="Schedule 1S line 18" value={d.maineBondInterest} onChange={(n) => put({ maineBondInterest: n })} />
          <MoneyField label="Other subtractions" hint="Schedule 1S line 26; attach a worksheet" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
        </div>
      </Section>

      <Section title="Property and sales tax fairness credits" intro="Refundable credits for Maine residents with limited income who pay property tax or rent on their home. Not for married filing separately.">
        <div className="grid">
          <MoneyField label="Property tax paid on your home in 2025" hint="House and up to 10 acres" value={d.propertyTax} onChange={(n) => put({ propertyTax: n })} />
          <MoneyField label="Rent paid for your home in 2025" hint="Not paid by a government program" value={d.rentPaid} onChange={(n) => put({ rentPaid: n })} />
          <Check label="The rent includes heat, utilities or furniture" checked={d.rentIncludesUtilities} onChange={(v) => put({ rentIncludesUtilities: v })} />
          {d.rentIncludesUtilities && <MoneyField label="Amount of the rent for heat, utilities, furniture" hint="Leave blank to use 15% of the rent" value={d.rentUtilities ?? 0} onChange={(n) => put({ rentUtilities: n > 0 ? n : null })} />}
          <TextField label="Landlord’s name and phone" autoComplete="off" value={d.landlord} onChange={(s) => put({ landlord: s })} />
          <TextField label="Where you lived (if not your mailing address)" autoComplete="off" value={d.propertyLocation} onChange={(s) => put({ propertyLocation: s })} />
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}: date of birth`} placeholder="mm/dd/yyyy" autoComplete="off" value={d.birthDates[o]} onChange={(s) => put({ birthDates: { ...d.birthDates, [o]: date(s) } })} />
          ))}
          <Check label="Veteran rated 100% permanently and totally disabled by the VA" hint="Doubles the property tax fairness credit" checked={d.veteranDisabled} onChange={(v) => put({ veteranDisabled: v })} />
        </div>
        <p className="why">Total income for these credits: {usd(me.ptfc['3'])}. Property tax fairness credit {usd(L['25d'])}; sales tax fairness credit {usd(L['25e'])}.</p>
      </Section>

      <Section title="Other credits" intro="The dependent exemption credit ($305, or $610 under six), 25% of your federal child care credit and the earned income credit are worked out from your return.">
        <div className="grid">
          <MoneyField label="Child care paid to a Star 5 provider" hint="Part of your care expenses; credited at 50%" value={d.star5Expenses} onChange={(n) => put({ star5Expenses: n })} />
          <TextField label="Other state you paid tax to" autoComplete="off" value={d.otherJurisdiction.name} onChange={(s) => put({ otherJurisdiction: { ...d.otherJurisdiction, name: s } })} />
          <MoneyField label="Income taxed by both states" value={d.otherJurisdiction.income} onChange={(n) => put({ otherJurisdiction: { ...d.otherJurisdiction, income: n } })} />
          <MoneyField label="Other state’s tax on that income" value={d.otherJurisdiction.tax} onChange={(n) => put({ otherJurisdiction: { ...d.otherJurisdiction, tax: n } })} />
          <MoneyField label="Other refundable credits" hint="Schedule A line 8 (student loan repayment, adult dependent care…)" value={d.otherRefundableCredits} onChange={(n) => put({ otherRefundableCredits: n })} />
          <MoneyField label="Other nonrefundable credits" hint="Schedule A line 20" value={d.otherNonrefundableCredits} onChange={(n) => put({ otherNonrefundableCredits: n })} />
        </div>
      </Section>

      <Section title="Use tax, contributions and signature">
        <div className="grid">
          <MoneyField label="Use tax on untaxed purchases" hint={`Line 30; if unsure, 0.04% of Maine AGI is ${usd(Math.round(Math.max(0, L['16']) * 0.0004))}`} value={d.useTax} onChange={(n) => put({ useTax: n })} />
          <MoneyField label="Charitable contributions and park passes" hint="Line 31, from Schedule CP" value={d.contributions} onChange={(n) => put({ contributions: n })} />
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}: occupation`} autoComplete="off" value={d.occupation[o]} onChange={(s) => put({ occupation: { ...d.occupation, [o]: s } })} />
          ))}
        </div>
      </Section>

      {me.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{me.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 1040ME" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Maine forms" intro="Filled in on this device from the official Maine Revenue Services Form 1040ME and schedules.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Include these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Maine forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. With a payment, mail to Maine Revenue Services, P.O. Box 1067, Augusta ME 04332-1067; otherwise to P.O. Box 1066, Augusta ME 04332-1066. Don’t staple. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
