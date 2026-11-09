import { calculateScheduleSECore2025 } from './scheduleSECore2025'
import { ScheduleCDraft } from './scheduleCWorksheet2025'
import { evaluateScheduleCBridge2025 } from './scheduleCBridge2025'

/** Limited, non-posting Schedule SE arithmetic exercise for fictional 2025 cases.
 * NOT a Schedule SE implementation. It excludes wages, multiple businesses, farm income,
 * optional methods, special cases, Additional Medicare Tax, and other adjustments.
 */
export type SEFinding = { code:string; severity:'blocker'|'review'; message:string }
export type SEPreview = {
 status:'blocked'|'illustrative'; netProfitCents:number|null; netEarningsCents:number|null;
 illustrativeSSTaxCents:number|null; illustrativeMedicareTaxCents:number|null;
 illustrativeTotalCents:number|null; illustrativeHalfDeductionCents:number|null;
 findings:SEFinding[]
}
const roundRatio=(cents:number, numerator:number, denominator:number)=>Math.round(cents*numerator/denominator)
export function assessScheduleSEPreview2025(draft:ScheduleCDraft, options:{noW2WagesConfirmed:boolean; noOtherSelfEmploymentConfirmed:boolean; ordinaryMethodConfirmed:boolean}):SEPreview {
 const bridge=evaluateScheduleCBridge2025(draft)
 const findings:SEFinding[]=[]
 const add=(code:string,message:string,severity:SEFinding['severity']='blocker')=>findings.push({code,message,severity})
 const net=bridge.netProfitCandidateCents
 if(net===null)add('schedule-c','Schedule C source is incomplete or contains unresolved limitations.')
 if(!options.noW2WagesConfirmed)add('wages','Confirm no W-2 wages or other Social Security wage-base interactions; otherwise this limited exercise is unavailable.')
 if(!options.noOtherSelfEmploymentConfirmed)add('other-business','Confirm there is no other self-employment, farm income, or partnership income.')
 if(!options.ordinaryMethodConfirmed)add('special-methods','Confirm no optional Schedule SE methods, church employee income, or special adjustments apply.')
 if(net!==null&&net<=0)add('no-profit','Zero or negative Schedule C result: the limited positive-profit illustration does not apply.');
 if(net!==null&&net>10000000)add('limit','Profit above $100,000: this conservative illustration is intentionally disabled; review the applicable Social Security wage base and additional rules.')
 const allowed=findings.length===0&&net!==null
 if(!allowed)return {status:'blocked',netProfitCents:net,netEarningsCents:null,illustrativeSSTaxCents:null,illustrativeMedicareTaxCents:null,illustrativeTotalCents:null,illustrativeHalfDeductionCents:null,findings}
 const earnings=roundRatio(net!,9235,10000)
 if(earnings<40000){add('minimum','Net earnings below $400: ordinary self-employment tax may not apply; check special rules.');return {status:'blocked',netProfitCents:net,netEarningsCents:earnings,illustrativeSSTaxCents:null,illustrativeMedicareTaxCents:null,illustrativeTotalCents:null,illustrativeHalfDeductionCents:null,findings}}
 // Reuse the independently tested 2025 ordinary-method core; no automatic posting.
 // The scenario has confirmed no W-2 wages and is capped at $100,000 profit.
 // Additional Medicare Tax for a joint return still requires separate review.
 const core=calculateScheduleSECore2025({netProfitCents:net!,socialSecurityWagesCents:0,medicareWagesCents:0,
   otherSEIncomeExcluded:true,optionalMethodsExcluded:true,churchIncomeExcluded:true,
   specialAdjustmentsExcluded:true,additionalMedicareTaxHandledSeparately:true})
 if(core.status==='blocked'){
   core.reasons.forEach(message=>add('se-core',message))
   return {status:'blocked',netProfitCents:net,netEarningsCents:earnings,illustrativeSSTaxCents:null,illustrativeMedicareTaxCents:null,illustrativeTotalCents:null,illustrativeHalfDeductionCents:null,findings}
 }
 add('not-posted','Tested 2025 SE arithmetic only. Additional Medicare Tax, filing status, other income, eligibility and official rounding require independent review before posting.','review')
 return {status:'illustrative',netProfitCents:net,netEarningsCents:core.netEarningsCents,illustrativeSSTaxCents:core.socialSecurityTaxCents,illustrativeMedicareTaxCents:core.medicareTaxCents,illustrativeTotalCents:core.totalTaxCents,illustrativeHalfDeductionCents:core.halfDeductionCents,findings}
}
export function scheduleSEPreviewCsv2025(result:SEPreview):string {
 const lines=[['Item','Amount USD','Status'],['Schedule C candidate',result.netProfitCents,'source candidate'],['Net earnings illustration',result.netEarningsCents,'not posted'],['Social Security illustration',result.illustrativeSSTaxCents,'not posted'],['Medicare illustration',result.illustrativeMedicareTaxCents,'not posted'],['SE total illustration',result.illustrativeTotalCents,'not posted'],['Half deduction illustration',result.illustrativeHalfDeductionCents,'not posted']]
 return ['"Item","Amount USD","Status"',...lines.slice(1).map(([name,amount,status])=>[name,amount===null?'unavailable':(Number(amount)/100).toFixed(2),status].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')),...result.findings.map(f=>['Finding: '+f.code,'',f.message].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','))].join('\r\n')+'\r\n'
}
