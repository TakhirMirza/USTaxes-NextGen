import { useMemo, useState } from 'react'
import { runFederalReconciliationRegression2025, reconciliationRegressionCsv2025 } from '../nextgen/taxYears/federalReconciliationRegression2025'
import './NextGen2025RegressionSuite.css'
export default function NextGen2025RegressionSuite(){
 const [expanded,setExpanded]=useState(false)
 const results=useMemo(()=>runFederalReconciliationRegression2025(),[])
 const passed=results.filter(result=>result.passed).length
 const exportCsv=()=>{const blob=new Blob([reconciliationRegressionCsv2025(results)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='nextgen-2025-reconciliation-regression.csv';link.click();URL.revokeObjectURL(url)}
 return <section className="v2-card ng-regression" aria-label="2025 reconciliation regression suite">
 <span className="v2-eyebrow">PHASE 14 / REGRESSION &amp; INTEGRATION</span>
 <h2>Federal reconciliation regression suite</h2>
 <p>Deterministic fictional test vectors for Form 1040 lines 18–37, Schedule 2/3 posting, missing data and arithmetic boundaries. These tests do not certify tax-law eligibility or filing readiness.</p>
 <div className="ng-regression-summary"><div><small>Scenarios</small><strong>{results.length}</strong></div><div><small>Passed</small><strong>{passed}</strong></div><div><small>Failed</small><strong>{results.length-passed}</strong></div><div><small>Filing</small><strong>Disabled</strong></div></div>
 <div className="ng-regression-actions"><button type="button" className="v2-secondary" onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide':'Show'} test results</button><button type="button" className="v2-secondary" onClick={exportCsv}>Export regression CSV</button></div>
 {expanded&&<div className="ng-regression-cases">{results.map(result=><div key={result.id}><span className={result.passed?'ng-pass':'ng-fail'}>{result.passed?'PASS':'FAIL'}</span><div><strong>{result.purpose}</strong><small>{result.id} — {result.details}</small></div></div>)}</div>}
 <p className="ng-regression-note">A passing result validates these limited arithmetic fixtures only. It does not validate IRS tax tables, credit eligibility, PDF generation, or e-filing.</p>
 </section>
}
