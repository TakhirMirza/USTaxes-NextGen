/**
 * The Illinois part of the State step: Form IL-1040 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { IlInput, Owner, Person } from '../engine/model.ts'
import { IL_SUBTRACTION_LINES_P2, IL_SUBTRACTION_LINES_P3, computeIllinois, ilUseTaxTable } from '../engine/il2025.ts'
import { IL_GIFT, buildIlPacket } from '../pdf/il2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import { ExplainItems } from './creditrows'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Federally tax-exempt interest'], ['3', 'Other additions (Schedule M)'],
  ['5', 'Social Security and retirement income'], ['6', 'Illinois refund included'], ['7', 'Other subtractions (Schedule M)'],
  ['9', 'Illinois base income'], ['10', 'Exemption allowance'], ['11', 'Net income'], ['12', 'Tax (4.95%)'],
  ['18', 'Nonrefundable credits'], ['19', 'Tax after credits'], ['21', 'Use tax'], ['24', 'Total tax'],
  ['25', 'Illinois tax withheld'], ['26', 'Estimated payments'], ['27', 'Pass-through withholding'],
  ['29', 'Illinois EITC'], ['30', 'Illinois Child Tax Credit'], ['31', 'Total payments and credits'],
  ['35', 'Donations'], ['40', 'Credited to 2026'], ['41', 'Amount you owe'], ['38', 'Refund']
]
const ALWAYS = new Set(['1', '9', '11', '12', '24', '31'])
const KEY = new Set(['9', '11', '24', '41', '38'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function IllinoisStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.il
  const il = useMemo(() => computeIllinois(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<IlInput>): void => set((r) => ({ ...r, il: { ...r.il, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildIlPacket(ret, result, il, preparer)
  const L = il.lines
  const owes = L['41'] > 0
  const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadIllinoisForms }) => downloadIllinoisForms(ret, result, il, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }

  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Illinois: you owe' : 'Illinois refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['41'] : L['38'])}</p>
        </div>
        <dl>
          <div><dt>Base income</dt><dd>{usd(L['9'])}</dd></div>
          <div><dt>Net income</dt><dd>{usd(L['11'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['24'])}</dd></div>
        </dl>
      </div>

      <Section title="Illinois return" intro={`Illinois taxes income at a flat 4.95% after an exemption of $2,850 for each person (${usd(L['10'])} for your household). Social Security and retirement income are not taxed.`}>
        <div className="grid">
          <TextField label="County" value={d.county} onChange={(s) => put({ county: s })} />
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}’s date of birth`} placeholder="MM/DD/YYYY" autoComplete="off" value={d.birthDate[o]} onChange={(s) => put({ birthDate: { ...d.birthDate, [o]: date(s) } })} />
          ))}
          {ret.dependents.map((dep, i) => (
            <TextField key={dep.id} label={`${dep.name.trim() || `Dependent ${i + 1}`}’s date of birth`} placeholder="MM/DD/YYYY" hint="Schedule IL-E/EITC" autoComplete="off"
              value={d.dependentBirthDates[dep.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [dep.id]: date(s) } })} />
          ))}
        </div>
      </Section>

      <Section title="Illinois tax withheld and paid" intro="Illinois tax withheld shows in W-2 box 17 (state IL).">
        <div className="grid">
          <MoneyField label="Illinois income tax withheld" value={d.withholding} onChange={(n) => put({ withholding: n })} />
          <MoneyField label="Estimated payments" hint="IL-1040-ES and IL-505-I, with any 2024 overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Pass-through withholding" hint="Schedule K-1-P or K-1-T" value={d.passThroughWithholding} onChange={(n) => put({ passThroughWithholding: n })} />
        </div>
      </Section>

      <Section title="Income Illinois treats differently">
        <div className="grid">
          <MoneyField label="Illinois tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. Treasury and agency obligations" hint="Schedule M line 22" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Bright Start / Bright Directions contributions" hint={`Up to ${joint ? '$20,000' : '$10,000'} (Schedule M line 13)`} value={d.collegeSavings} onChange={(n) => put({ collegeSavings: n })} />
          <ExplainItems ret={ret} set={set} k="il.collegeSavings" setTotal={(r, n) => ({ ...r, il: { ...r.il, collegeSavings: n } })} lines={[IL_GIFT, "Your own or family account"]} lineLabel="Account" descriptionLabel="Account number" summary="List each account (fills line 13a)" />
          <MoneyField label="Other additions (Schedule M)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <ExplainItems ret={ret} set={set} k="il.otherAdditions" setTotal={(r, n) => ({ ...r, il: { ...r.il, otherAdditions: n } })} />
          <MoneyField label="Other subtractions (Schedule M)" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
          <ExplainItems ret={ret} set={set} k="il.otherSubtractions" setTotal={(r, n) => ({ ...r, il: { ...r.il, otherSubtractions: n } })} lines={[...IL_SUBTRACTION_LINES_P2, ...IL_SUBTRACTION_LINES_P3, "Not on a Schedule M line"]} summary="List each item with its Schedule M line" />
        </div>
      </Section>

      <Section title="Credits">
        <dl className="facts">
          <div><dt>Illinois EITC (20% of federal)</dt><dd>{usd(L['29'])}</dd></div>
          <div><dt>Illinois Child Tax Credit</dt><dd>{usd(L['30'])}</dd></div>
        </dl>
        <div className="grid">
          <MoneyField label="Property tax and K-12 education credits (Schedule ICR)" hint="5% of property tax on your main home; 25% of K-12 expenses over $250" value={d.icrCredit} onChange={(n) => put({ icrCredit: n })} />
          <MoneyField label="Tax paid to another state (Schedule CR)" value={d.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <MoneyField label="Schedule 1299-C credits" value={d.otherCredits} onChange={(n) => put({ otherCredits: n })} />
        </div>
      </Section>

      <Section title="Use tax and refund" intro="Line 21 cannot be left blank: enter use tax on untaxed out-of-state purchases, or 0.">
        <div className="checks">
          <Check label={`Use the UT Table (${usd(ilUseTaxTable(L['1']))} for your income)`} hint="If you had no major purchases" checked={d.useTaxTable} onChange={(on) => put({ useTaxTable: on })} />
        </div>
        <div className="grid">
          {!d.useTaxTable && <MoneyField label="Use tax owed" value={d.useTax} onChange={(n) => put({ useTax: n })} />}
          <MoneyField label="Voluntary donations (Schedule G)" value={d.donations} onChange={(n) => put({ donations: n })} />
          {L['37'] > 0 && <MoneyField label="Credit forward to 2026" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      {il.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{il.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form IL-1040" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Illinois forms" intro="Filled in on this device from the official Illinois Department of Revenue PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Illinois forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2 and staple W-2s and 1099s with Illinois withholding to page 1. Returns are due April 15, 2026. Illinois offers free e-filing through MyTax Illinois.</p>
      </Section>
    </div>
  )
}
