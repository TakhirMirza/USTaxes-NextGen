import { computeOrdinaryTax2025, Filing2025 } from '../nextgen/taxYears/irs2025OrdinaryTax'
import { ReactElement, useState } from 'react'
import { parseFederalReviewPackage2025, reviewLinesCsv2025, reviewPrintHtml2025, ReviewPackage2025 } from '../nextgen/taxYears/federalReviewPackage2025'
import { FederalScheduleIncomeResult2025 } from '../nextgen/taxYears/federalScheduleIntegration2025'
import { Schedule1040Candidates2025 } from '../nextgen/taxYears/schedules1040Bridge2025'
import { calculateFederalReturnBalance2025, FederalReturnBalanceInputs2025 } from '../nextgen/taxYears/federalReturnBalance2025'

const fields = [
  ['line16TaxCents', '16 · Income tax (verified IRS method)'],
  ['line19ChildCreditCents', '19 · Child/dependent credit'],
  ['line25aWithholdingCents', '25a · W-2 withholding'],
  ['line25bWithholdingCents', '25b · 1099 withholding'],
  ['line25cWithholdingCents', '25c · Other withholding'],
  ['line26EstimatedPaymentsCents', '26 · Estimated tax payments'],
  ['line27aEicCents', '27a · Earned income credit'],
  ['line28AdditionalChildCreditCents', '28 · Additional child credit'],
  ['line29EducationCreditCents', '29 · Refundable education credit']
] as const

