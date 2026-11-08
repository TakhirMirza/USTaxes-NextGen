import { useState } from 'react'
import type { MappingReport } from '../nextgen/taxYears/form1040Mapping'
import { buildFederalReturnGraph, graphCsv, runGraphFixtures } from '../nextgen/taxYears/federalReturnGraph'
import './NextGenFederalReturnGraph.css'

function downloadCsv(csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'nextgen-phase46-cross-form-graph.csv'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function NextGenFederalReturnGraph({ mapping }: { mapping: MappingReport }) {
  const [details, setDetails] = useState(false)
  const [blockedOnly, setBlockedOnly] = useState(false)
  const graph = buildFederalReturnGraph(mapping)
  const fixtures = runGraphFixtures()
  return <section className="ng-graph" aria-label="Federal return cross-form dependency graph">
    <span className="v2-eyebrow">PHASE 46 / FEDERAL RETURN DATA MODEL</span>
    <h3>Cross-form document dependency graph</h3>
    <p>Diagnostic relationships between W-2, 1099-INT, Schedules C and 1–3, and Form 1040. Only source candidates are shown; missing amounts are never assumed to be zero.</p>
    <div className="ng-graph-stats"><div><small>Document nodes</small><strong>{graph.documents.length}</strong></div><div><small>Candidate edges</small><strong>{graph.candidateLinks}</strong></div><div><small>Unresolved edges</small><strong>{graph.blockedLinks}</strong></div><div><small>Regression checks</small><strong>{fixtures.filter(f => f.passed).length}/{fixtures.length}</strong></div></div>
    <div className="ng-graph-warning"><strong>FILING AND FORM POSTING DISABLED.</strong> This graph is not an official return, tax calculation or eligibility determination.</div>
    <div className="ng-graph-actions"><button type="button" onClick={() => setDetails(v => !v)}>{details ? 'Hide' : 'Show'} diagnostics</button><button type="button" onClick={() => setBlockedOnly(v => !v)}>{blockedOnly ? 'All edges' : 'Unresolved only'}</button><button type="button" onClick={() => downloadCsv(graphCsv(graph))}>Export graph CSV</button></div>
    <div className="ng-graph-nodes">{graph.documents.map(doc => <article key={doc.id}><strong>{doc.kind}</strong><small>{doc.label}</small></article>)}</div>
    <div className="ng-graph-scroll"><table><thead><tr><th>Source</th><th>Destination</th><th>1040 line</th><th>State</th><th>Candidate</th></tr></thead><tbody>{graph.links.filter(link => !blockedOnly || link.status !== 'candidate').map(link => <tr key={`${link.from}-${link.line}`}><td>{graph.documents.find(doc => doc.id === link.from)?.kind}</td><td>Form 1040</td><td>{link.line}</td><td>{link.status}</td><td>{link.cents === null ? 'Unavailable' : `$${(link.cents / 100).toFixed(2)} (source only)`}{details && <ul>{link.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul>}</td></tr>)}</tbody></table></div>
    {details && <div className="ng-graph-findings"><h4>Blocking and informational findings</h4><ul>{graph.findings.map(finding => <li key={finding.code}><strong>{finding.code}:</strong> {finding.message}</li>)}</ul><h4>Deterministic regression checks</h4><ul>{fixtures.map(fixture => <li key={fixture.name}>{fixture.passed ? 'PASS' : 'FAIL'} — {fixture.name}</li>)}</ul></div>}
  </section>
}
