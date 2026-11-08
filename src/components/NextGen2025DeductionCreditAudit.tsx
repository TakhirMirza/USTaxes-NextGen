import { useMemo } from 'react'
import { auditDeductionAndCredits2025, deductionCreditAuditCsv2025, DeductionCreditInput } from '../nextgen/taxYears/federalDeductionCreditReview2025'
import './NextGen2025DeductionCreditAudit.css'
const money=(c:number)=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function NextGen2025DeductionCreditAudit({input}:{input:DeductionCreditInput}) {
  const result=useMemo(()=>auditDeductionAndCredits2025(input),[input.year,input.filingStatus,input.adjustedGrossIncomeCents,input.deductionCents,input.selectedDeduction,input.baseDeductionReviewed,input.dependentEligibilityReviewed,input.noOtherItemsConfirmed,input.sourceValidated,input.specialTaxMethodsExcluded])
  const download=()=>{const blob=new Blob([deductionCreditAuditCsv2025(result)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-deduction-credit-audit.csv';a.click();URL.revokeObjectURL(url)}
  return <section className="v2-card ng-deduction-audit" aria-label="Deduction and credit eligibility audit">
    <span className="v2-eyebrow">PHASE 12 / 2025 / FEDERAL DEDUCTIONS &amp; CREDITS</span>
    <h2>Deduction and credit eligibility audit</h2>
    <p>Cross-checks source AGI, the simplified standard deduction, filing status and credit exclusions. It does not silently treat unreviewed credits as zero.</p>
    <div className="ng-deduction-summary"><div><small>Checks passed</small><strong>{result.verifiedCount}</strong></div><div><small>Blocking checks</small><strong>{result.blockedCount}</strong></div><div><small>2025 base deduction</small><strong>{result.standardDeductionBaseCents===null?'Unknown':money(result.standardDeductionBaseCents)}</strong></div><div><small>Restricted taxable income</small><strong>{result.taxableIncomeCents===null?'Blocked':money(result.taxableIncomeCents)}</strong></div></div>
    <div className="ng-deduction-findings">{result.findings.map(f=><div key={f.id} className="ng-deduction-finding"><strong>{f.state==='verified'?'PASS':'BLOCKED'} — {f.title}</strong><span>Form 1040: {f.form1040Lines.join(', ')}</span>{f.state==='blocked'&&<p>{f.explanation}</p>}</div>)}</div>
    <button type="button" className="v2-secondary" onClick={download}>Download eligibility audit CSV</button>
    <div className="v2-note"><strong>Filing remains disabled.</strong> This restricted audit does not calculate Schedule A, child tax credit, earned income credit, education credits, additional taxes, refund, or final Form 1040. Use fictional test data only.</div>
  </section>
}
