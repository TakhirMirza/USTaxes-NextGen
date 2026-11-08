import { ReactElement, useState } from 'react'
import { auditTaxYear, CAPABILITIES, CAPABILITY_LABELS, capabilityForYear, TAX_YEAR_REGISTRY, TaxYear, yearAuditCsv } from '../nextgen/taxYears/multiYearRegistry'
import './NextGenMultiYearCenter.css'

export default function NextGenMultiYearCenter({ activeYear }: { activeYear: string }): ReactElement {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<TaxYear>('2025')
  const audit = auditTaxYear(selected)
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([yearAuditCsv()], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'nextgen-tax-year-capability-audit.csv'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="v2-card ng-year-center" aria-label="Multi-year tax architecture">
    <div className="ng-year-header"><div><span className="v2-eyebrow">PHASE 40 / MULTI-YEAR ARCHITECTURE</span><h2>Tax-year capability center</h2><p>Separate annual tax rules and development features. A preview is never authorization to prepare or file a real return.</p></div><button type="button" onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide year matrix' : 'Explore 2025–2028'}</button></div>
    <div className="ng-year-stats"><div><small>Active draft</small><strong>{activeYear}</strong></div><div><small>Registered years</small><strong>4</strong></div><div><small>Production-ready years</small><strong>0</strong></div><div><small>Filing</small><strong>Disabled</strong></div></div>
    {expanded && <><div className="ng-year-tabs" role="group" aria-label="Inspect tax year">{(Object.keys(TAX_YEAR_REGISTRY) as TaxYear[]).map(year => <button type="button" aria-pressed={selected === year} className={selected === year ? 'selected' : ''} key={year} onClick={() => setSelected(year)}>{year}</button>)}</div>
      <p className="ng-year-alert"><strong>{TAX_YEAR_REGISTRY[selected].label}.</strong> {audit.previewCount} preview capabilities; {audit.blockedCount + audit.unimplementedCount} unavailable. Filing is disabled for every year.</p>
      <div className="ng-year-matrix">{CAPABILITIES.map(capability => { const status = capabilityForYear(selected, capability); return <div key={capability}><span>{CAPABILITY_LABELS[capability]}</span><strong data-status={status}>{status === 'preview' ? 'Preview only' : status === 'blocked' ? 'Blocked' : 'Not implemented'}</strong></div> })}</div>
      <h3>Release blockers</h3><ul>{audit.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
      <button type="button" onClick={download}>Export four-year architecture CSV</button><p className="ng-year-footnote">No cross-year calculations or draft migration are performed. The current 2025 preview remains unchanged.</p>
    </>}
  </section>
}
