/** 2025 federal deduction and credit eligibility audit. Fictional scenarios only. */
export type FilingStatus = 'single'|'joint'|'separate'|'head'|'survivor'
export type ReviewState = 'verified'|'blocked'|'not-applicable'
export interface ReviewFinding { id:string; title:string; state:ReviewState; explanation:string; form1040Lines:string[] }
export interface DeductionCreditInput {
  year:string; filingStatus:string; adjustedGrossIncomeCents:number|null;
  deductionCents:number|null; selectedDeduction:string;
  baseDeductionReviewed:boolean; dependentEligibilityReviewed:boolean;
  noOtherItemsConfirmed:boolean; sourceValidated:boolean;
  specialTaxMethodsExcluded:boolean;
}
export interface DeductionCreditReview {
  status:'reviewed-limited'|'blocked'; findings:ReviewFinding[];
  blockedCount:number; verifiedCount:number; filingEnabled:false;
  taxableIncomeCents:number|null; standardDeductionBaseCents:number|null;
}
const base:Record<FilingStatus,number>={single:15750,joint:31500,separate:15750,head:23625,survivor:31500}
const safe=(v:number|null):v is number=>v!==null&&Number.isSafeInteger(v)&&v>=0&&v<=100000000000
export function auditDeductionAndCredits2025(input:DeductionCreditInput):DeductionCreditReview {
  const findings:ReviewFinding[]=[]
  const add=(id:string,title:string,ok:boolean,explanation:string,lines:string[])=>findings.push({id,title,state:ok?'verified':'blocked',explanation,form1040Lines:lines})
  const statusOk=Object.prototype.hasOwnProperty.call(base,input.filingStatus)
  add('year','Supported tax year',input.year==='2025','Only tax year 2025 is implemented in this audit.',['12e','15'])
  add('filing','Filing status',statusOk,'A supported 2025 filing status is required.',['12e'])
  add('sources','Source-to-AGI reconciliation',input.sourceValidated&&safe(input.adjustedGrossIncomeCents),'AGI must come from reconciled income sources and be a valid nonnegative cent amount.',['11a','11b'])
  add('deduction','Deduction method',input.selectedDeduction==='standard','Schedule A itemization is not supported by this restricted audit.',['12e'])
  add('deduction-eligibility','Base standard deduction eligibility',input.baseDeductionReviewed,'Age 65+, blindness, dependent status, spouse itemization, nonresident status and other exceptions require separate review.',['12e'])
  const expected=statusOk?base[input.filingStatus as FilingStatus]*100:null
  const matches=expected!==null&&safe(input.deductionCents)&&input.deductionCents===expected
  add('deduction-amount','2025 base standard deduction amount',matches,'For the simplified case, the claimed amount must equal the 2025 base deduction. Additional deductions are not inferred.',['12e'])
  add('dependents','Dependent eligibility',input.dependentEligibilityReviewed,'Dependent and credit eligibility must be independently reviewed; no dependent credits are computed here.',['19','28'])
  add('credits','Credits and additional taxes excluded',input.noOtherItemsConfirmed,'This limited scenario requires an explicit confirmation that no additional credits, adjustments or taxes apply. This is not proof of statutory eligibility.',['19','20','23','28','29','31'])
  add('tax-method','Special tax methods excluded',input.specialTaxMethodsExcluded,'Qualified dividends, capital gains, alternative tax computations and other special methods need separate treatment.',['16'])
  const blockedCount=findings.filter(f=>f.state==='blocked').length
  return {status:blockedCount?'blocked':'reviewed-limited',findings,blockedCount,verifiedCount:findings.length-blockedCount,filingEnabled:false,
    taxableIncomeCents:blockedCount===0&&safe(input.adjustedGrossIncomeCents)&&safe(input.deductionCents)?Math.max(0,input.adjustedGrossIncomeCents-input.deductionCents):null,
    standardDeductionBaseCents:expected}
}
export function deductionCreditAuditCsv2025(review:DeductionCreditReview):string {
  const quote=(v:string)=>'"'+v.replace(/"/g,'""')+'"'
  return ['check_id,status,form_1040_lines,explanation',...review.findings.map(f=>[f.id,f.state,f.form1040Lines.join('; '),f.explanation].map(quote).join(','))].join('\r\n')+'\r\n'
}
