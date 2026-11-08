import { auditFederalCalculationIntegrity2025, IntegrityInput2025 } from './federalCalculationIntegrity2025'

/** Diagnostics only: no taxpayer names, identifiers, or monetary values are exported. */
export type ExceptionItem2025 = {
  id: string
  severity: 'blocker' | 'review' | 'coverage'
  category: 'income' | 'deductions' | 'tax' | 'payments' | 'coverage'
  title: string
  detail: string
  action: 'income' | 'deductions' | 'none'
}
export function buildFederalExceptionRegister2025(input: IntegrityInput2025) {
  const audit = auditFederalCalculationIntegrity2025(input)
  const items: ExceptionItem2025[] = audit.issues.map(issue => {
    const isDeduction = issue.source === 'Schedule A' || issue.source === 'deductions' || issue.id.startsWith('A_')
    const isPayment = issue.id.includes('WITHHOLDING') || issue.source.includes('25a')
    const category: ExceptionItem2025['category'] = isDeduction ? 'deductions' : isPayment ? 'payments' : issue.id === 'TAX_RULES_NOT_CERTIFIED' ? 'coverage' : 'income'
    return { id: issue.id, severity: issue.severity === 'blocked' ? 'blocker' : 'review', category, title: issue.id.replace(/_/g, ' '), detail: issue.message, action: isDeduction ? 'deductions' : category === 'coverage' ? 'none' : 'income' }
  })
  const mandatory: ExceptionItem2025[] = [
    {id:'FORM_1040_FULL_SCOPE',severity:'coverage',category:'coverage',title:'Full Form 1040 coverage',detail:'All applicable Form 1040 lines, schedules and filing requirements have not been certified.',action:'none'},
    {id:'IRS_2025_RULES',severity:'coverage',category:'tax',title:'Tax-year rules and line 16',detail:'Tax tables, special tax methods, credits and deduction limits require independent verification.',action:'none'},
    {id:'PAYMENTS_REFUND',severity:'coverage',category:'payments',title:'Payments and refund',detail:'Complete payment reconciliation and refund/amount owed cannot be approved from the restricted source preview.',action:'none'},
    {id:'EFILE_UNAVAILABLE',severity:'coverage',category:'coverage',title:'IRS filing unavailable',detail:'No IRS submission, certified PDF, or e-file authorization is implemented.',action:'none'},
  ]
  const seen = new Set(items.map(i => i.id))
  for (const entry of mandatory) if (!seen.has(entry.id)) items.push(entry)
  const priority = { blocker: 0, coverage: 1, review: 2 }
  items.sort((a,b) => priority[a.severity]-priority[b.severity] || a.id.localeCompare(b.id))
  const counts = { blocker: items.filter(i=>i.severity==='blocker').length, coverage: items.filter(i=>i.severity==='coverage').length, review: items.filter(i=>i.severity==='review').length }
  return { items, counts, filingReady: false as const, checked: audit.checked }
}
export function exceptionRegisterCsv2025(items: ExceptionItem2025[]) {
  const cell = (v: string) => `"${v.replace(/"/g,'""')}"`
  return [['Severity','Code','Category','Finding','Next step'],...items.map(i=>[i.severity,i.id,i.category,i.detail,i.action])].map(row=>row.map(cell).join(',')).join('\r\n')
}
