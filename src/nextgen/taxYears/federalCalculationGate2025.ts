/** 2025 federal calculation readiness gate. Diagnostics only; never a tax liability computation. */
import { BridgeInput2025, buildForm1040IncomeBridge2025 } from './form1040IncomeBridge2025'

export type GateSeverity2025 = 'blocker' | 'review' | 'info'
export interface GateFinding2025 { id: string; severity: GateSeverity2025; area: 'income' | 'schedules' | 'deductions' | 'credits' | 'payments' | 'coverage'; message: string; nextStep: string }
export interface GateRow2025 { key: string; label: string; status: 'verified-source' | 'needs-review' | 'not-implemented'; note: string }
export interface GateReport2025 { findings: GateFinding2025[]; rows: GateRow2025[]; blockers: number; reviews: number; complete: false; filingEnabled: false }

const row = (key: string, label: string, status: GateRow2025['status'], note: string): GateRow2025 => ({key,label,status,note})
export function evaluateFederalCalculationGate2025(input: BridgeInput2025): GateReport2025 {
  const bridge = buildForm1040IncomeBridge2025(input)
  const findings: GateFinding2025[] = []
  const add = (id: string, severity: GateSeverity2025, area: GateFinding2025['area'], message: string, nextStep: string): void => {
    if (!findings.some(f => f.id === id)) findings.push({id,severity,area,message,nextStep})
  }
  if (input.year !== '2025') add('UNSUPPORTED_YEAR','blocker','coverage','The 2025 federal calculation gate does not support this tax year.','Select the supported development year.')
  for (const line of bridge.lines.filter(l => !l.line.endsWith('-preview'))) {
    if (line.status === 'unresolved' || line.status === 'invalid') add(`SOURCE_${line.line}`, 'blocker','income',`Form 1040 line ${line.line}: ${line.status} source evidence.`, 'Review source documents and schedule reconciliation.')
  }
  if (input.upstreamBlockers.length) add('UPSTREAM','blocker','schedules',`${input.upstreamBlockers.length} upstream schedule blockers remain.`, 'Resolve schedule review findings.')
  if (!input.scheduleReconciled || input.schedule.blocked) add('SCHEDULE_RECONCILIATION','blocker','schedules','Schedule 1 has not passed the source reconciliation gate.','Reconcile Schedule 1 before posting amounts.')
  if (input.wagesSelected && input.wageRows.length === 0) add('MISSING_W2','blocker','income','W-2 was selected but no wage document exists.','Add a fictional W-2 for testing.')
  if (input.interestSelected && !input.payer.trim()) add('MISSING_PAYER','blocker','income','1099-INT was selected but its payer is missing.','Complete the fictional interest document.')
  const unmodeled: [string, GateFinding2025['area'], string][] = [
    ['OTHER_INCOME','income','Other income categories (Form 1040 lines 1b–1i, 2a, 3–7) are not comprehensively supported.'],
    ['DEDUCTION_ELIGIBILITY','deductions','Standard/itemized deduction selection, eligibility and limitations are not fully validated.'],
    ['QBI_DEDUCTION','deductions','Qualified business income deduction is not calculated or verified.'],
    ['TAX_TABLE','coverage','Tax table and tax computation worksheets are not certified for filing.'],
    ['CREDITS','credits','Nonrefundable and refundable credits are not comprehensively computed.'],
    ['ADDITIONAL_TAXES','schedules','Schedule 2 additional taxes and special taxes are not comprehensively computed.'],
    ['PAYMENTS','payments','All payments, estimated taxes, and refundable credits are not comprehensively reconciled.'],
    ['DEPENDENTS','coverage','Dependent eligibility and filing status have not been independently validated.'],
    ['IRS_APPROVAL','coverage','2025 IRS instructions, worksheets and edge cases require independent verification.']
  ]
  for (const [id, area, message] of unmodeled) add(id,'blocker',area,message,'Complete the relevant calculation module and independent tax-rule tests.')
  const rows: GateRow2025[] = bridge.lines.filter(l => !l.line.endsWith('-preview')).map(l => row(l.line,`Form 1040 line ${l.line}: ${l.label}`,l.status === 'established' || l.status === 'not-applicable' ? 'verified-source' : 'needs-review', l.note))
  rows.push(row('9/11','Total income and AGI','not-implemented','Known-source subtotals are not complete IRS Form 1040 totals.'))
  rows.push(row('12–15','Deductions and taxable income','not-implemented','Eligibility, thresholds, and deduction choice are not fully modeled.'))
  rows.push(row('16–24','Tax, credits, and total tax','not-implemented','Tax table and credit calculations require independent verification.'))
  rows.push(row('25–33','Payments and total payments','not-implemented','Only W-2 withholding source is partially mapped.'))
  rows.push(row('34–37','Refund and amount owed','not-implemented','No refund or balance due may be represented as final.'))
  return { findings, rows, blockers: findings.filter(f=>f.severity==='blocker').length, reviews: findings.filter(f=>f.severity==='review').length, complete:false, filingEnabled:false }
}
/** Privacy-safe: neither taxpayer labels nor financial amounts are exported. */
export function calculationGateCsv2025(report: GateReport2025): string {
  const q=(s:string):string=>'"'+s.replace(/"/g,'""').replace(/[\r\n]/g,' ')+'"'
  return ['item,status',...report.rows.map(r=>[q(r.key),q(r.status)].join(','))].join('\r\n')+'\r\n'
}
