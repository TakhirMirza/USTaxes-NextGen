/**
 * The Colorado part of the State step: DR 0104 for full-year residents, built on federal taxable income.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { CoInput, Owner, Person } from '../engine/model.ts'
import { computeColorado } from '../engine/co2025.ts'
import { buildCoPacket } from '../pdf/co2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal taxable income'], ['2', 'State income tax addback'], ['3', 'QBI deduction addback'], ['4', 'Deduction addback (AGI over $300,000)'],
  ['5', 'Business meals addback'], ['9', 'Other additions'], ['10', 'Subtotal'], ['11', 'Subtractions (DR 0104AD)'], ['12', 'Colorado taxable income'],
  ['13', 'Colorado tax (4.4%)'], ['17', 'Nonrefundable credits'], ['23', 'Net tax'], ['24', 'Colorado tax withheld'], ['25', 'Prior-year carryforward'],
  ['26', 'Estimated payments'], ['27', 'Extension payment'], ['31', 'Refundable credits (DR 0104CR)'], ['33', 'Payments and credits'],
  ['37', 'Modified AGI for TABOR'], ['38', 'TABOR sales tax refund'], ['41', 'Carried to 2026'], ['42', 'Refund'], ['47', 'Amount you owe']
]
const AD: [line: string, label: string][] = [
  ['1', 'State income tax refund'], ['2', 'U.S. government interest'], ['3', 'Social Security (you)'], ['4', 'Pension and annuity (you)'],
  ['5', 'Social Security (spouse)'], ['6', 'Pension and annuity (spouse)'], ['7', 'Military retirement (you)'], ['8', 'Military retirement (spouse)'],
  ['10', 'CollegeInvest contributions'], ['11', 'Colorado ABLE contributions'], ['12', 'Charitable gifts over $500 (non-itemizers)'],
  ['19', 'FAMLI benefits'], ['20', 'Other subtractions'], ['22', 'Total subtractions']
]
const CREDITS: [line: string, label: string][] = [
  ['1', 'Child tax credit and family affordability credit (DR 0104CN)'], ['2', 'Child and dependent care credit (DR 0347)'], ['5', 'Colorado EITC (50% of federal)'],
  ['26', 'Total refundable credits']
]
const ALWAYS = new Set(['1', '10', '12', '13', '23', '33'])
const KEY = new Set(['12', '23', '42', '47'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function ColoradoStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.co
  const co = useMemo(() => computeColorado(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<CoInput>): void => set((r) => ({ ...r, co: { ...r.co, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildCoPacket(ret, result, co, preparer)
  const L = co.lines
  const A = co.ad
  const CR = co.cr
  const owes = L['47'] > 0
  const ageOf = (o: Owner): number => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadColoradoForms }) => downloadColoradoForms(ret, result, co, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Colorado: you owe' : 'Colorado refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['47'] : L['42'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['12'])}</dd></div>
          <div><dt>Net tax</dt><dd>{usd(L['23'])}</dd></div>
          <div><dt>TABOR refund</dt><dd>{usd(L['38'])}</dd></div>
        </dl>
      </div>

      <Section title="Colorado return" intro="Colorado starts from your federal taxable income and taxes it at a flat 4.4%. Colorado asks for your date of birth and, if you have one, details from your driver license or state ID.">
        {owners.map((o) => (
          <div className="grid" key={o}>
            <TextField label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
            <TextField label={`${names[o]}’s ID: issuing state`} placeholder="CO" autoComplete="off" value={d.idState[o]} onChange={(s) => put({ idState: { ...d.idState, [o]: s.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() } })} />
            <TextField label={`${names[o]}’s ID: last 4 characters`} autoComplete="off" value={d.idLast4[o]} onChange={(s) => put({ idLast4: { ...d.idLast4, [o]: s.replace(/[^0-9A-Za-z]/g, '').slice(-4).toUpperCase() } })} />
            <TextField label={`${names[o]}’s ID: date issued`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.idIssued[o]} onChange={(s) => put({ idIssued: { ...d.idIssued, [o]: date(s) } })} />
          </div>
        ))}
        <div className="checks">
          <Check label="Claim the TABOR state sales tax refund" hint="Full-year residents, generally 18 or older on January 1, 2025" checked={d.tabor} onChange={(on) => put({ tabor: on })} />
          {result.deduction.used === 'itemized' && <Check label="The state and local tax on my federal Schedule A is sales tax" hint="Then nothing is added back on line 2" checked={d.deductedSalesTax} onChange={(on) => put({ deductedSalesTax: on })} />}
        </div>
      </Section>

      <Section title="Colorado withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Colorado" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Colorado tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2024 overpayment carried to 2025" value={d.priorCarryforward} onChange={(n) => put({ priorCarryforward: n })} />
          <MoneyField label="2025 estimated payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Extension payment (DR 0158-I)" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
      </Section>

      <Section title="Subtractions" intro="Social Security and pensions are figured from your federal entries: everything at 65 or older (up to $24,000 of pensions), at 55–64 up to $20,000.">
        <div className="grid">
          <MoneyField label="State income tax refund in federal income" hint="Schedule 1 line 1" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. government obligations" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          {owners.filter((o) => ageOf(o) <= 54).map((o) => (
            <MoneyField key={o} label={`${names[o]}: military retirement`} hint="Under 55: up to $15,000 subtracted" value={d.militaryRetirement[o]} onChange={(n) => put({ militaryRetirement: { ...d.militaryRetirement, [o]: n } })} />
          ))}
          <MoneyField label="CollegeInvest contributions" hint="Colorado 529 only; up to $25,400 per beneficiary ($38,100 joint)" value={d.collegeInvest} onChange={(n) => put({ collegeInvest: n })} />
          <MoneyField label="Colorado ABLE contributions" value={d.coloradoAble} onChange={(n) => put({ coloradoAble: n })} />
          {d.collegeInvest + d.coloradoAble > 0 && <NumberField label="Beneficiaries of those contributions" max={20} value={d.beneficiaries} onChange={(n) => put({ beneficiaries: n })} />}
          <MoneyField label="Colorado FAMLI benefits in federal income" hint="Not unemployment" value={d.famliBenefits} onChange={(n) => put({ famliBenefits: n })} />
          <MoneyField label="Other subtractions" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <MoneyField label="Interest on non-Colorado state and local bonds" hint="Added back on line 9" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Other additions" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
        </div>
        <table className="lines"><tbody>
          {AD.filter(([k]) => k === '22' || (A[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={k === '22' ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(A[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Credits">
        <div className="grid">
          <MoneyField label="Credit for tax paid to another state" hint="DR 0104CR Part II" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <MoneyField label="Other nonrefundable credits" hint="DR 0104CR Part III" value={d.nonrefundableCredits} onChange={(n) => put({ nonrefundableCredits: n })} />
          <MoneyField label="Other refundable credits" hint="DR 0104CR lines 7–25" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
          {L['40'] > 0 && <MoneyField label="Carry to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <table className="lines"><tbody>
          {CREDITS.filter(([k]) => k === '26' || (CR[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={k === '26' ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(CR[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      {co.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{co.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form DR 0104" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Colorado forms" intro="Filled in on this device from the official Colorado Department of Revenue PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Colorado forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 8 and mail all eight DR 0104 pages: with a payment to Colorado Department of Revenue, Denver CO 80261-0006; otherwise to 80261-0005. Revenue Online (Colorado.gov/RevenueOnline) files for free. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
