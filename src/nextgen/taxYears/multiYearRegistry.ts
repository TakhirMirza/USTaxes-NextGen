/** Tax-year capability registry. No year is certified for real tax preparation. */
export type TaxYear = '2025' | '2026' | '2027' | '2028'
export type Capability = 'draftWorkspace' | 'w2Entry' | 'interestEntry' | 'scheduleCWorksheet' | 'federalCalculation' | 'irsRuleVerification' | 'pdfFiling' | 'efile'
export type CapabilityStatus = 'preview' | 'blocked' | 'not-implemented'
export interface YearDescriptor {
  year: TaxYear
  label: string
  capabilities: Readonly<Record<Capability, CapabilityStatus>>
  blockers: readonly string[]
  ruleSetVersion: string | null
}
const allBlocked = (): Record<Capability, CapabilityStatus> => ({
  draftWorkspace: 'not-implemented', w2Entry: 'not-implemented', interestEntry: 'not-implemented',
  scheduleCWorksheet: 'not-implemented', federalCalculation: 'blocked', irsRuleVerification: 'blocked',
  pdfFiling: 'blocked', efile: 'blocked'
})
const preview2025: Record<Capability, CapabilityStatus> = {
  ...allBlocked(), draftWorkspace: 'preview', w2Entry: 'preview', interestEntry: 'preview', scheduleCWorksheet: 'preview'
}
export const TAX_YEAR_REGISTRY: Readonly<Record<TaxYear, YearDescriptor>> = {
  '2025': { year: '2025', label: '2025 — development preview', ruleSetVersion: null, capabilities: preview2025,
    blockers: ['IRS rule verification is incomplete', 'Production security and identity controls are not configured', 'Official PDF and e-file integrations are unavailable'] },
  '2026': { year: '2026', label: '2026 — architecture reserved', ruleSetVersion: null, capabilities: allBlocked(), blockers: ['2026 federal forms and annual tax rules have not been implemented'] },
  '2027': { year: '2027', label: '2027 — architecture reserved', ruleSetVersion: null, capabilities: allBlocked(), blockers: ['2027 federal forms and annual tax rules have not been implemented'] },
  '2028': { year: '2028', label: '2028 — architecture reserved', ruleSetVersion: null, capabilities: allBlocked(), blockers: ['2028 federal forms and annual tax rules have not been implemented'] }
}
export const CAPABILITY_LABELS: Readonly<Record<Capability, string>> = {
  draftWorkspace: 'Draft workspace', w2Entry: 'W-2 entry', interestEntry: '1099-INT entry', scheduleCWorksheet: 'Schedule C worksheet',
  federalCalculation: 'Verified federal tax calculation', irsRuleVerification: 'IRS rule verification', pdfFiling: 'Official filing PDF', efile: 'Electronic filing'
}
export const CAPABILITIES = Object.keys(CAPABILITY_LABELS) as Capability[]
export function isSupportedTaxYear(value: string): value is TaxYear { return Object.prototype.hasOwnProperty.call(TAX_YEAR_REGISTRY, value) }
export function yearDescriptor(value: string): YearDescriptor | null { return isSupportedTaxYear(value) ? TAX_YEAR_REGISTRY[value] : null }
export function capabilityForYear(year: string, capability: Capability): CapabilityStatus { return yearDescriptor(year)?.capabilities[capability] ?? 'not-implemented' }
export function canFileTaxYear(year: string): boolean {
  const descriptor = yearDescriptor(year)
  return !!descriptor && descriptor.ruleSetVersion !== null && descriptor.blockers.length === 0 && false // Hard safety gate: no filing backend exists.
}
export interface YearAudit { year: string; recognized: boolean; previewCount: number; blockedCount: number; unimplementedCount: number; filingEnabled: false; issues: string[] }
export function auditTaxYear(year: string): YearAudit {
  const descriptor = yearDescriptor(year)
  const statuses = descriptor ? CAPABILITIES.map(key => descriptor.capabilities[key]) : []
  return { year, recognized: descriptor !== null, previewCount: statuses.filter(x => x === 'preview').length,
    blockedCount: statuses.filter(x => x === 'blocked').length, unimplementedCount: statuses.filter(x => x === 'not-implemented').length,
    filingEnabled: false, issues: descriptor ? [...descriptor.blockers] : ['Unknown tax year; no federal rules may be inferred'] }
}
export function yearAuditCsv(): string {
  const rows = [['tax_year','recognized','preview_capabilities','blocked_capabilities','not_implemented','filing_enabled','blocker_count'],
    ...Object.keys(TAX_YEAR_REGISTRY).map(year => { const a = auditTaxYear(year); return [a.year, String(a.recognized), String(a.previewCount), String(a.blockedCount), String(a.unimplementedCount), 'false', String(a.issues.length)] })]
  return rows.map(row => row.join(',')).join('\r\n') + '\r\n'
}
