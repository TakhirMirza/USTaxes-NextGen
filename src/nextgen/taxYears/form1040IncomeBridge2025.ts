/** Phase 9: deterministic, read-only 2025 Form 1040 income bridge.
 * All values are integer cents. Missing inputs are NEVER assumed to be zero.
 * This module does not determine taxable income, tax, refund, or filing readiness.
 */
export type BridgeStatus2025 = 'established' | 'unresolved' | 'invalid' | 'not-applicable'
export interface BridgeLine2025 { line: string; label: string; cents: number | null; status: BridgeStatus2025; dependencies: string[]; note: string }
export interface BridgeInput2025 {
  year: string
  wagesSelected: boolean
  wageRows: { wages: string; withholding: string; employer: string }[]
  interestSelected: boolean
  interest: string
  payer: string
  schedule: { line8: number | null; line10: number | null; blocked: boolean; entryCount: number }
  scheduleReconciled: boolean
  upstreamBlockers: readonly string[]
}
export interface BridgeResult2025 { lines: BridgeLine2025[]; findings: { code: string; severity: 'blocker' | 'review'; message: string }[]; filingEnabled: false }
export function parseCents2025(raw: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) return null
  const [whole, frac = ''] = raw.trim().split('.')
  const dollars = Number(whole)
  const pennies = Number(frac.padEnd(2, '0'))
  const result = dollars * 100 + pennies
  return Number.isSafeInteger(result) ? result : null
}
const safeSum = (values: number[]): number | null => {
  let total = 0
  for (const value of values) {
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(total + value)) return null
    total += value
  }
  return total
}
export function buildForm1040IncomeBridge2025(input: BridgeInput2025): BridgeResult2025 {
  const findings: BridgeResult2025['findings'] = []
  const lines: BridgeLine2025[] = []
  const add = (line: string, label: string, cents: number | null, status: BridgeStatus2025, dependencies: string[], note: string): void => {
    lines.push({ line, label, cents, status, dependencies, note })
    if (status === 'invalid') findings.push({ code: `INVALID_${line.toUpperCase()}`, severity: 'blocker', message: `Line ${line}: invalid or unsafe source amount` })
    if (status === 'unresolved') findings.push({ code: `UNRESOLVED_${line.toUpperCase()}`, severity: 'review', message: `Line ${line}: source evidence is incomplete` })
  }
  if (input.year !== '2025') findings.push({ code: 'YEAR_NOT_SUPPORTED', severity: 'blocker', message: 'Only 2025 mapping is implemented' })
  if (input.upstreamBlockers.length) findings.push({ code: 'UPSTREAM_BLOCKERS', severity: 'blocker', message: `${input.upstreamBlockers.length} upstream review blockers remain` })
  const wageValues = input.wageRows.map(w => parseCents2025(w.wages))
  const withheldValues = input.wageRows.map(w => parseCents2025(w.withholding))
  const wageValid = input.wagesSelected && input.wageRows.length > 0 && wageValues.every(v => v !== null) && input.wageRows.every(w => w.employer.trim().length > 0)
  const withheldValid = wageValid && withheldValues.every(v => v !== null)
  const wages = wageValid ? safeSum(wageValues as number[]) : null
  const withheld = withheldValid ? safeSum(withheldValues as number[]) : null
  add('1a', 'W-2 wages', input.wagesSelected ? wages : 0, !input.wagesSelected ? 'not-applicable' : wages === null ? 'unresolved' : 'established', ['W-2 Box 1'], 'W-2 source subtotal; no other wage categories inferred')
  add('25a', 'W-2 federal withholding', input.wagesSelected ? withheld : 0, !input.wagesSelected ? 'not-applicable' : withheld === null ? 'unresolved' : 'established', ['W-2 Box 2'], 'Does not include other withholding sources')
  const interest = input.interestSelected ? parseCents2025(input.interest) : 0
  const interestReady = !input.interestSelected || (interest !== null && input.payer.trim().length > 0)
  add('2b', 'Taxable interest candidate', interestReady ? interest : null, !input.interestSelected ? 'not-applicable' : !interestReady ? 'unresolved' : 'established', ['1099-INT Box 1'], 'Other taxable interest and special rules not assessed')
  const scheduleReady = input.scheduleReconciled && !input.schedule.blocked && input.upstreamBlockers.length === 0 && input.year === '2025'
  const scheduleValue = (value: number | null): number | null => scheduleReady && value !== null && Number.isSafeInteger(value) ? value : null
  const line8 = scheduleValue(input.schedule.line8)
  const line10 = scheduleValue(input.schedule.line10)
  add('8', 'Schedule 1 additional income', line8, input.schedule.line8 !== null && !Number.isSafeInteger(input.schedule.line8) ? 'invalid' : line8 === null ? 'unresolved' : 'established', ['Schedule 1 line 10'], 'Requires independently reconciled Schedule 1 source')
  add('10', 'Schedule 1 adjustments', line10, input.schedule.line10 !== null && !Number.isSafeInteger(input.schedule.line10) ? 'invalid' : line10 === null ? 'unresolved' : 'established', ['Schedule 1 line 26'], 'Requires independently reconciled Schedule 1 source')
  // Other income categories (1040 lines 1b-1i, 2a, 3-7) are not modeled here.
  // Consequently totals must NOT be shown as complete 1040 totals even if these known inputs are valid.
  const subtotal = wages !== null && interestReady && interest !== null && line8 !== null ? safeSum([input.wagesSelected ? wages : 0, interest, line8]) : null
  add('9-preview', 'Known-source income subtotal (NOT Form 1040 line 9)', subtotal, subtotal === null ? 'unresolved' : 'established', ['1a', '2b', '8'], 'Excludes unmodeled income categories; never a certified total-income figure')
  const adjusted = subtotal !== null && line10 !== null ? safeSum([subtotal, -line10]) : null
  add('11-preview', 'Known-source adjusted subtotal (NOT Form 1040 line 11)', adjusted, adjusted === null ? 'unresolved' : 'established', ['9-preview', '10'], 'Not AGI; requires all additional income sources and adjustments')
  return { lines, findings, filingEnabled: false }
}
/** Exports status only: no taxpayer identifiers, source labels, or dollar amounts. */
export function incomeBridgeCsv2025(result: BridgeResult2025): string {
  const quote = (s: string): string => `"${s.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`
  return ['line,status,dependency_count', ...result.lines.map(l => [l.line, l.status, String(l.dependencies.length)].map(quote).join(','))].join('\r\n') + '\r\n'
}
