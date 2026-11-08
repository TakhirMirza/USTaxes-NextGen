import NextGenForm1040Mapping from './NextGenForm1040Mapping'
import { useState } from 'react'
import type { CalcReport } from '../nextgen/taxYears/calculationPipeline'
import { formatCents } from '../nextgen/taxYears/calculationPipeline'
import { orchestrateCalculation, orchestrationCsv, runOrchestrationFixtures } from '../nextgen/taxYears/calculationOrchestrator'
import './NextGenCalculationOrchestrator.css'

function downloadCsv(contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'nextgen-phase44-orchestration-audit.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function NextGenCalculationOrchestrator({ pipeline }: { pipeline: CalcReport }) {
  const [details, setDetails] = useState(false)
  const report = orchestrateCalculation(pipeline)
  const fixtures = runOrchestrationFixtures()
  return <section className="ng-orch" aria-label="Calculation orchestration audit">
    <span className="v2-eyebrow">PHASE 44 / CALCULATION ORCHESTRATION</span>
    <h3>Federal calculation stages and source lineage</h3>
    <p>Read-only coordination of fictional source amounts. No IRS tax liability is calculated and no data is posted to a return.</p>
    <div className="ng-orch-stats"><div><small>Ready for review</small><strong>{report.ready}</strong></div><div><small>Blocked</small><strong>{report.blocked}</strong></div><div><small>Not implemented</small><strong>{report.notImplemented}</strong></div><div><small>Regression checks</small><strong>{fixtures.filter(f => f.passed).length}/{fixtures.length}</strong></div></div>
    <div className="ng-orch-warning"><strong>FILING DISABLED.</strong> A passing arithmetic stage is not a validated Form 1040 line. Missing values remain unknown.</div>
    <div className="ng-orch-actions"><button type="button" onClick={() => setDetails(v => !v)}>{details ? 'Hide' : 'Show'} stage diagnostics</button><button type="button" onClick={() => downloadCsv(orchestrationCsv(report))}>Export orchestration CSV</button></div>
    <div className="ng-orch-stages">{report.stages.map(stage => <article key={stage.id}><div><strong>{stage.label}</strong><span>{stage.status.replace(/-/g, ' ')}</span></div><small>Sources: {stage.sourceNodes.join(', ')}</small><p>{stage.amountCents === null ? 'No certified amount' : formatCents(stage.amountCents) + ' — arithmetic preview only'}</p>{details && <ul>{stage.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}</article>)}</div>
    {details && <div className="ng-orch-tests"><h4>Deterministic regression checks</h4><ul>{fixtures.map(f => <li key={f.name}>{f.passed ? 'PASS' : 'FAIL'} — {f.name}</li>)}</ul></div>}
    <NextGenForm1040Mapping pipeline={pipeline} />
  </section>
}
