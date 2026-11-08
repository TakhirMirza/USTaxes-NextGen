import { useState } from 'react'
import { INPUTS, evaluatePipeline, formatCents, pipelineCsv, runPipelineFixtures, type NodeId } from '../nextgen/taxYears/calculationPipeline'
import './NextGenCalculationPipeline.css'

const empty = (): Partial<Record<NodeId, string>> => ({})
function saveCsv(contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'nextgen-phase43-calculation-diagnostics.csv'; anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function NextGenCalculationPipeline({ activeYear }: { activeYear: string }) {
  const [inputs, setInputs] = useState<Partial<Record<NodeId, string>>>(empty)
  const [showIssues, setShowIssues] = useState(false)
  const report = evaluatePipeline(activeYear, inputs)
  const fixtures = runPipelineFixtures()
  return <section className="v2-card ng-calc" aria-label="Federal calculation pipeline development preview">
    <span className="v2-eyebrow">PHASE 43 / CALCULATION PIPELINE</span>
    <h2>Tax-year calculation dependency engine</h2>
    <p>Independent, fictional arithmetic workbench. Derived figures are <strong>not</strong> certified Form 1040 values and are never posted to a return.</p>
    <div className="ng-calc-metrics"><div><small>Tax year</small><strong>{activeYear}</strong></div><div><small>Known nodes</small><strong>{report.known}/{report.nodes.length}</strong></div><div><small>Unresolved</small><strong>{report.unresolved}</strong></div><div><small>Regression fixtures</small><strong>{fixtures.filter(f => f.passed).length}/{fixtures.length}</strong></div></div>
    <div className="ng-calc-alert"><strong>CALCULATION / FILING BLOCKED.</strong> This is a non-posting sandbox. Missing amounts never default to zero. Do not enter actual taxpayer information.</div>
    <h3>Fictional source amounts</h3>
    <div className="ng-calc-fields">{INPUTS.map(input => <label key={input.id}><span>{input.label}</span><input inputMode="decimal" value={inputs[input.id] ?? ''} placeholder="Blank = unknown" onChange={event => setInputs(previous => ({ ...previous, [input.id]: event.target.value }))}/></label>)}</div>
    <div className="ng-calc-actions"><button type="button" onClick={() => setInputs({ ...Object.fromEntries(INPUTS.map(item => [item.id, '0.00'])), wages: '50000.00', interest: '125.25', business: '-250.00', adjustments: '1000.00', deductions: '15000.00', withholding: '7000.00', estimatedPayments: '500.00' })}>Load fictional test case</button><button type="button" onClick={() => setInputs(empty())}>Clear</button><button type="button" onClick={() => saveCsv(pipelineCsv(report))}>Export diagnostic CSV</button><button type="button" onClick={() => setShowIssues(value => !value)}>{showIssues ? 'Hide' : 'Show'} blockers ({report.blockers.length})</button></div>
    <h3>Dependency graph — read-only arithmetic</h3>
    <div className="ng-calc-results">{report.nodes.filter(node => node.dependencies.length > 0).map(node => <div key={node.id}><small>{node.label}</small><strong>{node.state === 'known' ? formatCents(node.cents) : node.state.toUpperCase()}</strong><span>Sources: {node.dependencies.join(' + ')}</span></div>)}</div>
    {showIssues && <div className="ng-calc-issues"><h3>Blocking findings</h3><ul>{report.blockers.map((issue, i) => <li key={i}>{issue}</li>)}</ul><h3>Fixture checks</h3><ul>{fixtures.map(f => <li key={f.name}>{f.passed ? 'PASS' : 'FAIL'} — {f.name}</li>)}</ul></div>}
  </section>
}
