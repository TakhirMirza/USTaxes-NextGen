import { useMemo, useState } from 'react'
import { Cents, FederalCreditBalanceInput2025, reconcileFederalCreditBalance2025, federalCreditBalanceCsv2025 } from '../nextgen/taxYears/federal1040CreditBalance2025'
import './NextGen2025CreditBalance.css'
const fields:[keyof Omit<FederalCreditBalanceInput2025,'year'|'line16Tax'|'line25Withholding'>,string][]=[
 ['line17Schedule2Part1','Schedule 2 Part I — line 17'],
 ['line19ChildDependentCredit','Child/dependent credit — line 19'],
 ['line20Schedule3Part1','Schedule 3 Part I — line 20'],
 ['line23Schedule2Part2','Schedule 2 Part II — line 23'],
 ['line26EstimatedPayments','Estimated payments — line 26'],
 ['line27EarnedIncomeCredit','EIC — line 27'],
 ['line28AdditionalChildTaxCredit','Additional child tax credit — line 28'],
 ['line29EducationCredit','Refundable education credit — line 29'],
 ['line31Schedule3Part2','Schedule 3 Part II — line 31']]
const parse=(s:string):Cents=> /^\d+(?:\.\d{1,2})?$/.test(s.trim())&&Number.isSafeInteger(Math.round(Number(s)*100))?Math.round(Number(s)*100):null
const fmt=(v:Cents)=>v===null?'Unverified':(v/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function NextGen2025CreditBalance({year,verifiedTaxCents,withholdingCents}:{year:string;verifiedTaxCents:Cents;withholdingCents:Cents}) {
 const [values,setValues]=useState<Record<string,string>>({})
 const [confirmed,setConfirmed]=useState<Record<string,boolean>>({})
 const [showDetails,setShowDetails]=useState(false)
 const input=useMemo<FederalCreditBalanceInput2025>(()=>{
   const amount=(key:string)=>confirmed[key]?parse(values[key]||''):null
   return {year,line16Tax:verifiedTaxCents,line25Withholding:withholdingCents,
    line17Schedule2Part1:amount('line17Schedule2Part1'),line19ChildDependentCredit:amount('line19ChildDependentCredit'),
    line20Schedule3Part1:amount('line20Schedule3Part1'),line23Schedule2Part2:amount('line23Schedule2Part2'),
    line26EstimatedPayments:amount('line26EstimatedPayments'),line27EarnedIncomeCredit:amount('line27EarnedIncomeCredit'),
    line28AdditionalChildTaxCredit:amount('line28AdditionalChildTaxCredit'),line29EducationCredit:amount('line29EducationCredit'),
    line31Schedule3Part2:amount('line31Schedule3Part2')}
 },[year,verifiedTaxCents,withholdingCents,values,confirmed])
 const result=useMemo(()=>reconcileFederalCreditBalance2025(input),[input])
 const exportCsv=()=>{const blob=new Blob([federalCreditBalanceCsv2025(result)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-credit-payment-reconciliation.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card ng-credit-balance" aria-label="2025 credit and payment reconciliation">
  <span className="v2-eyebrow">PHASE 13 / FORM 1040 / SCHEDULES 2 &amp; 3</span>
  <h2>Credits, additional taxes and payment reconciliation</h2>
  <p>Restricted arithmetic ledger. No credit is awarded automatically. Unknown values stay unverified; enter 0 only after confirming that the line does not apply. Use fictional training data only.</p>
  <div className="ng-credit-stats"><div><small>Line 16 — tax</small><strong>{fmt(verifiedTaxCents)}</strong></div><div><small>Line 25 — withholding</small><strong>{fmt(withholdingCents)}</strong></div><div><small>Reconciliation</small><strong>{result.status==='blocked'?'Blocked':'Arithmetic only'}</strong></div></div>
  <button type="button" className="v2-secondary" onClick={()=>setShowDetails(v=>!v)}>{showDetails?'Hide':'Open'} credit and payment ledger</button>
  {showDetails&&<><div className="ng-credit-fields">{fields.map(([key,label])=><label key={key}>{label}<input inputMode="decimal" placeholder="Unverified — e.g. 0.00" value={values[key]||''} onChange={e=>{setValues(v=>({...v,[key]:e.target.value}));setConfirmed(c=>({...c,[key]:false}))}}/><span><input type="checkbox" checked={!!confirmed[key]} onChange={e=>setConfirmed(c=>({...c,[key]:e.target.checked}))}/> Verified for this fictional scenario</span></label>)}</div><div className="ng-credit-lines">{(['18','21','22','24','32','33','34','37'] as const).map(line=><div key={line}><span>Form 1040 line {line}</span><strong>{fmt(result.lines[line])}</strong></div>)}</div><button type="button" className="v2-secondary" onClick={exportCsv}>Export reconciliation CSV</button></>}
  <p className="ng-credit-warning">{result.blockers.length} unresolved verification checks. {result.blockers.length>0?result.blockers.slice(0,3).join(' • '):'Arithmetic reconciled, but tax-law eligibility and IRS filing readiness remain unverified.'}</p>
  <div className="v2-note"><strong>Not filing-ready.</strong> This module does not determine EIC, child credits, Schedule 2/3 eligibility, or tax-table liability. No PDF or e-file is enabled.</div>
 </section>
}
