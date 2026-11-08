import type { CalcReport, NodeId } from './calculationPipeline'

/** Diagnostic mapping only. No authoritative IRS form values are created. */
export type MappingStatus = 'candidate' | 'blocked' | 'not-implemented'
export interface MappingLine { line: string; label: string; source: readonly NodeId[]; status: MappingStatus; cents: number | null; findings: readonly string[] }
export interface MappingReport { year: string; lines: readonly MappingLine[]; candidates: number; blocked: number; notImplemented: number; postingEnabled: false; filingEnabled: false }
interface MappingDefinition { line: string; label: string; source: readonly NodeId[]; implementation: 'arithmetic-preview' | 'not-implemented'; reason?: string }
const DEFINITIONS: readonly MappingDefinition[] = [
  { line: '1a', label: 'W-2 wages — source candidate', source: ['wages'], implementation: 'arithmetic-preview' },
  { line: '2b', label: 'Taxable interest — source candidate', source: ['interest'], implementation: 'arithmetic-preview' },
  { line: '8', label: 'Schedule 1 additional income', source: ['business'], implementation: 'not-implemented', reason: 'Schedule 1 includes categories and adjustments not modeled by this workbench.' },
  { line: '9', label: 'Total income', source: ['totalIncome'], implementation: 'not-implemented', reason: 'Known-source subtotal is not complete Form 1040 income.' },
  { line: '10', label: 'Adjustments to income', source: ['adjustments'], implementation: 'not-implemented', reason: 'Schedule 1 adjustments require verified eligibility and full coverage.' },
  { line: '11a', label: 'Adjusted gross income', source: ['agi'], implementation: 'not-implemented', reason: 'Arithmetic AGI preview excludes unsupported income and adjustments.' },
  { line: '12e', label: 'Deduction', source: ['deductions'], implementation: 'not-implemented', reason: 'Deduction selection, eligibility and tax-year rules are not verified.' },
  { line: '15', label: 'Taxable income', source: ['taxableIncome'], implementation: 'not-implemented', reason: 'Taxable income requires complete and verified deductions and AGI.' },
  { line: '16', label: 'Income tax', source: ['taxableIncome'], implementation: 'not-implemented', reason: 'IRS tax tables and special tax methods are not implemented.' },
  { line: '23', label: 'Other taxes', source: ['otherTaxes'], implementation: 'not-implemented', reason: 'Schedule 2 coverage and tax rules are incomplete.' },
  { line: '24', label: 'Total tax', source: ['credits', 'otherTaxes'], implementation: 'not-implemented', reason: 'Tax, credits and other taxes are not authoritatively computed.' },
  { line: '25a', label: 'W-2 federal withholding — source candidate', source: ['withholding'], implementation: 'arithmetic-preview' },
  { line: '26', label: 'Estimated tax payments — source candidate', source: ['estimatedPayments'], implementation: 'arithmetic-preview' },
  { line: '33', label: 'Total payments', source: ['totalPayments'], implementation: 'not-implemented', reason: 'Known-source subtotal excludes other payments and refundable credits.' },
  { line: '34', label: 'Overpayment', source: ['totalPayments'], implementation: 'not-implemented', reason: 'Refund calculation requires verified total tax and total payments.' },
  { line: '37', label: 'Amount owed', source: ['totalPayments'], implementation: 'not-implemented', reason: 'Balance due requires verified total tax and total payments.' },
]
export function mapForm1040(report: CalcReport): MappingReport {
  const nodes = new Map(report.nodes.map(node => [node.id, node]))
  const lines = DEFINITIONS.map(def => {
    const unavailable = def.source.filter(id => nodes.get(id)?.state !== 'known')
    const status: MappingStatus = def.implementation === 'not-implemented' ? 'not-implemented' : unavailable.length || !report.supported ? 'blocked' : 'candidate'
    const findings = [
      ...unavailable.map(id => `${id}: ${nodes.get(id)?.state ?? 'missing'}`),
      ...(!report.supported ? [`Tax year ${report.year} is unsupported.`] : []),
      ...(def.reason ? [def.reason] : []),
      ...(status === 'candidate' ? ['Source candidate only; not a posted or validated Form 1040 amount.'] : []),
    ]
    const node = def.source.length === 1 ? nodes.get(def.source[0]) : undefined
    return { line: def.line, label: def.label, source: def.source, status, cents: status === 'candidate' && node?.state === 'known' ? node.cents : null, findings }
  })
  return { year: report.year, lines, candidates: lines.filter(l => l.status === 'candidate').length, blocked: lines.filter(l => l.status === 'blocked').length, notImplemented: lines.filter(l => l.status === 'not-implemented').length, postingEnabled: false, filingEnabled: false }
}
const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
export function mappingCsv(report: MappingReport): string {
  const rows = [['tax_year','form_line','status','source_nodes','candidate_cents','findings'], ...report.lines.map(l => [report.year,l.line,l.status,l.source.join('|'),l.cents === null ? '' : String(l.cents),l.findings.join('|')])]
  return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
export function runMappingFixtures(): { name: string; passed: boolean }[] {
  const known = (year: string) => ({ year, supported: year === '2025', postingEnabled: false as const, filingEnabled: false as const, nodes: (['wages','interest','business','adjustments','deductions','credits','otherTaxes','withholding','estimatedPayments','totalIncome','agi','taxableIncome','totalPayments'] as NodeId[]).map(id => ({ id, label: id, dependencies: [] as NodeId[], state: 'known' as const, cents: 0, issues: [] as string[] })), blockers: [] as string[], known: 13, unresolved: 0 })
  const complete = mapForm1040(known('2025'))
  const missing = known('2025'); missing.nodes = missing.nodes.filter(n => n.id !== 'wages')
  const incomplete = mapForm1040(missing)
  const unknown = mapForm1040(known('2035'))
  return [
    { name: 'Mapping includes 16 explicit lines', passed: complete.lines.length === 16 },
    { name: 'Known zero is a valid source candidate', passed: complete.lines.find(l => l.line === '1a')?.cents === 0 },
    { name: 'Missing W-2 wages remain blocked', passed: incomplete.lines.find(l => l.line === '1a')?.status === 'blocked' },
    { name: 'Missing W-2 wages never become zero', passed: incomplete.lines.find(l => l.line === '1a')?.cents === null },
    { name: 'Income tax is not implemented', passed: complete.lines.find(l => l.line === '16')?.status === 'not-implemented' },
    { name: 'Refund and amount owed are never inferred', passed: ['34','37'].every(id => complete.lines.find(l => l.line === id)?.cents === null) },
    { name: 'Unknown tax year cannot produce candidates', passed: unknown.candidates === 0 },
    { name: 'Mapping never authorizes posting or filing', passed: !complete.postingEnabled && !complete.filingEnabled },
    { name: 'CSV includes source lineage', passed: mappingCsv(complete).includes('source_nodes') },
  ]
}
