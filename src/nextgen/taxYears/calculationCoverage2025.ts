import { BALANCE_FIELDS_2025, BALANCE_FIXTURE_2025, validateFederalBalance2025, type BalanceInputs2025, type BalanceKey2025 } from './federalBalanceValidation2025'
import { REGRESSION_SCENARIOS_2025 } from './scenarioRegression2025'

/** Coverage of arithmetic assertions, NOT legal/tax-rule certification. */
export const CALCULATION_RULES_2025 = [
 {code:'AGI',target:'l11a',sources:['l9','l10'],group:'Income'},
 {code:'DEDUCTIONS',target:'l14',sources:['l12e','l13a','l13b'],group:'Deductions'},
 {code:'TAXABLE_INCOME',target:'l15',sources:['l11a','l14'],group:'Deductions'},
 {code:'TAX_BEFORE_CREDITS',target:'l18',sources:['l16','l17'],group:'Tax'},
 {code:'NONREFUNDABLE_CREDITS',target:'l21',sources:['l19','l20'],group:'Credits'},
 {code:'TAX_AFTER_CREDITS',target:'l22',sources:['l18','l21'],group:'Credits'},
 {code:'TOTAL_TAX',target:'l24',sources:['l22','l23'],group:'Tax'},
 {code:'WITHHOLDING',target:'l25d',sources:['l25a','l25b','l25c'],group:'Payments'},
 {code:'REFUNDABLE_PAYMENTS',target:'l32',sources:['l27a','l28','l29','l31'],group:'Payments'},
 {code:'TOTAL_PAYMENTS',target:'l33',sources:['l25d','l26','l32'],group:'Payments'},
 {code:'OVERPAYMENT',target:'l34',sources:['l33','l24'],group:'Balance'},
 {code:'AMOUNT_OWED',target:'l37',sources:['l24','l33'],group:'Balance'}
] as const
export type CoverageResult2025 = { code:string;group:string;target:string;sources:string[];positive:boolean;negative:boolean;missing:boolean;state:'covered'|'partial'|'uncovered';note:string }
export function assessCalculationCoverage2025(): {rows:CoverageResult2025[];covered:number;partial:number;uncovered:number;fields:number;scenarios:number;filingAllowed:false} {
 const baseline=validateFederalBalance2025(BALANCE_FIXTURE_2025)
 const rows:CoverageResult2025[]=CALCULATION_RULES_2025.map(rule=>{
  const positive=baseline.findings.every(f=>f.code!==rule.code)&&baseline.evaluated===CALCULATION_RULES_2025.length
  const mutated:BalanceInputs2025={...BALANCE_FIXTURE_2025,[rule.target]:String(Number(BALANCE_FIXTURE_2025[rule.target as BalanceKey2025]??'0')+1)}
  const negative=validateFederalBalance2025(mutated).findings.some(f=>f.code===rule.code)
  const missingFixture:BalanceInputs2025={...BALANCE_FIXTURE_2025,[rule.target]:''}
  const missing=validateFederalBalance2025(missingFixture).findings.some(f=>f.code===`MISSING_${rule.target}`)
  const count=[positive,negative,missing].filter(Boolean).length
  return {code:rule.code,group:rule.group,target:rule.target,sources:[...rule.sources],positive,negative,missing,state:count===3?'covered':count===0?'uncovered':'partial',note:'Arithmetic checks only; IRS eligibility, tax tables and legal rules not verified.'}
 })
 return {rows,covered:rows.filter(r=>r.state==='covered').length,partial:rows.filter(r=>r.state==='partial').length,uncovered:rows.filter(r=>r.state==='uncovered').length,fields:BALANCE_FIELDS_2025.length,scenarios:REGRESSION_SCENARIOS_2025.length,filingAllowed:false}
}
export function calculationCoverageCsv2025(rows:CoverageResult2025[]):string {
 const cell=(value:string)=>'"'+(/^[=+@\-\t\r]/.test(value)?"'":'')+value.replace(/"/g,'""')+'"'
 return [['Group','Rule','Target','Sources','Positive','Mutation','Missing','Status','Limitation'],...rows.map(r=>[r.group,r.code,r.target,r.sources.join('; '),String(r.positive),String(r.negative),String(r.missing),r.state,r.note])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
