import NextGenFederalReturnGraph from './NextGenFederalReturnGraph'
import { useState } from 'react'
import type { CalcReport } from '../nextgen/taxYears/calculationPipeline'
import { formatCents } from '../nextgen/taxYears/calculationPipeline'
import { mapForm1040, mappingCsv, runMappingFixtures } from '../nextgen/taxYears/form1040Mapping'
import './NextGenForm1040Mapping.css'

function downloadCsv(csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'nextgen-phase45-form1040-mapping.csv'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function NextGenForm1040Mapping({ pipeline }: { pipeline: CalcReport }) {
  const [showFindings, setShowFindings] = useState(false)
  const [unresolvedOnly, setUnresolvedOnly] = useState(false)
  const report = mapForm1040(pipeline)
  const fixtures = runMappingFixtures()
  return <section className="ng-map" aria-label="Form 1040 diagnostic mapping">
    <span className="v2-eyebrow">PHASE 45 / FORM 1040 SOURCE MAPPING</span>
    <h3>Form 1040 source-to-line integration</h3>
    <p>Non-posting candidate map for fictional data. Candidate values are <strong>not</strong> official Form 1040 lines. Unsupported rules and incomplete totals remain unavailable.</p>
    <div className="ng-map-metrics"><div><small>Source candidates</small><strong>{report.candidates}</strong></div><div><small>Blocked</small><strong>{report.blocked}</strong></div><div><small>Not implemented</small><strong>{report.notImplemented}</strong></div><div><small>Regression checks</small><strong>{fixtures.filter(f => f.passed).length}/{fixtures.length}</strong></div></div>
    <div className="ng-map-warning"><strong>FILING / FORM POSTING DISABLED.</strong> The map does not calculate IRS tax liability, authorize credits, produce a return or enable e-file.</div>
    <div className="ng-map-actions"><button type="button" onClick={() => setShowFindings(v => !v)}>{showFindings ? 'Hide' : 'Show'} findings</button><button type="button" onClick={() => setUnresolvedOnly(v => !v)}>{unresolvedOnly ? 'Show all lines' : 'Unresolved only'}</button><button type="button" onClick={() => downloadCsv(mappingCsv(report))}>Export mapping CSV</button></div>
    <div className="ng-map-table-wrap"><table className="ng-map-table"><thead><tr><th>1040 line</th><th>Mapping</th><th>Source</th><th>Status / candidate</th></tr></thead><tbody>{report.lines.filter(l => !unresolvedOnly || l.status !== 'candidate').map(l => <tr key={l.line}><td><strong>{l.line}</strong></td><td>{l.label}{showFindings && l.findings.length > 0 && <ul>{l.findings.map((issue,i) => <li key={i}>{issue}</li>)}</ul>}</td><td>{l.source.join(', ')}</td><td><strong>{l.status.replace(/-/g,' ')}</strong>{l.cents !== null && <div>{formatCents(l.cents)} (source only)</div>}</td></tr>)}</tbody></table></div>
    <NextGenFederalReturnGraph mapping={report} />
    {showFindings && <div className="ng-map-tests"><h4>Deterministic mapping fixtures</h4><ul>{fixtures.map(f => <li key={f.name}>{f.passed ? 'PASS' : 'FAIL'} — {f.name}</li>)}</ul></div>}
  </section>
}
