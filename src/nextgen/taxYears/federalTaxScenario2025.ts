/** 2025 ordinary-income bracket exploration. Educational preview only; NOT IRS Form 1040 line 16. */
export type Status2025 = 'single'|'joint'|'separate'|'head'|'survivor'
export interface Bracket2025 { ceiling: number; rate: number }
const ceilings: Record<Status2025, number[]> = {
  single: [11925,48350,103350,197300,250525,626350],
  joint: [23850,96700,206700,394600,501050,751600],
  separate: [11925,48350,103350,197300,250525,375800],
  head: [17000,64850,103350,197300,250500,626350],
  survivor: [23850,96700,206700,394600,501050,751600]
}
const rates = [10,12,22,24,32,35,37]
export const baseStandardDeduction2025: Record<Status2025, number> = {single:15750,joint:31500,separate:15750,head:23625,survivor:31500}
export interface Scenario2025 { label:string; incomeCents:number; deductionCents:number; taxableCents:number; estimatedOrdinaryTaxCents:number; marginalRate:number; effectiveRate:number }
export interface ScenarioResult2025 { status:'illustrative'|'blocked'; reasons:string[]; scenarios:Scenario2025[]; year:2025; filingEnabled:false }
function safeCents(v:number):boolean {return Number.isSafeInteger(v)&&v>=0&&v<=100000000000}
/** Rates applied to exact integer cents, rounding tax once at the end. */
export function bracketTax2025(taxableCents:number,status:Status2025): {taxCents:number;marginalRate:number}|null {
  if (!safeCents(taxableCents) || !ceilings[status]) return null
  let left=taxableCents,previous=0,taxRateHundredths=0,marginalRate=0
  for(let i=0;i<rates.length;i++) {
    const upper=i<6?ceilings[status][i]*100:taxableCents
    const band=Math.min(left,Math.max(0,upper-previous))
    if(band>0){taxRateHundredths+=band*rates[i];marginalRate=rates[i]}
    left-=band;previous=upper
    if(left<=0)break
  }
  return {taxCents:Math.round(taxRateHundredths/100),marginalRate}
}
export function compareFederalScenarios2025(input:{year:string;filingStatus:string;incomeCents:number|null;deductionCents:number|null;sourceValidated:boolean;deductionValidated:boolean;specialTaxMethodsExcluded:boolean}):ScenarioResult2025 {
  const reasons:string[]=[]
  if(input.year!=='2025')reasons.push('Only 2025 is supported.')
  if(!Object.prototype.hasOwnProperty.call(ceilings,input.filingStatus))reasons.push('Unsupported filing status.')
  if(!input.sourceValidated)reasons.push('Income source reconciliation is incomplete.')
  if(!input.deductionValidated)reasons.push('Deduction eligibility has not been confirmed.')
  if(!input.specialTaxMethodsExcluded)reasons.push('Special tax methods (capital gains, qualified dividends and others) are not excluded.')
  if(input.incomeCents===null||!safeCents(input.incomeCents))reasons.push('AGI must be a validated nonnegative integer-cent amount.')
  if(input.deductionCents===null||!safeCents(input.deductionCents))reasons.push('Deduction must be a validated nonnegative integer-cent amount.')
  if(reasons.length)return {status:'blocked',reasons,scenarios:[],year:2025,filingEnabled:false}
  const income=input.incomeCents as number,deduction=input.deductionCents as number,status=input.filingStatus as Status2025
  const scenario=(label:string,amount:number):Scenario2025=>{
    const taxable=Math.max(0,amount-deduction)
    const result=bracketTax2025(taxable,status)!
    return {label,incomeCents:amount,deductionCents:deduction,taxableCents:taxable,estimatedOrdinaryTaxCents:result.taxCents,marginalRate:result.marginalRate,effectiveRate:amount>0?Math.round(result.taxCents/amount*10000)/100:0}
  }
  return {status:'illustrative',reasons:[],scenarios:[scenario('Current draft',income),scenario('AGI − $10,000',Math.max(0,income-1000000)),scenario('AGI + $10,000',income+1000000)],year:2025,filingEnabled:false}
}
