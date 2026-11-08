import { FEDERAL_RULE_MANIFESTS, type RuleCategory, type FederalRule } from './versionedRules'
import { TAX_YEAR_REGISTRY, type TaxYear } from './multiYearRegistry'

/** Source inventory is documentary evidence, not tax-law verification. */
export type EvidenceState = 'unassigned' | 'reference-only' | 'review-required' | 'approved'
export type EvidenceKind = 'form' | 'instructions' | 'publication' | 'statute' | 'other'
export interface SourceEvidence {
  year: TaxYear
  category: RuleCategory
  documentTitle: string
  documentUrl: string
  documentRevision: string
  documentKind: EvidenceKind
  verifiedExcerpt: string
  reviewer: string
  reviewedOn: string
  implementationId: string
  regressionId: string
  state: EvidenceState
}
export const IRS_REFERENCE_PORTAL = 'https://www.irs.gov/forms-instructions'
export const IRS_PRIOR_YEAR_PORTAL = 'https://www.irs.gov/prior-year-forms-and-instructions'
const categories: readonly RuleCategory[] = ['filing-status','income','deduction','credit','self-employment','payments']

// No fabricated annual IRS citations, signatures, or approvals.
export const SOURCE_EVIDENCE: readonly SourceEvidence[] = []
export type FindingLevel = 'blocker' | 'warning'
export interface EvidenceFinding { code: string; level: FindingLevel; year: TaxYear; category: RuleCategory; detail: string }
export interface EvidenceAudit { year: TaxYear; total: number; approved: number; referenceOnly: number; missing: number; blockers: number; findings: EvidenceFinding[]; ready: false }
const isOfficialIrsUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'irs.gov' || url.hostname === 'www.irs.gov') && !url.username && !url.password
  } catch { return false }
}
const isValidDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
export function evaluateEvidence(year: TaxYear, category: RuleCategory, entries: readonly SourceEvidence[] = SOURCE_EVIDENCE): EvidenceFinding[] {
  const found = entries.filter(entry => entry.year === year && entry.category === category)
  const findings: EvidenceFinding[] = []
  if (found.length === 0) return [{ code: 'SOURCE_MISSING', level: 'blocker', year, category, detail: 'No year-specific official evidence has been registered.' }]
  if (found.length > 1) findings.push({ code: 'SOURCE_DUPLICATE', level: 'blocker', year, category, detail: 'Multiple source records require manual resolution.' })
  for (const entry of found) {
    if (!isOfficialIrsUrl(entry.documentUrl)) findings.push({ code: 'SOURCE_DOMAIN', level: 'blocker', year, category, detail: 'Reference must use an HTTPS irs.gov URL.' })
    if (!entry.documentTitle.trim() || !entry.documentRevision.trim() || !entry.verifiedExcerpt.trim()) findings.push({ code: 'SOURCE_METADATA', level: 'blocker', year, category, detail: 'Document title, revision and reviewed rule excerpt are required.' })
    if (!entry.reviewer.trim() || !isValidDate(entry.reviewedOn)) findings.push({ code: 'REVIEW_MISSING', level: 'blocker', year, category, detail: 'Independent reviewer and ISO review date are required.' })
    if (!entry.implementationId.trim() || !entry.regressionId.trim()) findings.push({ code: 'IMPLEMENTATION_UNTESTED', level: 'blocker', year, category, detail: 'Implementation and regression references are missing.' })
    if (entry.state !== 'approved') findings.push({ code: 'NOT_APPROVED', level: 'blocker', year, category, detail: `Evidence state is ${entry.state}; approval is required.` })
    if (entry.state === 'approved') findings.push({ code: 'APPROVAL_UNVERIFIED', level: 'warning', year, category, detail: 'Approval metadata is self-reported; independent review of the actual rule and tests is still necessary.' })
  }
  return findings
}
export function auditOfficialSources(year: TaxYear, entries: readonly SourceEvidence[] = SOURCE_EVIDENCE): EvidenceAudit {
  const findings = categories.flatMap(category => evaluateEvidence(year, category, entries))
  const registered = categories.filter(category => entries.some(entry => entry.year === year && entry.category === category))
  const approved = registered.filter(category => entries.some(entry => entry.year === year && entry.category === category && entry.state === 'approved')).length
  return { year, total: categories.length, approved, referenceOnly: registered.length - approved, missing: categories.length - registered.length, blockers: findings.filter(item => item.level === 'blocker').length, findings, ready: false }
}
export interface QualityCheck { id: string; pass: boolean; detail: string }
export function runSourceQualityChecks(): QualityCheck[] {
  const years = Object.keys(TAX_YEAR_REGISTRY) as TaxYear[]
  const unique = new Set<string>()
  const results: QualityCheck[] = []
  for (const year of years) {
    const manifest = FEDERAL_RULE_MANIFESTS[year]
    results.push({ id: `${year}/manifest-year`, pass: manifest.year === year, detail: 'Manifest must match the selected tax year.' })
    results.push({ id: `${year}/rule-count`, pass: manifest.rules.length === categories.length, detail: 'All six rule categories must exist.' })
    results.push({ id: `${year}/filing-gate`, pass: manifest.filingEnabled === false && manifest.calculationEnabled === false, detail: 'Uncertified calculation and filing must remain disabled.' })
    for (const rule of manifest.rules) {
      const key = `${year}/${rule.category}`
      results.push({ id: `${key}/isolation`, pass: rule.year === year && rule.id.startsWith(`${year}-`) && !unique.has(key), detail: 'Rules must be unique and tax-year scoped.' })
      unique.add(key)
      results.push({ id: `${key}/verification`, pass: rule.status !== 'verified' || hasCompleteVerifiedMetadata(rule), detail: 'Verified rules require a source and independent review metadata.' })
    }
  }
  results.push({ id: 'source-registry/no-duplicates', pass: SOURCE_EVIDENCE.length === new Set(SOURCE_EVIDENCE.map(e => `${e.year}/${e.category}`)).size, detail: 'Source records must be unique per tax year and category.' })
  results.push({ id: 'source-registry/official-domains', pass: SOURCE_EVIDENCE.every(e => isOfficialIrsUrl(e.documentUrl)), detail: 'All source URLs must point to official IRS HTTPS hosts.' })
  results.push({ id: 'source-registry/no-cross-year', pass: SOURCE_EVIDENCE.every(e => categories.includes(e.category) && years.includes(e.year)), detail: 'No unregistered year or category may be used.' })
  return results
}
function hasCompleteVerifiedMetadata(rule: FederalRule): boolean { return Boolean(rule.source && rule.reviewedBy && rule.reviewedAt) }
const quote = (value: string): string => `"${value.replace(/"/g, '""')}"`
export function sourceAuditCsv(): string {
  const rows: string[][] = [['year','category','evidence_state','document_title','document_url','document_revision','reviewer','reviewed_on','implementation_id','regression_id','blocker_codes']]
  for (const year of Object.keys(TAX_YEAR_REGISTRY) as TaxYear[]) for (const category of categories) {
    const entry = SOURCE_EVIDENCE.find(e => e.year === year && e.category === category)
    rows.push([year, category, entry?.state ?? 'unassigned', entry?.documentTitle ?? '', entry?.documentUrl ?? '', entry?.documentRevision ?? '', entry?.reviewer ?? '', entry?.reviewedOn ?? '', entry?.implementationId ?? '', entry?.regressionId ?? '', evaluateEvidence(year, category).map(f => f.code).join(';')])
  }
  return rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
export function qualityChecksCsv(): string {
  const rows = [['check_id','status','description'], ...runSourceQualityChecks().map(c => [c.id,c.pass ? 'PASS' : 'FAIL',c.detail])]
  return rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}
