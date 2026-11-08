/** Phase 35: immutable, non-posting, cents-only federal candidate graph.
 * A missing value is NOT zero. Arithmetic does not establish IRS eligibility.
 */
export type GraphStatus = 'available' | 'missing' | 'invalid' | 'blocked' | 'conflict'
export type GraphValue = { cents: number | null; status: GraphStatus; sources: string[]; reasons: string[] }
export type GraphInput = { taxYear: number; wages: number | null; withholding: number | null; interest: number | null; schedule1Income: number | null; schedule1Adjustments: number | null; schedule2Tax: number | null; schedule3Credits: number | null; deduction: number | null; otherIncomeReviewed: boolean; schedulesReviewed: boolean; deductionReviewed: boolean }
export type GraphReport = { taxYear: number; filingReady: false; nodes: Record<string, GraphValue>; order: string[]; findings: { node: string; status: GraphStatus; message: string }[]; available: number; blocked: number }
const MAX = 100000000000000
const valid = (v: number | null): v is number => v !== null && Number.isSafeInteger(v) && v >= 0 && v <= MAX
const available = (v: number, sources: string[]): GraphValue => ({ cents: v, status: 'available', sources, reasons: [] })
const unknown = (status: GraphStatus, reason: string, sources: string[] = []): GraphValue => ({ cents: null, status, sources, reasons: [reason] })
const source = (value: number | null, label: string): GraphValue => value === null ? unknown('missing', `${label} has not been established`, [label]) : valid(value) ? available(value, [label]) : unknown('invalid', `${label} is not a safe nonnegative cent amount`, [label])
export function buildUnifiedFederalGraph(input: GraphInput): GraphReport {
  const nodes: Record<string, GraphValue> = {}
  const order: string[] = []
  const put = (key: string, value: GraphValue) => { nodes[key] = value; order.push(key) }
  const direct = (key: string, amount: number | null, label: string) => put(key, source(amount, label))
  const combine = (key: string, dependencies: string[], calculate: (v: number[]) => number, reviewed = true, note = '') => {
    const deps = dependencies.map(id => nodes[id])
    const sources = Array.from(new Set(deps.flatMap(v => v.sources)))
    if (!reviewed) { put(key, unknown('blocked', note || 'Independent review is required', sources)); return }
    const unavailable = deps.filter(v => v.status !== 'available')
    if (unavailable.length) { put(key, unknown('blocked', `${dependencies.filter(id => nodes[id].status !== 'available').join(', ')} unresolved`, sources)); return }
    const result = calculate(deps.map(v => v.cents as number))
    put(key, valid(result) ? available(result, sources) : unknown('invalid', 'Calculated amount is outside safe cent limits', sources))
  }
  direct('1040.1a', input.wages, 'W-2 box 1')
  direct('1040.25a', input.withholding, 'W-2 box 2')
  direct('1040.2b', input.interest, '1099-INT box 1')
  direct('schedule1.10', input.schedule1Income, 'Schedule 1 line 10')
  direct('schedule1.26', input.schedule1Adjustments, 'Schedule 1 line 26')
  direct('schedule2.3', input.schedule2Tax, 'Schedule 2 line 3')
  direct('schedule3.8', input.schedule3Credits, 'Schedule 3 line 8')
  direct('1040.12e', input.deduction, 'Deduction worksheet')
  const yearSupported = input.taxYear === 2025
  combine('1040.8', ['schedule1.10'], v => v[0], input.schedulesReviewed && yearSupported, 'Schedule 1 classification / tax year not independently reviewed')
  combine('1040.10', ['schedule1.26'], v => v[0], input.schedulesReviewed && yearSupported, 'Schedule 1 adjustments / tax year not independently reviewed')
  combine('1040.9', ['1040.1a', '1040.2b', '1040.8'], v => v[0] + v[1] + v[2], input.otherIncomeReviewed && yearSupported, 'Other income categories / tax year not independently reviewed')
  combine('1040.11a', ['1040.9', '1040.10'], v => v[0] - v[1], yearSupported, 'Tax year not implemented')
  combine('1040.11b', ['1040.11a'], v => v[0])
  combine('1040.14', ['1040.12e'], v => v[0], input.deductionReviewed && yearSupported, 'Deduction eligibility / tax year not independently reviewed')
  combine('1040.15', ['1040.11b', '1040.14'], v => Math.max(0, v[0] - v[1]))
  combine('1040.17', ['schedule2.3'], v => v[0], input.schedulesReviewed && yearSupported, 'Schedule 2 classification / tax year not independently reviewed')
  combine('1040.20', ['schedule3.8'], v => v[0], input.schedulesReviewed && yearSupported, 'Schedule 3 eligibility / tax year not independently reviewed')
  const findings = order.filter(key => nodes[key].status !== 'available').map(node => ({ node, status: nodes[node].status, message: nodes[node].reasons.join('; ') }))
  return { taxYear: input.taxYear, filingReady: false, nodes, order, findings, available: order.length - findings.length, blocked: findings.length }
}
export function unifiedGraphCsv(report: GraphReport): string {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`
  return ['line,status,amount_cents,source,reasons', ...report.order.map(key => { const n = report.nodes[key]; return [key, n.status, n.cents === null ? '' : String(n.cents), n.sources.join(' | '), n.reasons.join(' | ')].map(q).join(',') })].join('\r\n')
}
