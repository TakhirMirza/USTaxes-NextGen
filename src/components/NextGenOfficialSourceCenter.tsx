import { useState } from 'react'
import { auditOfficialSources, IRS_PRIOR_YEAR_PORTAL, IRS_REFERENCE_PORTAL, qualityChecksCsv, runSourceQualityChecks, sourceAuditCsv } from '../nextgen/taxYears/officialSourceAudit'
import { type TaxYear, isSupportedTaxYear } from '../nextgen/taxYears/multiYearRegistry'
import './NextGenOfficialSourceCenter.css'

function exportCsv(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
export default function NextGenOfficialSourceCenter({ activeYear }: { activeYear: string }) {
  const [selectedYear, setSelectedYear] = useState<TaxYear>(isSupportedTaxYear(activeYear) ? activeYear : '2025')
  const [showFindings, setShowFindings] = useState(false)
  const [showChecks, setShowChecks] = useState(false)
  const audit = auditOfficialSources(selectedYear)
  const checks = runSourceQualityChecks()
  const passed = checks.filter(check => check.pass).length
  return <section className="v2-card ng-official-source" aria-label="Annual IRS source verification workbench">
    <span className="v2-eyebrow">PHASE 42 / OFFICIAL SOURCE & QUALITY GATES</span>
    <h2>IRS source verification and tax-year QA</h2>
    <p>Document annual rule provenance, review requirements and deterministic architecture checks. Official links alone do not certify tax computations.</p>
    <div className="ng-os-year" role="group" aria-label="Select year for IRS source audit">
      {(['2025','2026','2027','2028'] as const).map(year => <button type="button" key={year} aria-pressed={selectedYear === year} onClick={() => setSelectedYear(year)}>{year}</button>)}
    </div>
    <div className="ng-os-stats"><div><small>Rule areas</small><strong>{audit.total}</strong></div><div><small>Sources missing</small><strong>{audit.missing}</strong></div><div><small>Source blockers</small><strong>{audit.blockers}</strong></div><div><small>Architecture checks</small><strong>{passed}/{checks.length}</strong></div></div>
    <p className="ng-os-blocked"><strong>Filing and calculation remain disabled.</strong> {selectedYear} source coverage is not approved. No tax amounts are posted by this module.</p>
    <div className="ng-os-actions"><button type="button" onClick={() => setShowFindings(value => !value)}>{showFindings ? 'Hide source findings' : 'Show source findings'}</button><button type="button" onClick={() => setShowChecks(value => !value)}>{showChecks ? 'Hide QA checks' : 'Show QA checks'}</button><button type="button" onClick={() => exportCsv('nextgen-phase42-source-audit.csv', sourceAuditCsv())}>Export source audit CSV</button><button type="button" onClick={() => exportCsv('nextgen-phase42-quality-checks.csv', qualityChecksCsv())}>Export QA CSV</button></div>
    {showFindings && <div className="ng-os-detail"><h3>{selectedYear} — source findings ({audit.findings.length})</h3><ul>{audit.findings.map((finding, index) => <li key={`${finding.category}-${finding.code}-${index}`}><strong>{finding.category}: {finding.code}</strong> — {finding.detail}</li>)}</ul></div>}
    {showChecks && <div className="ng-os-detail"><h3>Architecture checks ({checks.length})</h3><ul>{checks.map(check => <li key={check.id}><strong>{check.pass ? 'PASS' : 'FAIL'} — {check.id}</strong>: {check.detail}</li>)}</ul></div>}
    <p className="ng-os-note">Reference libraries: <a href={IRS_REFERENCE_PORTAL} target="_blank" rel="noopener noreferrer">IRS forms and instructions</a> · <a href={IRS_PRIOR_YEAR_PORTAL} target="_blank" rel="noopener noreferrer">IRS prior-year forms</a>. Sources must be selected and reviewed for each tax year. Development-only; no real taxpayer data.</p>
  </section>
}
