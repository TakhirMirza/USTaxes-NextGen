import { ReactElement, useMemo, useState } from 'react'
import { BridgeInput2025 } from '../nextgen/taxYears/form1040IncomeBridge2025'
import { calculationGateCsv2025, evaluateFederalCalculationGate2025 } from '../nextgen/taxYears/federalCalculationGate2025'
import './NextGen2025CalculationGate.css'
interface Props { input: BridgeInput2025; onNavigate: (step: 'income' | 'review') => void }
export default function NextGen2025CalculationGate({ input, onNavigate }: Props): ReactElement {
  const report = useMemo(()=>evaluateFederalCalculationGate2025(input),[input])
  const [issuesOnly,setIssuesOnly] = useState(false)
  const exportStatus = ():void => {
    const blob = new Blob([calculationGateCsv2025(report)],{type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='nextgen-2025-calculation-readiness.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="v2-card ng-calc-gate" aria-label="2025 federal calculation readiness">
    <span className="v2-eyebrow">FORM 1040 / 2025 / CALCULATION READINESS</span>
    <h2>Federal calculation coverage &amp; posting gate</h2>
    <p>One consolidated view of source evidence, Schedule 1 reconciliation, and missing federal tax calculation capabilities. This is a development diagnostic, not a tax return or filing approval.</p>
    <div className="ng-calc-gate-summary"><div><small>Blocking gaps</small><strong>{report.blockers}</strong></div><div><small>Review items</small><strong>{report.reviews}</strong></div><div><small>Filing</small><strong>Disabled</strong></div></div>
    <div className="ng-calc-gate-actions"><button type="button" onClick={()=>onNavigate('income')}>Review income</button><button type="button" className="v2-secondary" onClick={()=>onNavigate('review')}>Return review</button><button type="button" className="v2-secondary" onClick={exportStatus}>Export status CSV</button><label><input type="checkbox" checked={issuesOnly} onChange={e=>setIssuesOnly(e.target.checked)}/> Gaps only</label></div>
    <div className="ng-calc-gate-table"><table><thead><tr><th>Form 1040</th><th>Coverage</th><th>Explanation</th></tr></thead><tbody>{report.rows.filter(r=>!issuesOnly||r.status!=='verified-source').map(r=><tr key={r.key}><td>{r.label}</td><td>{r.status}</td><td>{r.note}</td></tr>)}</tbody></table></div>
    <details><summary>{report.findings.length} calculation and evidence findings</summary><ul className="v2-blockers">{report.findings.map(f=><li key={f.id}><strong>{f.area.toUpperCase()} — {f.id}</strong><div>{f.message}</div><small>{f.nextStep}</small></li>)}</ul></details>
    <p className="ng-calc-gate-disclaimer">Amounts and eligibility have not been independently validated against the complete 2025 IRS instructions. No tax owed, refund, completed Form 1040, PDF filing, or e-file is authorized.</p>
  </section>
}
