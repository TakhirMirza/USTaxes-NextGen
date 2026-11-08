import { FEDERAL_RULE_MANIFESTS, type RuleCategory } from './versionedRules'
import { isSupportedTaxYear, type TaxYear } from './multiYearRegistry'

/** Phase 43: isolated arithmetic preview. Never writes to a tax return. */
export type AmountInput = string | null
export type NodeId = 'wages' | 'interest' | 'business' | 'adjustments' | 'deductions' | 'credits' | 'otherTaxes' | 'withholding' | 'estimatedPayments' | 'totalIncome' | 'agi' | 'taxableIncome' | 'totalPayments'
export type NodeState = 'known' | 'missing' | 'invalid' | 'blocked'
export interface CalcNode { id: NodeId; label: string; dependencies: readonly NodeId[]; state: NodeState; cents: number | null; issues: readonly string[] }
export interface CalcReport { year: string; supported: boolean; postingEnabled: false; filingEnabled: false; nodes: readonly CalcNode[]; blockers: readonly string[]; known: number; unresolved: number }
export const INPUTS: readonly { id: NodeId; label: string; category: RuleCategory }[] = [
  { id: 'wages', label: 'W-2 wages (fictional)', category: 'income' },
  { id: 'interest', label: 'Taxable interest (fictional)', category: 'income' },
  { id: 'business', label: 'Business profit / loss (fictional)', category: 'self-employment' },
  { id: 'adjustments', label: 'Adjustments (fictional)', category: 'deduction' },
  { id: 'deductions', label: 'Deductions (fictional)', category: 'deduction' },
  { id: 'credits', label: 'Credits (fictional)', category: 'credit' },
  { id: 'otherTaxes', label: 'Other taxes (fictional)', category: 'self-employment' },
  { id: 'withholding', label: 'Federal withholding (fictional)', category: 'payments' },
  { id: 'estimatedPayments', label: 'Estimated payments (fictional)', category: 'payments' },
]
const LIMIT = 100_000_000_000 // cents; intentionally conservative sandbox bound
export function parseCents(value: AmountInput): { state: NodeState; cents: number | null; issue?: string } {
  if (value === null || value.trim() === '') return { state: 'missing', cents: null, issue: 'Explicit amount required; blank is not zero.' }
  const clean = value.trim()
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(clean)) return { state: 'invalid', cents: null, issue: 'Use a decimal amount with at most two fractional digits.' }
  const negative = clean.startsWith('-')
  const [whole, fractional = ''] = (negative ? clean.slice(1) : clean).split('.')
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > LIMIT) return { state: 'invalid', cents: null, issue: 'Amount exceeds the sandbox precision/range limit.' }
  return { state: 'known', cents: negative ? -cents : cents }
}
export function formatCents(cents: number | null): string { return cents === null ? 'Unresolved' : `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
const derived: readonly { id: NodeId; label: string; dependencies: readonly NodeId[]; compute: (values: number[]) => number }[] = [
  { id: 'totalIncome', label: 'Known-source income subtotal (NOT 1040 line 9)', dependencies: ['wages', 'interest', 'business'], compute: v => v[0] + v[1] + v[2] },
  { id: 'agi', label: 'Known-source adjusted subtotal (NOT official AGI)', dependencies: ['totalIncome', 'adjustments'], compute: v => v[0] - v[1] },
  { id: 'taxableIncome', label: 'Arithmetic taxable subtotal (NOT official line 15)', dependencies: ['agi', 'deductions'], compute: v => Math.max(0, v[0] - v[1]) },
  { id: 'totalPayments', label: 'Known-source payments subtotal (NOT official line 33)', dependencies: ['withholding', 'estimatedPayments'], compute: v => v[0] + v[1] },
]
export function evaluatePipeline(year: string, inputs: Partial<Record<NodeId, AmountInput>>): CalcReport {
  const supported = isSupportedTaxYear(year)
  const nodes: CalcNode[] = []
  const lookup = new Map<NodeId, CalcNode>()
  for (const input of INPUTS) {
    const result = parseCents(inputs[input.id] ?? null)
    const node: CalcNode = { id: input.id, label: input.label, dependencies: [], state: result.state, cents: result.cents, issues: result.issue ? [result.issue] : [] }
    nodes.push(node); lookup.set(node.id, node)
  }
  for (const item of derived) {
    const dependencies = item.dependencies.map(id => lookup.get(id)!)
    const missing = dependencies.filter(n => n.state !== 'known')
    const value = missing.length ? null : item.compute(dependencies.map(n => n.cents!))
    const safe = value !== null && Number.isSafeInteger(value) && Math.abs(value) <= LIMIT
    const node: CalcNode = { id: item.id, label: item.label, dependencies: item.dependencies, state: missing.length ? 'blocked' : safe ? 'known' : 'invalid', cents: safe ? value : null, issues: missing.length ? [`Requires: ${missing.map(n => n.id).join(', ')}`] : safe ? [] : ['Arithmetic exceeds safe range'] }
    nodes.push(node); lookup.set(node.id, node)
  }
  const blockers = [
    ...(!supported ? [`Unsupported tax year ${year}; no fallback is permitted.`] : []),
    ...(supported ? FEDERAL_RULE_MANIFESTS[year as TaxYear].rules.filter(rule => rule.status !== 'verified').map(rule => `${rule.category}: tax-year-specific rule not independently verified`) : []),
    ...nodes.filter(n => n.state !== 'known').map(n => `${n.id}: ${n.issues.join('; ')}`),
    'No tax tables, eligibility, complete schedules, official rounding or authorized posting. Filing disabled.',
  ]
  return { year, supported, postingEnabled: false, filingEnabled: false, nodes, blockers, known: nodes.filter(n => n.state === 'known').length, unresolved: nodes.filter(n => n.state !== 'known').length }
}
export function runPipelineFixtures(): { name: string; passed: boolean }[] {
  const full = Object.fromEntries(INPUTS.map(x => [x.id, '0.00']))
  const sample = evaluatePipeline('2025', { ...full, wages: '50000.00', interest: '125.25', business: '-250.00', adjustments: '1000.00', deductions: '15000.00', withholding: '7000.00', estimatedPayments: '500.00' })
  const get = (id: NodeId) => sample.nodes.find(x => x.id === id)?.cents
  return [
    { name: 'exact cent parsing', passed: parseCents('12.34').cents === 1234 },
    { name: 'reject excess decimals', passed: parseCents('1.999').state === 'invalid' },
    { name: 'missing is not zero', passed: parseCents('').state === 'missing' },
    { name: 'reject unsafe amounts', passed: parseCents('999999999999999').state === 'invalid' },
    { name: 'signed business income subtotal', passed: get('totalIncome') === 4987525 },
    { name: 'adjustment arithmetic', passed: get('agi') === 4887525 },
    { name: 'deduction arithmetic', passed: get('taxableIncome') === 3387525 },
    { name: 'payment arithmetic', passed: get('totalPayments') === 750000 },
    { name: 'unknown propagates', passed: evaluatePipeline('2025', { wages: '10.00' }).nodes.find(n => n.id === 'totalIncome')?.state === 'blocked' },
    { name: 'unknown year rejected', passed: !evaluatePipeline('2035', full).supported },
    { name: 'never posts or files', passed: !sample.postingEnabled && !sample.filingEnabled },
  ]
}
export function pipelineCsv(report: CalcReport): string {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [['year','node','state','dependency_ids','issue_codes'].map(escape).join(','), ...report.nodes.map(node => [report.year,node.id,node.state,node.dependencies.join('|'),node.issues.join('|')].map(escape).join(','))].join('\r\n')
}
