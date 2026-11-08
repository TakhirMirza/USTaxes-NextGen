import type { CalcNode, CalcReport, NodeId } from './calculationPipeline'

/** Phase 44: non-posting orchestration. It never infers absent amounts or computes tax. */
export type GateStatus = 'ready-for-review' | 'blocked' | 'not-implemented'
export type StageId = 'source-validation' | 'income-aggregation' | 'agi-preview' | 'deduction-preview' | 'payment-preview' | 'tax-liability' | 'form-1040-posting'
export interface StageResult {
  id: StageId
  label: string
  status: GateStatus
  sourceNodes: readonly NodeId[]
  issues: readonly string[]
  amountCents: number | null
}
export interface OrchestrationReport {
  taxYear: string
  stages: readonly StageResult[]
  ready: number
  blocked: number
  notImplemented: number
  postingEnabled: false
  filingEnabled: false
  blockers: readonly string[]
}

const stages: readonly { id: StageId; label: string; nodes: readonly NodeId[]; result?: NodeId }[] = [
  { id: 'source-validation', label: 'Source document validation', nodes: ['wages', 'interest', 'business', 'adjustments', 'deductions', 'credits', 'otherTaxes', 'withholding', 'estimatedPayments'] },
  { id: 'income-aggregation', label: 'Known-source income subtotal', nodes: ['wages', 'interest', 'business'], result: 'totalIncome' },
  { id: 'agi-preview', label: 'Known-source adjusted subtotal', nodes: ['totalIncome', 'adjustments'], result: 'agi' },
  { id: 'deduction-preview', label: 'Arithmetic taxable subtotal', nodes: ['agi', 'deductions'], result: 'taxableIncome' },
  { id: 'payment-preview', label: 'Known-source payments subtotal', nodes: ['withholding', 'estimatedPayments'], result: 'totalPayments' },
  { id: 'tax-liability', label: 'IRS tax tables, credits and additional taxes', nodes: ['taxableIncome', 'credits', 'otherTaxes'] },
  { id: 'form-1040-posting', label: 'Authoritative Form 1040 posting / filing', nodes: ['totalIncome', 'agi', 'taxableIncome', 'totalPayments'] },
]

export function orchestrateCalculation(report: CalcReport): OrchestrationReport {
  const byId = new Map<NodeId, CalcNode>(report.nodes.map(node => [node.id, node]))
  const results: StageResult[] = stages.map(stage => {
    const missing = stage.nodes.filter(id => byId.get(id)?.state !== 'known')
    const intentionallyDisabled = stage.id === 'tax-liability' || stage.id === 'form-1040-posting'
    const status: GateStatus = intentionallyDisabled ? 'not-implemented' : missing.length ? 'blocked' : 'ready-for-review'
    const issues = [
      ...missing.map(id => `${id}: ${byId.get(id)?.state ?? 'missing'}`),
      ...(intentionallyDisabled ? ['Tax-law implementation, independent verification and posting authorization are not available.'] : []),
      ...(status === 'ready-for-review' ? ['Arithmetic only; not an IRS-validated return line.'] : []),
    ]
    const resultNode = stage.result ? byId.get(stage.result) : undefined
    return { id: stage.id, label: stage.label, status, sourceNodes: stage.nodes, issues, amountCents: status === 'ready-for-review' && resultNode?.state === 'known' ? resultNode.cents : null }
  })
  return {
    taxYear: report.year,
    stages: results,
    ready: results.filter(stage => stage.status === 'ready-for-review').length,
    blocked: results.filter(stage => stage.status === 'blocked').length,
    notImplemented: results.filter(stage => stage.status === 'not-implemented').length,
    postingEnabled: false,
    filingEnabled: false,
    blockers: [...report.blockers, ...results.filter(stage => stage.status !== 'ready-for-review').map(stage => `${stage.id}: ${stage.issues.join('; ')}`)],
  }
}

function csvCell(value: string): string { return `"${value.replace(/"/g, '""')}"` }
export function orchestrationCsv(report: OrchestrationReport): string {
  const rows = [['taxYear', 'stage', 'status', 'sources', 'amountCents', 'issues'], ...report.stages.map(stage => [report.taxYear, stage.id, stage.status, stage.sourceNodes.join('|'), stage.amountCents === null ? '' : String(stage.amountCents), stage.issues.join('|')])]
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function runOrchestrationFixtures(): { name: string; passed: boolean }[] {
  const known = (id: NodeId): CalcNode => ({ id, label: id, dependencies: [], state: 'known', cents: 0, issues: [] })
  const all: NodeId[] = ['wages','interest','business','adjustments','deductions','credits','otherTaxes','withholding','estimatedPayments','totalIncome','agi','taxableIncome','totalPayments']
  const base: CalcReport = { year: '2025', supported: true, postingEnabled: false, filingEnabled: false, nodes: all.map(known), blockers: [], known: all.length, unresolved: 0 }
  const complete = orchestrateCalculation(base)
  const incomplete = orchestrateCalculation({ ...base, nodes: base.nodes.filter(n => n.id !== 'wages') })
  const zero = complete.stages.find(s => s.id === 'income-aggregation')
  return [
    { name: 'Complete source preview is reviewable', passed: complete.ready === 5 },
    { name: 'Tax liability never becomes authorized', passed: complete.stages.find(s => s.id === 'tax-liability')?.status === 'not-implemented' },
    { name: 'Form 1040 posting always disabled', passed: complete.postingEnabled === false && complete.filingEnabled === false },
    { name: 'Missing wage source blocks income stage', passed: incomplete.stages.find(s => s.id === 'income-aggregation')?.status === 'blocked' },
    { name: 'Missing wage source cannot become zero', passed: incomplete.stages.find(s => s.id === 'income-aggregation')?.amountCents === null },
    { name: 'Explicit zero remains a known amount', passed: zero?.amountCents === 0 },
    { name: 'Diagnostics CSV includes stage provenance', passed: orchestrationCsv(complete).includes('income-aggregation') },
  ]
}
