import { ReactElement, useState } from 'react'
import { Form1040Mapping2025, parseDollarsToCents2025 } from '../nextgen/taxYears/taxEngineCore2025'
import { reconcileForm1040Arithmetic2025, VerifiedTaxComponents2025 } from '../nextgen/taxYears/form1040Arithmetic2025'
import { WorksheetTax2025 } from '../nextgen/taxYears/irsTaxComputationWorksheet2025'

type Field = keyof VerifiedTaxComponents2025
const components: { key: Field; line: string; label: string }[] = [
  { key: 'line16TaxCents', line: '16', label: 'Income tax from an independently verified IRS method' },
  { key: 'line17Schedule2Part1Cents', line: '17', label: 'Schedule 2, Part I — additional tax' },
  { key: 'line19ChildTaxCreditCents', line: '19', label: 'Child tax credit / credit for other dependents' },
  { key: 'line20Schedule3Part1Cents', line: '20', label: 'Schedule 3, Part I — nonrefundable credits' },
  { key: 'line23OtherTaxesCents', line: '23', label: 'Schedule 2, Part II — other taxes' },
  { key: 'line26EstimatedPaymentsCents', line: '26', label: 'Estimated tax payments' },
  { key: 'line27aEarnedIncomeCreditCents', line: '27a', label: 'Earned income credit' },
  { key: 'line28AdditionalChildTaxCreditCents', line: '28', label: 'Additional child tax credit' },
  { key: 'line29EducationCreditCents', line: '29', label: 'Refundable education credit' },
  { key: 'line31OtherPaymentsCents', line: '31', label: 'Schedule 3, Part II — other payments' }
]
const format = (cents: number): string => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Educational reconciliation of independently reviewed values, never a filing or eligibility determination. */
export default function NextGen2025TaxBalance({ mapping, worksheet }: { mapping: Form1040Mapping2025; worksheet: WorksheetTax2025 }): ReactElement {
  const [values, setValues] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState(false)
  const parsed = components.map(({ key }) => ({ key, cents: parseDollarsToCents2025((values[key] || '').trim()) }))
  const incomplete = parsed.filter(({ cents }) => cents === null).map(({ key }) => components.find(field => field.key === key)!.line)
  const verified = incomplete.length === 0 ? parsed.reduce((result, item) => ({ ...result, [item.key]: item.cents }), {} as VerifiedTaxComponents2025) : null
  const reconciliation = reconcileForm1040Arithmetic2025(mapping, verified, confirmed && incomplete.length === 0)
  const update = (key: Field, value: string): void => { setValues(old => ({ ...old, [key]: value })); setConfirmed(false) }
  const useWorksheet = (): void => {
    if (worksheet.status !== 'computed') return
    update('line16TaxCents', String(worksheet.line16TaxDollars))
  }
  return <section className="v2-card">
    <span className="v2-eyebrow">2025 / FORM 1040 / TAX AND PAYMENT RECONCILIATION</span>
    <h2>Federal tax, credits and payment balance</h2>
    <p>Enter <strong>fictional, independently reviewed</strong> Form 1040 components. All ten fields are required, including an explicit 0 when a verified component does not apply. Blank fields are never assumed to be zero.</p>
    <div className="v2-note"><strong>Source mapping:</strong> {mapping.status === 'mapped' ? 'Available for this restricted example' : 'Blocked — review the source mapping above first'}. The amounts below are not independently verified by this app.</div>
    {worksheet.status === 'computed' && <div className="v2-note">The restricted IRS 2025 worksheet calculated line 16 as {format(worksheet.line16TaxDollars * 100)}. <button type="button" className="v2-secondary" onClick={useWorksheet}>Copy worksheet result into line 16</button> Review the method independently before confirming.</div>}
    <div className="v2-form-grid">{components.map(field => <label key={field.key}>Line {field.line} — {field.label} ($)<input inputMode="decimal" value={values[field.key] || ''} placeholder="Enter amount or explicit 0" onChange={event => update(field.key, event.target.value)} /></label>)}</div>
    {incomplete.length > 0 && <p className="v2-inline-warning">Missing or invalid amounts on lines: {incomplete.join(', ')}. Use nonnegative dollars with no more than two decimal places.</p>}
    <label className="v2-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I independently reviewed the source, eligibility and correct IRS treatment of every entered component for this fictional scenario. This is not a filing authorization.</label>
    {reconciliation.status === 'reconciled' && reconciliation.lines ? <>
      <div className="v2-review-grid">{['16', '18', '21', '22', '24', '25d', '32', '33', '34', '37'].map(line => <div key={line}><span>Form 1040 line {line}</span><strong>{format(reconciliation.lines![line])}</strong></div>)}</div>
      <div className="v2-note"><strong>Arithmetic reconciled — NOT FILING READY.</strong> This is a mathematical consistency check of manually confirmed fictional inputs, not an IRS-certified tax calculation, refund, or payment instruction.</div>
    </> : <div className="v2-note"><strong>Arithmetic blocked.</strong> {reconciliation.blockers.join(' ')} No refund or balance due is displayed without a valid source mapping and all independently reviewed inputs.</div>}
  </section>
}