type AmountField = typeof fields[number][0]
type Reviews = 'independentTaxReview' | 'independentCreditReview' | 'independentPaymentReview' | 'scheduleLineRulesReviewed'
const reviews: { id: Reviews; title: string }[] = [
  { id: 'independentTaxReview', title: 'Line 16 tax method and amount independently verified' },
  { id: 'independentCreditReview', title: 'Credit eligibility and explicit zero amounts reviewed' },
  { id: 'independentPaymentReview', title: 'Payment records and explicit zero amounts reviewed' },
  { id: 'scheduleLineRulesReviewed', title: 'Schedules 1, 2 and 3 line classifications reviewed' }
]
const cents = (s: string): number | null => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(s.trim())) return null
  const [d, c = ''] = s.trim().split('.')
  const n = Number(d) * 100 + Number(c.padEnd(2, '0'))
  return Number.isSafeInteger(n) && n <= 100000000000000 ? n : null
}
const dollars = (n: number): string => (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function NextGen2025FederalReturn({ income, schedules, w2WithholdingCents }: {
  income: FederalScheduleIncomeResult2025
  schedules: Schedule1040Candidates2025
  w2WithholdingCents: number | null
}): ReactElement {
  const [amounts, setAmounts] = useState<Record<AmountField, string>>({
    line16TaxCents: '', line19ChildCreditCents: '', line25aWithholdingCents: '',
    line25bWithholdingCents: '', line25cWithholdingCents: '', line26EstimatedPaymentsCents: '',
    line27aEicCents: '', line28AdditionalChildCreditCents: '', line29EducationCreditCents: ''
  })
  const [checks, setChecks] = useState<Record<Reviews, boolean>>({
    independentTaxReview: false, independentCreditReview: false,
    independentPaymentReview: false, scheduleLineRulesReviewed: false
  })
  const [withholdingConfirmed, setWithholdingConfirmed] = useState(false)
  const [worksheetStatus, setWorksheetStatus] = useState<Filing2025>('single')
  const [worksheetTaxable, setWorksheetTaxable] = useState('')
  const [worksheetOrdinaryOnly, setWorksheetOrdinaryOnly] = useState(false)
  const [worksheetLine15Reviewed, setWorksheetLine15Reviewed] = useState(false)

  const [reviewImport, setReviewImport] = useState('')
  const [reviewNotice, setReviewNotice] = useState('')
  const parsed = Object.fromEntries(fields.map(([id]) => [id, cents(amounts[id])])) as Record<AmountField, number | null>
  const w2Mismatch = withholdingConfirmed && (w2WithholdingCents === null || parsed.line25aWithholdingCents !== w2WithholdingCents)
  const input: FederalReturnBalanceInputs2025 = { income, schedules, ...parsed, ...checks }
  const result = calculateFederalReturnBalance2025(input)
  const blockers = [...result.blockers, ...(!withholdingConfirmed ? ['W-2 withholding source reconciliation must be confirmed.'] : []), ...(w2Mismatch ? ['Form 1040 line 25a does not equal W-2 box 2 withholding total.'] : [])]
  const reconciled = result.status === 'reconciled' && blockers.length === 0
  const reviewPackage = (): ReviewPackage2025 => ({
    schema: 'ustaxes-federal-review-2025/v1', taxYear: 2025, filingReady: false,
    amounts, checks, withholdingConfirmed, w2WithholdingCents,
    status: reconciled ? 'reconciled' : 'blocked', blockers,
    lines: reconciled && result.status === 'reconciled' ? result.lines : null
  })
  const download = (name: string, content: string, mime: string): void => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }
  const exportReview = (): void => download('ustaxes-2025-federal-review.json', JSON.stringify(reviewPackage(), null, 2), 'application/json')
  const importReview = (): void => {
    try {
      const imported = parseFederalReviewPackage2025(JSON.parse(reviewImport))
      if (!imported) { setReviewNotice('Import rejected: unsupported or invalid 2025 review package.'); return }
      setAmounts(imported.amounts as Record<AmountField,string>)
      // Confirmations must be repeated after import, never inherited from a file.
      setChecks({ independentTaxReview: false, independentCreditReview: false, independentPaymentReview: false, scheduleLineRulesReviewed: false })
      setWithholdingConfirmed(false)
      setReviewImport('')
      setReviewNotice('Amounts restored. All confirmations reset; reconcile against current sources again.')
    } catch { setReviewNotice('Import rejected: invalid JSON.') }
  }
  const worksheetIncome = cents(worksheetTaxable)
  const worksheet = computeOrdinaryTax2025({year:2025, filingStatus:worksheetStatus,
    taxableIncomeCents:worksheetIncome === null ? -1 : worksheetIncome,
    ordinaryIncomeOnlyConfirmed:worksheetOrdinaryOnly, line15Reconciled:worksheetLine15Reviewed})
  const useWorksheet = (): void => {
    if (worksheet.status !== 'calculated') return
    setAmounts(p => ({...p,line16TaxCents:(worksheet.line16Cents/100).toFixed(2)}))
    setChecks(p => ({...p,independentTaxReview:false}))
    setReviewNotice('IRS worksheet amount copied to line 16. Independently review tax method and source reconciliation before confirming.')
  }
  return <section className="v2-card" aria-label="Federal Form 1040 integrated return review">
    <span className="v2-eyebrow">2025 / INTEGRATED FEDERAL RETURN</span>
    <h2>Form 1040 — tax, credits, payments and balance</h2>
    <p>Enter independently verified amounts for lines 16–29. Leave a field empty when unknown; enter 0 only after confirming it does not apply. This workpaper does not determine eligibility or permit filing.</p>
    <details className="v2-note"><summary><strong>2025 IRS line 16 calculator — taxable income $100,000 or more</strong></summary>
      <p>Only for ordinary-income returns. Below $100,000 requires the IRS Tax Table. Special tax methods are not supported. This does not validate deductions or other Form 1040 lines.</p>
      <div className="v2-form-grid">
        <label>Filing status<select value={worksheetStatus} onChange={e=>setWorksheetStatus(e.target.value as Filing2025)}>
          <option value="single">Single</option><option value="marriedJoint">Married filing jointly</option>
          <option value="marriedSeparate">Married filing separately</option><option value="headOfHousehold">Head of household</option>
          <option value="qualifyingSurvivingSpouse">Qualifying surviving spouse</option></select></label>
        <label>Form 1040 line 15 — verified taxable income ($)<input inputMode="decimal" value={worksheetTaxable} onChange={e=>setWorksheetTaxable(e.target.value)} placeholder="100000.00" /></label>
      </div>
      <label className="v2-check"><input type="checkbox" checked={worksheetLine15Reviewed} onChange={e=>setWorksheetLine15Reviewed(e.target.checked)}/>Line 15 reconciled to actual source documents and deductions</label>
      <label className="v2-check"><input type="checkbox" checked={worksheetOrdinaryOnly} onChange={e=>setWorksheetOrdinaryOnly(e.target.checked)}/>I confirmed no qualified dividends, capital gains, or other special tax methods apply</label>
      {worksheet.status==='calculated' ? <p>IRS worksheet line 16: <strong>{dollars(worksheet.line16Cents)}</strong> ({worksheet.ratePercent}% row)</p>
        : <ul className="v2-blockers">{worksheet.blockers.map(b=><li key={b}>{b}</li>)}</ul>}
      <button type="button" className="v2-secondary" disabled={worksheet.status!=='calculated'} onClick={useWorksheet}>Copy calculated amount to line 16 (requires separate review)</button>
    </details>
    <div className="v2-form-grid">{fields.map(([id, title]) => <label key={id}>{title}<input type="text" inputMode="decimal" placeholder="Required: 0.00 or amount" value={amounts[id]} onChange={e => setAmounts(p => ({ ...p, [id]: e.target.value }))} /></label>)}</div>
    <div className="v2-note">W-2 box 2 source withholding: {w2WithholdingCents === null ? 'Unavailable' : dollars(w2WithholdingCents)}. The entered line 25a must match the W-2 source total.</div>
    <label className="v2-check"><input type="checkbox" checked={withholdingConfirmed} onChange={e => setWithholdingConfirmed(e.target.checked)}/>I have reconciled line 25a to the entered W-2 withholding records.</label>
    {reviews.map(({ id, title }) => <label className="v2-check" key={id}><input type="checkbox" checked={checks[id]} onChange={e => setChecks(p => ({ ...p, [id]: e.target.checked }))}/>{title}</label>)}
    <h3>{reconciled ? 'Arithmetic reconciled — not filing ready' : 'Calculation blocked pending review'}</h3>
    {reconciled && result.status === 'reconciled' && <div className="v2-review-grid">{Object.entries(result.lines).map(([line, amount]) => <div key={line}><span>Form 1040 line {line}</span><strong>{dollars(amount)}</strong></div>)}</div>}
    {blockers.length > 0 && <ul className="v2-blockers">{blockers.map((reason, i) => <li key={`${i}-${reason}`}>{reason}</li>)}</ul>}
    <h3>Complete review package — exports and restore</h3>
    <p>Export the versioned review, line-by-line CSV for audit, or a printable HTML workpaper. Imported amounts must be independently confirmed again.</p>
    <div className="v2-form-grid">
      <button type="button" className="v2-secondary" onClick={exportReview}>Export review JSON</button>
      <button type="button" className="v2-secondary" onClick={() => download('ustaxes-2025-1040-lines.csv', reviewLinesCsv2025(reconciled && result.status === 'reconciled' ? result.lines : null), 'text/csv')}>Export Form 1040 lines CSV</button>
      <button type="button" className="v2-secondary" onClick={() => download('ustaxes-2025-review-print.html', reviewPrintHtml2025(reconciled ? 'Reconciled — not filing ready' : 'Blocked', blockers, reconciled && result.status === 'reconciled' ? result.lines : null), 'text/html')}>Export printable workpaper</button>
    </div>
    <label>Import previous review JSON (amounts only)
      <textarea rows={4} value={reviewImport} onChange={e => setReviewImport(e.target.value)} placeholder="Paste exported federal review JSON" />
    </label>
    <button type="button" className="v2-secondary" onClick={importReview}>Restore reviewed amounts</button>
    {reviewNotice && <div className="v2-note" role="status">{reviewNotice}</div>}
    <div className="v2-note"><strong>Not filing ready.</strong> No SSN or personal identity is collected here. A successful arithmetic reconciliation does not validate IRS eligibility, produce an official PDF, or submit a return. Do not enter actual confidential taxpayer information on this static preview.</div>
  </section>
}
