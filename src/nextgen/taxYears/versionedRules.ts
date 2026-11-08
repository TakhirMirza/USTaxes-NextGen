import { TaxYear, isSupportedTaxYear } from './multiYearRegistry'

/** A rule definition is metadata until independently verified against official sources. */
export type RuleStatus = 'reference-needed' | 'draft' | 'verified'
export type RuleCategory = 'filing-status' | 'income' | 'deduction' | 'credit' | 'self-employment' | 'payments'
export interface FederalRule {
  id: string
  year: TaxYear
  category: RuleCategory
  title: string
  status: RuleStatus
  source: string | null
  effectiveDate: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  notes: string
}
export interface RuleManifest {
  year: TaxYear
  version: string
  rules: readonly FederalRule[]
  calculationEnabled: false
  filingEnabled: false
}
const categories: readonly { id: RuleCategory; title: string }[] = [
  { id: 'filing-status', title: 'Filing status and eligibility' },
  { id: 'income', title: 'Wages, interest and other income' },
  { id: 'deduction', title: 'Standard and itemized deductions' },
  { id: 'credit', title: 'Tax credits and eligibility' },
  { id: 'self-employment', title: 'Schedule C and self-employment tax' },
  { id: 'payments', title: 'Withholding, payments and refunds' },
]
const createManifest = (year: TaxYear): RuleManifest => ({
  year, version: `${year}.0.0-development`, calculationEnabled: false, filingEnabled: false,
  rules: categories.map(category => ({
    id: `${year}-${category.id}`, year, category: category.id, title: category.title,
    status: 'reference-needed' as const, source: null, effectiveDate: null,
    reviewedBy: null, reviewedAt: null,
    notes: 'Requires official tax-year-specific IRS source, implementation, independent review and test vectors.',
  })),
})
export const FEDERAL_RULE_MANIFESTS: Readonly<Record<TaxYear, RuleManifest>> = {
  '2025': createManifest('2025'), '2026': createManifest('2026'),
  '2027': createManifest('2027'), '2028': createManifest('2028'),
}
export interface RuleAudit {
  year: string
  recognized: boolean
  total: number
  verified: number
  draft: number
  missing: number
  missingSources: number
  calculationEnabled: false
  filingEnabled: false
  blockers: readonly string[]
}
export function auditFederalRules(year: string): RuleAudit {
  if (!isSupportedTaxYear(year)) return {
    year, recognized: false, total: 0, verified: 0, draft: 0, missing: 0,
    missingSources: 0, calculationEnabled: false, filingEnabled: false,
    blockers: ['Unregistered tax year; no fallback to another year is permitted'],
  }
  const manifest = FEDERAL_RULE_MANIFESTS[year]
  const verified = manifest.rules.filter(rule => rule.status === 'verified' && rule.source && rule.reviewedBy && rule.reviewedAt).length
  const draft = manifest.rules.filter(rule => rule.status === 'draft').length
  const missingSources = manifest.rules.filter(rule => !rule.source).length
  const blockers = [
    ...(verified !== manifest.rules.length ? [`${manifest.rules.length - verified} rules require independent verification`] : []),
    ...(missingSources ? [`${missingSources} official source references missing`] : []),
    'No approved calculation engine for this tax year',
    'No secure filing backend or IRS filing authorization',
  ]
  return { year, recognized: true, total: manifest.rules.length, verified, draft,
    missing: manifest.rules.length - verified - draft, missingSources,
    calculationEnabled: false, filingEnabled: false, blockers }
}
export function getFederalRule(year: string, category: RuleCategory): FederalRule | null {
  return isSupportedTaxYear(year) ? FEDERAL_RULE_MANIFESTS[year].rules.find(rule => rule.category === category) ?? null : null
}
/** Never silently substitute a rule from a different tax year. */
export function requireVerifiedRule(year: string, category: RuleCategory): FederalRule {
  const rule = getFederalRule(year, category)
  if (!rule || rule.status !== 'verified' || !rule.source || !rule.reviewedBy || !rule.reviewedAt) {
    throw new Error(`BLOCKED: ${year}/${category} lacks an independently verified tax-year rule`)
  }
  return rule
}
const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`
export function federalRulesCsv(): string {
  const rows: string[][] = [['tax_year','rule_id','category','status','source','reviewed_by','calculation_enabled','filing_enabled']]
  for (const year of Object.keys(FEDERAL_RULE_MANIFESTS) as TaxYear[]) {
    for (const rule of FEDERAL_RULE_MANIFESTS[year].rules) rows.push([
      year, rule.id, rule.category, rule.status, rule.source ?? '', rule.reviewedBy ?? '', 'false', 'false',
    ])
  }
  return rows.map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n'
}
