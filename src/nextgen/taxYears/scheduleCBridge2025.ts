import { assessScheduleC2025, ScheduleCDraft } from './scheduleCWorksheet2025'

/** A non-posting reconciliation for Schedule C -> Schedule 1 -> 1040 and Schedule SE.
 * This module deliberately does not calculate SE tax or authorize a filing. */
export type BridgeFinding = { id:string; severity:'blocker'|'review'|'info'; title:string; detail:string }
export type BridgeResult = {
  status:'blocked'|'candidate'; netProfitCandidateCents:number|null;
  schedule1Line3CandidateCents:number|null; form1040Line8CandidateCents:number|null;
  scheduleSERequiredReview:boolean; findings:BridgeFinding[];
}
export function evaluateScheduleCBridge2025(draft:ScheduleCDraft):BridgeResult {
 const result=assessScheduleC2025(draft)
 const findings:BridgeFinding[]=[]
 const add=(id:string,severity:BridgeFinding['severity'],title:string,detail:string)=>findings.push({id,severity,title,detail})
 if(!draft.businessLabel.trim())add('business-label','blocker','Business identity missing','Enter a non-identifying business label for this test scenario.')
 if(!draft.reviewed)add('source-review','blocker','Source amounts not reviewed','Review source documents and confirm the worksheet values.')
 result.errors.forEach((message,index)=>add(`invalid-${index}`,'blocker','Invalid Schedule C source amount',message))
 if(result.mealsEntered)add('meals','blocker','Meals limitation unresolved','Meal deductions may be limited. No amount is posted until the applicable rule is verified.')
 const populated=Object.values(draft.fields).some(value=>String(value).trim()!=='')
 if(!populated)add('no-source','blocker','No business source amounts','Enter fictional business receipts and/or expenses before evaluating the bridge.')
 add('schedule-c-eligibility','review','Schedule C adjustments and limitations','Verify cost of goods sold, vehicle costs, home office, depreciation, business use, and other deductions before posting.')
 add('schedule-se','blocker','Schedule SE computation not implemented','Self-employment net earnings, Social Security/Medicare limits, exceptions, and additional Medicare tax must be calculated and validated independently.')
 add('schedule-1','blocker','Schedule 1 posting not implemented','Schedule 1 line 3 must be reconciled with all other business sources; line 10 and Form 1040 line 8 require complete Schedule 1 validation.')
 add('se-deduction','blocker','Deductible part of SE tax not implemented','The allowable adjustment on Schedule 1 Part II cannot be inferred from this worksheet.')
 add('qbi','review','Qualified business income review','Section 199A eligibility, limitations, and forms require independent review; no QBI deduction is claimed.')
 const candidateReady=populated && result.complete && !result.mealsEntered && result.errors.length===0
 const net=candidateReady?result.netBeforeMealsCents:null
 return {status:'blocked',netProfitCandidateCents:net,schedule1Line3CandidateCents:net,form1040Line8CandidateCents:null,scheduleSERequiredReview:net!==null&&net>0,findings}
}
export function scheduleCBridgeCsv2025(result:BridgeResult):string {
 const esc=(value:string)=>'"'+(/^[=+\-@\t\r]/.test(value)?"'":'')+value.replace(/"/g,'""')+'"'
 const rows=[['Type','Code','Severity','Description'],...result.findings.map(f=>['Finding',f.id,f.severity,`${f.title}: ${f.detail}`]),['Candidate','Schedule C net profit','not posted',result.netProfitCandidateCents===null?'unavailable':(result.netProfitCandidateCents/100).toFixed(2)],['Candidate','Schedule 1 line 3','not posted',result.schedule1Line3CandidateCents===null?'unavailable':(result.schedule1Line3CandidateCents/100).toFixed(2)],['Candidate','Form 1040 line 8','blocked','unavailable']]
 return rows.map(row=>row.map(esc).join(',')).join('\r\n')+'\r\n'
}
