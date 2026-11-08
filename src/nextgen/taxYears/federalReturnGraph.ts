import type { MappingReport } from './form1040Mapping'

export type DocumentKind = 'W-2' | '1099-INT' | 'Schedule C' | 'Schedule 1' | 'Schedule 2' | 'Schedule 3' | 'Form 1040'
export type GraphStatus = 'candidate' | 'blocked' | 'unimplemented'
export interface FormDocument { id: string; kind: DocumentKind; label: string; source: 'pipeline' | 'mapping' | 'placeholder'; status: GraphStatus; issues: string[] }
export interface FormLink { from: string; to: string; line: string; status: GraphStatus; cents: number | null; findings: string[] }
export interface GraphFinding { code: string; severity: 'blocker' | 'notice'; message: string }
export interface ReturnGraph { year: string; documents: FormDocument[]; links: FormLink[]; findings: GraphFinding[]; candidateLinks: number; blockedLinks: number; filingEnabled: false; postingEnabled: false }

const SOURCES: ReadonlyArray<{ id: string; kind: DocumentKind; label: string; line: string }> = [
  { id: 'w2', kind: 'W-2', label: 'W-2 wage and withholding sources', line: '1a' },
  { id: 'int', kind: '1099-INT', label: 'Interest income sources', line: '2b' },
  { id: 'c', kind: 'Schedule C', label: 'Business profit worksheet', line: '8' },
  { id: 's1', kind: 'Schedule 1', label: 'Additional income and adjustments', line: '10' },
  { id: 's2', kind: 'Schedule 2', label: 'Additional taxes', line: '23' },
  { id: 's3', kind: 'Schedule 3', label: 'Additional credits and payments', line: '24' },
]
const extraLinks: ReadonlyArray<{ from: string; line: string }> = [
  { from: 'w2', line: '25a' }, { from: 's1', line: '8' }, { from: 'c', line: '8' },
  { from: 's1', line: '11a' }, { from: 's3', line: '33' },
]

/** Non-posting dependency graph. Never infers a missing or unimplemented amount. */
export function buildFederalReturnGraph(mapping: MappingReport): ReturnGraph {
  const documents: FormDocument[] = SOURCES.map(source => ({
    id: source.id, kind: source.kind, label: source.label,
    source: source.id === 'w2' || source.id === 'int' ? 'pipeline' : 'placeholder',
    status: source.id === 'w2' || source.id === 'int' ? 'candidate' : 'unimplemented', issues: [],
  }))
  documents.push({ id: '1040', kind: 'Form 1040', label: 'Draft federal return', source: 'mapping', status: 'blocked', issues: ['Official Form 1040 posting is disabled.'] })
  const seen = new Set<string>()
  const findings: GraphFinding[] = []
  const links: FormLink[] = []
  for (const link of [...SOURCES.map(s => ({ from: s.id, line: s.line })), ...extraLinks]) {
    const key = `${link.from}|1040|${link.line}`
    if (seen.has(key)) {
      findings.push({ code: 'DUPLICATE_EDGE', severity: 'blocker', message: `Duplicate source edge ${key}` })
      continue
    }
    seen.add(key)
    const source = documents.find(doc => doc.id === link.from)
    const mapped = mapping.lines.find(row => row.line === link.line)
    const matchingSource = (link.from === 'w2' && ['1a','25a'].includes(link.line)) || (link.from === 'int' && link.line === '2b')
    const status: GraphStatus = !mapped || !source ? 'blocked' : matchingSource && mapped.status === 'candidate' ? 'candidate' : mapped.status === 'not-implemented' ? 'unimplemented' : 'blocked'
    const cents = status === 'candidate' && mapped ? mapped.cents : null
    const reasons = [
      ...(!mapped ? [`Form 1040 line ${link.line} is not mapped.`] : []),
      ...(mapped?.findings ?? []),
      ...(!matchingSource ? ['Cross-form calculation is not implemented or independently validated.'] : []),
    ]
    links.push({ from: link.from, to: '1040', line: link.line, status, cents, findings: reasons })
  }
  if (mapping.year !== '2025') findings.push({ code: 'YEAR_UNVERIFIED', severity: 'blocker', message: `Tax year ${mapping.year} requires independently verified form and rule definitions.` })
  if (links.some(l => l.status !== 'candidate')) findings.push({ code: 'INCOMPLETE_GRAPH', severity: 'blocker', message: 'Some cross-form dependencies are unimplemented or unresolved.' })
  findings.push({ code: 'NON_POSTING', severity: 'notice', message: 'Source candidates are diagnostics only. Filing and form posting remain disabled.' })
  return { year: mapping.year, documents, links, findings, candidateLinks: links.filter(l => l.status === 'candidate').length, blockedLinks: links.filter(l => l.status !== 'candidate').length, filingEnabled: false, postingEnabled: false }
}
const quote = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`
export function graphCsv(graph: ReturnGraph): string {
  const rows = [['year','source','target','form1040_line','status','candidate_cents','findings'], ...graph.links.map(link => [graph.year, link.from, link.to, link.line, link.status, link.cents === null ? '' : String(link.cents), link.findings.join(' | ')])]
  return rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export function runGraphFixtures(): { name: string; passed: boolean }[] {
  const mapping: MappingReport = { year: '2025', lines: [
    { line: '1a', label: 'wages', source: ['wages'], status: 'candidate', cents: 0, findings: [] },
    { line: '2b', label: 'interest', source: ['interest'], status: 'blocked', cents: null, findings: ['Missing'] },
    { line: '25a', label: 'withholding', source: ['withholding'], status: 'candidate', cents: 500, findings: [] },
  ], candidates: 2, blocked: 1, notImplemented: 0, filingEnabled: false, postingEnabled: false }
  const graph = buildFederalReturnGraph(mapping)
  const future = buildFederalReturnGraph({ ...mapping, year: '2028' })
  return [
    { name: 'Seven document nodes including Form 1040', passed: graph.documents.length === 7 },
    { name: 'Source zero remains a valid candidate', passed: graph.links.find(l => l.from === 'w2' && l.line === '1a')?.cents === 0 },
    { name: 'Missing interest never becomes zero', passed: graph.links.find(l => l.from === 'int')?.cents === null },
    { name: 'Withholding preserves source cents', passed: graph.links.find(l => l.line === '25a')?.cents === 500 },
    { name: 'Schedule C remains unimplemented', passed: graph.links.find(l => l.from === 'c')?.cents === null },
    { name: 'Graph edges are unique', passed: new Set(graph.links.map(l => `${l.from}:${l.to}:${l.line}`)).size === graph.links.length },
    { name: 'Future years require separate validation', passed: future.findings.some(f => f.code === 'YEAR_UNVERIFIED') },
    { name: 'No filing or posting', passed: !graph.filingEnabled && !graph.postingEnabled },
    { name: 'CSV preserves traceability', passed: graphCsv(graph).includes('candidate_cents') },
  ]
}
