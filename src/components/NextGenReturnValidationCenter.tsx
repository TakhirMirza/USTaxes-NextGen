import { useState } from 'react'
import NextGenFieldResolutionWorkspace from './NextGenFieldResolutionWorkspace'
import type { MappingReport } from '../nextgen/taxYears/form1040Mapping'
import type { ReturnGraph } from '../nextgen/taxYears/federalReturnGraph'
import { runValidationFixtures, validateFederalReturn, validationCsv } from '../nextgen/taxYears/returnValidationCenter'
import type { IssueCategory, IssueSeverity } from '../nextgen/taxYears/returnValidationCenter'
import { buildResolutionSteps, issueArea, resolutionGuideCsv, resolutionSummary, runResolutionGuideFixtures } from '../nextgen/taxYears/returnResolutionGuide'
import './NextGenReturnValidationCenter.css'

function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function NextGenReturnValidationCenter({ mapping, graph }: { mapping: MappingReport; graph: ReturnGraph }) {
  const report = validateFederalReturn(mapping, graph)
  const fixtures = [...runValidationFixtures(), ...runResolutionGuideFixtures()]
  const [severity, setSeverity] = useState<IssueSeverity | 'all'>('all')
  const [category, setCategory] = useState<IssueCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string[]>([])
  const [reviewedIds, setReviewedIds] = useState<string[]>([])
  const [activeArea, setActiveArea] = useState<string>('all')
  const steps = buildResolutionSteps(report)
  const summary = resolutionSummary(report, reviewedIds)
  const filtered = report.issues.filter(i => (severity === 'all' || i.severity === severity) && (category === 'all' || i.category === category) && (activeArea === 'all' || issueArea(i) === activeArea) && `${i.title} ${i.description} ${i.location} ${i.id}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="ng-valid" aria-label="Federal return validation and guided resolution">
    <span className="v2-eyebrow">PHASE 48 / GUIDED RESOLUTION</span>
    <h3>Return validation &amp; guided resolution</h3>
    <p>Work through the unresolved findings by source area. Reviewing a finding is a personal checklist action only: it never changes the underlying validation, amounts or filing status.</p>
    <div className="ng-valid-stats"><div><small>Blocking findings</small><strong>{report.blockers}</strong></div><div><small>Warnings</small><strong>{report.warnings}</strong></div><div><small>Reviewed findings</small><strong>{summary.reviewed}/{summary.total}</strong></div><div><small>Regression checks</small><strong>{fixtures.filter(f=>f.passed).length}/{fixtures.length}</strong></div></div>
    <p className="ng-valid-banner"><strong>FILING DISABLED.</strong> Even if every finding is reviewed, the return is not approved for real tax preparation, PDF filing or e-file.</p>
    <div className="ng-valid-guide"><h4>Suggested resolution order</h4><div className="ng-valid-steps">{steps.map((step,index)=><button type="button" key={step.area} className={activeArea===step.area?'ng-valid-step active':'ng-valid-step'} onClick={()=>setActiveArea(activeArea===step.area?'all':step.area)} aria-pressed={activeArea===step.area}><strong>{index+1}. {step.area}</strong><small>{step.blockers} blockers · {step.issues.length} findings</small><span>{step.nextAction}</span></button>)}</div></div>
    <div className="ng-valid-toolbar"><label>Severity <select value={severity} onChange={e=>setSeverity(e.target.value as IssueSeverity | 'all')}><option value="all">All</option><option value="blocker">Blockers</option><option value="warning">Warnings</option><option value="notice">Notices</option></select></label><label>Category <select value={category} onChange={e=>setCategory(e.target.value as IssueCategory | 'all')}><option value="all">All</option><option value="source">Source</option><option value="mapping">Mapping</option><option value="cross-form">Cross-form</option><option value="tax-year">Tax year</option><option value="filing">Filing</option></select></label><label>Find issue <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search line, code or issue" /></label><button type="button" onClick={()=>{setActiveArea('all');setSeverity('all');setCategory('all');setQuery('')}}>Clear filters</button><button type="button" onClick={()=>downloadCsv(resolutionGuideCsv(report,reviewedIds),'nextgen-phase48-resolution-guide.csv')}>Export resolution CSV</button><button type="button" onClick={()=>downloadCsv(validationCsv(report),'nextgen-validation-findings.csv')}>Export findings CSV</button></div>
    <div className="ng-valid-list" aria-live="polite"><p>{filtered.length} of {report.issues.length} findings shown · {summary.unreviewed} not yet reviewed</p>{filtered.map(i=><article key={i.id} className={`ng-valid-item ng-valid-${i.severity}`}><button type="button" aria-expanded={expanded.includes(i.id)} onClick={()=>setExpanded(current=>current.includes(i.id)?current.filter(id=>id!==i.id):[...current,i.id])}><span><strong>{i.severity.toUpperCase()}</strong> · {i.title}<small>{i.location} · {issueArea(i)} · {i.id}</small></span><span>{expanded.includes(i.id)?'Hide details −':'Details +'}</span></button>{expanded.includes(i.id)&&<div className="ng-valid-detail"><p>{i.description}</p><p><strong>Next step:</strong> {i.nextStep}</p><label className="ng-valid-review"><input type="checkbox" checked={reviewedIds.includes(i.id)} onChange={e=>setReviewedIds(current=>e.target.checked?[...current.filter(id=>id!==i.id),i.id]:current.filter(id=>id!==i.id))}/> I have reviewed this finding (does not resolve it)</label><p><small>Validation status: {i.status}. No automatic changes to tax data.</small></p></div>}</article>)}</div>
    <NextGenFieldResolutionWorkspace key={report.year} year={report.year} issues={report.issues} />
    <details className="ng-valid-tests"><summary>Regression results ({fixtures.filter(f=>f.passed).length}/{fixtures.length})</summary><ul>{fixtures.map(f=><li key={f.name}>{f.passed?'PASS':'FAIL'} — {f.name}</li>)}</ul></details>
  </section>
}
