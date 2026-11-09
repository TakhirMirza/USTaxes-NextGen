/** 2025 Schedule SE arithmetic for explicitly limited, ordinary-method cases.
 * Amounts in integer cents. NOT an authorization to post to a tax return.
 * IRS Schedule SE 2025: net earnings 92.35%, Social Security 12.4%,
 * Medicare 2.9%, 2025 Social Security wage base $176,100.
 */
export const SE_2025_WAGE_BASE_CENTS = 17610000
export type SECoreInput2025 = {
 netProfitCents:number; socialSecurityWagesCents:number;
 medicareWagesCents:number; otherSEIncomeExcluded:boolean;
 optionalMethodsExcluded:boolean; churchIncomeExcluded:boolean;
 specialAdjustmentsExcluded:boolean; additionalMedicareTaxHandledSeparately:boolean;
}
export type SECoreResult2025 =
 | {status:'blocked';reasons:string[];netEarningsCents:null;socialSecurityTaxCents:null;medicareTaxCents:null;totalTaxCents:null;halfDeductionCents:null}
 | {status:'calculated-not-posted';reasons:string[];netEarningsCents:number;socialSecurityTaxCents:number;medicareTaxCents:number;totalTaxCents:number;halfDeductionCents:number}
const valid=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=100000000000
const rounded=(cents:number,numerator:number,denominator:number)=>Math.round(cents*numerator/denominator)
export function calculateScheduleSECore2025(input:SECoreInput2025):SECoreResult2025 {
 const reasons:string[]=[]
 if(!valid(input.netProfitCents))reasons.push('Net profit must be a nonnegative integer-cent amount.')
 if(!valid(input.socialSecurityWagesCents))reasons.push('Social Security wages must be a nonnegative integer-cent amount.')
 if(!valid(input.medicareWagesCents))reasons.push('Medicare wages must be a nonnegative integer-cent amount.')
 if(!input.otherSEIncomeExcluded)reasons.push('Other self-employment, farming, and partnership income is not excluded.')
 if(!input.optionalMethodsExcluded)reasons.push('Optional Schedule SE methods have not been excluded.')
 if(!input.churchIncomeExcluded)reasons.push('Church employee income has not been excluded.')
 if(!input.specialAdjustmentsExcluded)reasons.push('Special Schedule SE adjustments have not been excluded.')
 if(!input.additionalMedicareTaxHandledSeparately)reasons.push('Additional Medicare Tax applicability has not been independently reviewed.')
 if(reasons.length)return {status:'blocked',reasons,netEarningsCents:null,socialSecurityTaxCents:null,medicareTaxCents:null,totalTaxCents:null,halfDeductionCents:null}
 const earnings=rounded(input.netProfitCents,9235,10000)
 if(earnings<40000)return {status:'blocked',reasons:['Net earnings are below $400; the ordinary-method calculation does not apply to this limited case.'],netEarningsCents:null,socialSecurityTaxCents:null,medicareTaxCents:null,totalTaxCents:null,halfDeductionCents:null}
 const ssBase=Math.min(earnings,Math.max(0,SE_2025_WAGE_BASE_CENTS-input.socialSecurityWagesCents))
 const ss=rounded(ssBase,124,1000)
 const medicare=rounded(earnings,29,1000)
 const total=ss+medicare
 return {status:'calculated-not-posted',reasons:['Verify official 2025 Schedule SE rounding and all filing facts before any transfer to Schedule 1 or 2.'],netEarningsCents:earnings,socialSecurityTaxCents:ss,medicareTaxCents:medicare,totalTaxCents:total,halfDeductionCents:rounded(total,1,2)}
}
