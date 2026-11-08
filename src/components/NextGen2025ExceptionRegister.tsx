import { useState } from 'react'
import { IntegrityInput2025 } from '../nextgen/taxYears/federalCalculationIntegrity2025'
import { buildFederalExceptionRegister2025, exceptionRegisterCsv2025, ExceptionItem2025 } from '../nextgen/taxYears/federalExceptionRegister2025'

type Filter = 'all' | ExceptionItem2025['severity']
export default function NextGen2025ExceptionRegister({input,onNavigate}:{input:IntegrityInput2025;onNavigate:(step:'income'|'deductions')=>void}) {
  const [filter,setFilter] = useState<Filter>('all')
  const report = buildFederalExceptionRegister2025(input)
  const visible = filter === 'all' ? report.items : report.items.filter(item=>item.severity===filter)
  const exportCsv = () => {
    const csv = exceptionRegisterCsv2025(report.items)
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    const link = document.createElement('a'); link.href=url; link.download='nextgen-2025-exception-register.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <section className="v2-card" aria-label="2025 federal return exception register">
    <span className="v2-eyebrow">PHASE 24 / EXCEPTION MANAGEMENT</span>
    <h2>Federal return — consolidated exception register</h2>
    <p>Prioritized, read-only findings from source integrity checks and mandatory filing coverage controls. A cleared source exception is not a tax or filing approval.</p>
    <div className="v2-review-grid"><div><span>Blocking discrepancies</span><strong>{report.counts.blocker}</strong></div><div><span>Unverified coverage</span><strong>{report.counts.coverage}</strong></div><div><span>Review notices</span><strong>{report.counts.review}</strong></div><div><span>Filing authorization</span><strong>NOT READY</strong></div></div>
    <label>Filter findings <select value={filter} onChange={event=>setFilter(event.target.value as Filter)}><option value="all">All ({report.items.length})</option><option value="blocker">Blockers ({report.counts.blocker})</option><option value="coverage">Coverage ({report.counts.coverage})</option><option value="review">Review ({report.counts.review})</option></select></label>
    <ul className="v2-blockers" aria-live="polite">{visible.map(item=><li key={item.id}><strong>{item.severity.toUpperCase()} · {item.id}</strong><div>{item.detail}</div><small>{item.category.toUpperCase()}</small>{item.action!=='none' && <div><button type="button" className="v2-text-button" onClick={()=>onNavigate(item.action as 'income'|'deductions')}>Open {item.action} step</button></div>}</li>)}</ul>
    <button type="button" className="v2-secondary" onClick={exportCsv}>Export exception register CSV (no amounts or identities)</button>
    <div className="v2-note"><strong>Development-only diagnostics.</strong> This register does not certify 2025 IRS rules, calculate a complete return, store sensitive tax data, or enable filing.</div>
  </section>
}
