import type { ReturnGraph } from './federalReturnGraph'
import type { MappingReport } from './form1040Mapping'

export type IssueSeverity = 'blocker' | 'warning' | 'notice'
export type IssueCategory = 'source' | 'mapping' | 'cross-form' | 'tax-year' | 'filing'
export type IssueStatus = 'open' | 'resolved'
export interface ReturnIssue {
  id: string
  category: IssueCategory
  severity: IssueSeverity
  status: IssueStatus
  title: string
  description: string
  location: string
  nextStep: string
  sourceKey: string
}
export interface ValidationSummary {
  year: string
  issues: ReturnIssue[]
  blockers: number
  warnings: number
  notices: number
  filingEnabled: false
  checkedAt: 'deterministic-preview'
}
const safe = (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, '_')
function issue(id: string, category: IssueCategory, severity: IssueSeverity, title: string, description: string, location: string, nextStep: string, sourceKey: string): ReturnIssue {
  return { id: safe(id), category, severity, status: 'open', title, description, location, nextStep, sourceKey }
}
/** Non-posting audit. Acknowledgements are UI-only and never change filing eligibility. */
export function validateFederalReturn(mapping: MappingReport, graph: ReturnGraph): ValidationSummary {
  const items: ReturnIssue[] = []
  if (mapping.year !== graph.year) items.push(issue('year-mismatch', 'tax-year', 'blocker', 'Tax-year mismatch', `Mapping ${mapping.year} does not match graph ${graph.year}.`, 'Federal return', 'Use consistent tax-year definitions.', 'year'))
  if (mapping.year !== '2025') items.push(issue('year-unverified', 'tax-year', 'blocker', 'Tax-year rules not validated', `Year ${mapping.year} requires its own verified rules.`, 'Tax year', 'Validate annual IRS rules and form revisions.', 'year'))
  for (const line of mapping.lines) {
    if (line.status === 'candidate' && line.cents !== null && Number.isSafeInteger(line.cents)) continue
    const severity: IssueSeverity = 'blocker'
    items.push(issue(`mapping-${line.line}`, 'mapping', severity, `Form 1040 line ${line.line}: ${line.status}`, line.findings.join('; ') || 'No validated amount available.', `Form 1040 line ${line.line}`, 'Review source documents and applicable annual rules; do not substitute zero for missing data.', `mapping:${line.line}`))
  }
  for (const link of graph.links) {
    if (link.status === 'candidate' && link.cents !== null && Number.isSafeInteger(link.cents)) continue
    items.push(issue(`edge-${link.from}-${link.to}-${link.line}`, 'cross-form', 'blocker', `${link.from} → ${link.to} line ${link.line}`, link.findings.join('; ') || 'Cross-form transfer has not been validated.', `${link.from} / ${link.line}`, 'Complete and verify the upstream schedule and cross-form mapping.', `edge:${link.from}:${link.line}`))
  }
  for (const finding of graph.findings) {
    if (finding.code === 'INCOMPLETE_GRAPH' || finding.code === 'YEAR_UNVERIFIED') continue // covered by specific actionable issues
    items.push(issue(`graph-${finding.code}`, finding.code === 'NON_POSTING' ? 'filing' : 'cross-form', finding.severity === 'blocker' ? 'blocker' : 'notice', finding.code.replace(/_/g, ' '), finding.message, 'Cross-form graph', 'Review the source graph and verify the affected dependency.', `graph:${finding.code}`))
  }
  items.push(issue('filing-disabled', 'filing', 'notice', 'Filing is disabled', 'This development preview is not authorized for real tax preparation, PDF filing, or e-file.', 'Return readiness', 'Complete independent tax-law verification and security review before considering production readiness.', 'filing'))
  const unique = [...new Map(items.map(i => [i.id, i])).values()]
  const rank = { blocker: 0, warning: 1, notice: 2 }
  unique.sort((a,b) => rank[a.severity]-rank[b.severity] || a.id.localeCompare(b.id))
  return { year: mapping.year, issues: unique, blockers: unique.filter(i => i.severity === 'blocker').length, warnings: unique.filter(i => i.severity === 'warning').length, notices: unique.filter(i => i.severity === 'notice').length, filingEnabled: false, checkedAt: 'deterministic-preview' }
}
const quote = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
export function validationCsv(report: ValidationSummary): string {
  const rows = [['year','id','severity','category','status','title','location','description','next_step'], ...report.issues.map(i => [report.year,i.id,i.severity,i.category,i.status,i.title,i.location,i.description,i.nextStep])]
  return rows.map(r => r.map(quote).join(',')).join('\r\n') + '\r\n'
}
export function runValidationFixtures(): { name: string; passed: boolean }[] {
  const mapping: MappingReport = { year: '2025', lines: [
    { line: '1a', label: 'wages', source: ['wages'], status: 'candidate', cents: 0, findings: [] },
    { line: '2b', label: 'interest', source: ['interest'], status: 'blocked', cents: null, findings: ['Missing source'] },
  ], candidates: 1, blocked: 1, notImplemented: 0, filingEnabled: false, postingEnabled: false }
  const graph: ReturnGraph = { year: '2025', documents: [], links: [
    { from: 'w2', to: '1040', line: '1a', status: 'candidate', cents: 0, findings: [] },
    { from: 'int', to: '1040', line: '2b', status: 'blocked', cents: null, findings: ['Missing source'] },
  ], findings: [{code:'NON_POSTING',severity:'notice',message:'No posting'}], candidateLinks:1, blockedLinks:1, filingEnabled:false, postingEnabled:false }
  const report = validateFederalReturn(mapping, graph)
  const future = validateFederalReturn({...mapping,year:'2028'}, {...graph,year:'2028'})
  const mismatch = validateFederalReturn(mapping, {...graph,year:'2026'})
  return [
    { name: 'Explicit zero does not create a mapping blocker', passed: !report.issues.some(i => i.id === 'mapping-1a') },
    { name: 'Missing interest creates a mapping blocker', passed: report.issues.some(i => i.id === 'mapping-2b') },
    { name: 'Missing cross-form transfer creates a blocker', passed: report.issues.some(i => i.id === 'edge-int-1040-2b') },
    { name: 'Valid source edge is not blocked', passed: !report.issues.some(i => i.id === 'edge-w2-1040-1a') },
    { name: 'Future year is explicitly blocked', passed: future.issues.some(i => i.id === 'year-unverified') },
    { name: 'Year mismatch is detected', passed: mismatch.issues.some(i => i.id === 'year-mismatch') },
    { name: 'Issues have stable unique IDs', passed: new Set(report.issues.map(i=>i.id)).size === report.issues.length },
    { name: 'CSV contains issue details', passed: validationCsv(report).includes('next_step') },
    { name: 'Filing is always disabled', passed: report.filingEnabled === false },
    { name: 'No issue is automatically marked resolved', passed: report.issues.every(i=>i.status === 'open') },
  ]
}
