import { useState } from 'react'
import { BALANCE_FIELDS_2025, BALANCE_FIXTURE_2025, BalanceInputs2025, validateFederalBalance2025, federalBalanceCsv2025 } from '../nextgen/taxYears/federalBalanceValidation2025'
export default function NextGen2025FederalBalanceValidation({year}:{year:string}){
 const [values,setValues]=useState<BalanceInputs2025>({})
 const [onlyProblems,setOnlyProblems]=useState(false)
 if(year!=='2025')return null
 const report=validateFederalBalance2025(values)
 const visible=onlyProblems?BALANCE_FIELDS_2025.filter(([key])=>report.findings.some(f=>f.severity==='blocker'&&f.fields.includes(key))):BALANCE_FIELDS_2025
 const exportCsv=()=>{const blob=new Blob([federalBalanceCsv2025(report)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-phase32-federal-balance-audit.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card" aria-label="2025 federal balance validation">
 <span className="v2-eyebrow">PHASE 32 / FORM 1040 BALANCE VALIDATION</span><h2>2025 Form 1040 — tax and payment balance audit</h2>
 <p>Fictional, manually entered amounts only. Checks arithmetic across income, AGI, deductions, tax, credits, withholding, payments, refund and amount owed. Nothing is saved or posted to a return.</p>
 <div className="v2-note"><strong>FILING DISABLED.</strong> {report.passed} of {report.evaluated} evaluated checks passed. {report.missing} missing fields; {report.findings.filter(f=>f.severity==='blocker').length} blockers.</div>
 <div className="v2-form-grid"><button type="button" className="v2-secondary" onClick={()=>setValues({...BALANCE_FIXTURE_2025})}>Load fictional balanced example</button><button type="button" className="v2-secondary" onClick={()=>setValues({...BALANCE_FIXTURE_2025,l24:'8600',l34:'500',l37:'100'})}>Load intentionally inconsistent example</button><button type="button" className="v2-secondary" onClick={()=>setValues({})}>Clear worksheet</button><label><input type="checkbox" checked={onlyProblems} onChange={e=>setOnlyProblems(e.target.checked)}/> Show only fields with blockers</label></div>
 <div className="v2-form-grid">{visible.map(([key,label])=><label key={key}>{label}<input inputMode="decimal" autoComplete="off" value={values[key]??''} placeholder="0.00" onChange={e=>setValues(prev=>({...prev,[key]:e.target.value}))}/></label>)}</div>
 <h3>Validation findings ({report.findings.length})</h3><ul className="v2-blockers">{report.findings.map(f=><li key={f.code}>{f.severity.toUpperCase()} — {f.code}: {f.description}</li>)}</ul>
 <button type="button" className="v2-secondary" onClick={exportCsv}>Export Phase 32 audit CSV</button>
 </section>
}
