/** Portable, non-filing federal reconciliation package. Never contains taxpayer identifiers. */
export type ReviewAmounts2025 = Record<string, string>
export interface ReviewPackage2025 {
  schema: 'ustaxes-federal-review-2025/v1'
  taxYear: 2025
  filingReady: false
  amounts: ReviewAmounts2025
  checks: Record<string, boolean>
  withholdingConfirmed: boolean
  w2WithholdingCents: number | null
  status: 'blocked' | 'reconciled'
  blockers: string[]
  lines: Record<string, number> | null
}
const allowedAmounts = ['line16TaxCents','line19ChildCreditCents','line25aWithholdingCents','line25bWithholdingCents','line25cWithholdingCents','line26EstimatedPaymentsCents','line27aEicCents','line28AdditionalChildCreditCents','line29EducationCreditCents']
const allowedChecks = ['independentTaxReview','independentCreditReview','independentPaymentReview','scheduleLineRulesReviewed']
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const money = (v: unknown): boolean => typeof v === 'string' && (v === '' || /^\d+(?:\.\d{1,2})?$/.test(v)) && v.length <= 20
const cents = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 100000000000000
const exactKeys = (o: Record<string, unknown>, keys: string[]): boolean => Object.keys(o).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(o,k))
export function parseFederalReviewPackage2025(value: unknown): ReviewPackage2025 | null {
  if (!object(value) || !exactKeys(value, ['schema','taxYear','filingReady','amounts','checks','withholdingConfirmed','w2WithholdingCents','status','blockers','lines'])) return null
  if (value.schema !== 'ustaxes-federal-review-2025/v1' || value.taxYear !== 2025 || value.filingReady !== false) return null
  if (!object(value.amounts) || !exactKeys(value.amounts, allowedAmounts) || !allowedAmounts.every(k => money((value.amounts as Record<string,unknown>)[k]))) return null
  if (!object(value.checks) || !exactKeys(value.checks, allowedChecks) || !allowedChecks.every(k => typeof (value.checks as Record<string,unknown>)[k] === 'boolean')) return null
  if (typeof value.withholdingConfirmed !== 'boolean' || !(value.w2WithholdingCents === null || cents(value.w2WithholdingCents))) return null
  if (value.status !== 'blocked' && value.status !== 'reconciled') return null
  if (!Array.isArray(value.blockers) || value.blockers.length > 100 || !value.blockers.every(x => typeof x === 'string' && x.length <= 500)) return null
  if (!(value.lines === null || (object(value.lines) && Object.keys(value.lines).length <= 100 && Object.entries(value.lines).every(([k,v]) => /^\d{1,2}[a-z]?$/.test(k) && cents(v))))) return null
  // Imported confirmations are deliberately not trusted as current calculations.
  return value as unknown as ReviewPackage2025
}
export function reviewLinesCsv2025(lines: Record<string,number> | null): string {
  const rows = ['Tax year,Form,Line,Amount USD,Status']
  if (lines) Object.keys(lines).sort((a,b) => a.localeCompare(b, 'en', {numeric:true})).forEach(line => {
    rows.push(`2025,1040,${line},${(lines[line]/100).toFixed(2)},RECONCILED_NOT_FILING_READY`)
  })
  return rows.join('\r\n') + '\r\n'
}
export function reviewPrintHtml2025(status: string, blockers: string[], lines: Record<string,number> | null): string {
  const escape = (s: string): string => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
  const rows = lines ? Object.keys(lines).sort((a,b) => a.localeCompare(b,'en',{numeric:true})).map(k => `<tr><td>1040 ${escape(k)}</td><td>$${(lines[k]/100).toFixed(2)}</td></tr>`).join('') : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>2025 Federal Return Review</title><style>body{font:16px Arial,sans-serif;max-width:850px;margin:40px auto;color:#172033}h1{font-size:24px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.warning{border:2px solid #a33;padding:12px}</style></head><body><h1>2025 Federal Return Review</h1><p class="warning"><strong>NON-FILING WORKPAPER.</strong> Not an IRS form, not validated for submission, no e-file capability.</p><p>Status: ${escape(status)}</p><h2>Form 1040 arithmetic</h2><table><thead><tr><th>Line</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><h2>Outstanding blockers</h2><ul>${blockers.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></body></html>`
}
