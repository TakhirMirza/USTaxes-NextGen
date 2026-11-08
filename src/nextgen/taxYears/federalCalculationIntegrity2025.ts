import { BridgeInput, reconcileUnifiedDocuments2025 } from './unifiedDocumentBridge2025'

/** Independent, development-only consistency checks. No tax calculation or filing approval. */
export type IntegrityIssue2025 = { id: string; severity: 'blocked' | 'review'; message: string; source: string }
export type IntegrityInput2025 = BridgeInput & { mappedWagesDollars: number | null; mappedInterestDollars: number | null; mappedWithholdingDollars: number | null }
const validDollarsToCents = (n: number | null): number | null => n !== null && Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? Math.round(n * 100) : null
export function auditFederalCalculationIntegrity2025(input: IntegrityInput2025) {
 const bridge = reconcileUnifiedDocuments2025(input)
 const issues: IntegrityIssue2025[] = bridge.findings.map(f => ({ id: f.code, severity: f.severity, message: f.detail, source: f.destination }))
 const check = (id: string, label: string, sourceCents: number | null, mappedDollars: number | null, required: boolean) => {
   const mapped = validDollarsToCents(mappedDollars)
   if (required && (sourceCents === null || mapped === null)) issues.push({ id: `${id}_MISSING`, severity: 'blocked', message: `${label} is missing from source or mapped Form 1040 preview.`, source: label })
   else if (required && sourceCents !== mapped) issues.push({ id: `${id}_MISMATCH`, severity: 'blocked', message: `${label} source amount does not equal the mapped Form 1040 preview.`, source: label })
   else if (!required && mapped !== null && mapped !== 0) issues.push({ id: `${id}_UNSELECTED`, severity: 'blocked', message: `${label} is mapped despite the corresponding source being unselected.`, source: label })
 }
 const activeWages = input.wageEntries.some(w => w.employer.trim() || w.wages.trim() || w.withholding.trim())
 check('WAGES', 'W-2 wages / Form 1040 line 1a', activeWages ? bridge.wageCents : null, input.mappedWagesDollars, activeWages)
 check('WITHHOLDING', 'W-2 withholding / Form 1040 line 25a', activeWages ? bridge.withholdingCents : null, input.mappedWithholdingDollars, activeWages)
 check('INTEREST', '1099-INT interest / Form 1040 line 2b', bridge.interest1040Cents, input.mappedInterestDollars, input.interestSelected)
 if (input.scheduleB.dividends.trim()) issues.push({ id: 'DIVIDEND_TAX_METHOD', severity: 'blocked', message: 'Qualified dividend and special tax computation method remain unverified.', source: 'Schedule B' })
 issues.push({ id: 'TAX_RULES_NOT_CERTIFIED', severity: 'review', message: 'This audit checks source consistency only. Tax-year rules, eligibility, tax, credits, payments and filing are not certified.', source: 'Form 1040' })
 const blocked = issues.filter(i => i.severity === 'blocked').length
 return { issues, blocked, reviewed: issues.length - blocked, checked: 3, readyForFiling: false as const }
}
export function integrityFindingsCsv2025(issues: IntegrityIssue2025[]) {
 const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
 return [['Severity','Code','Source','Finding'], ...issues.map(i => [i.severity,i.id,i.source,i.message])].map(row => row.map(quote).join(',')).join('\r\n')
}
