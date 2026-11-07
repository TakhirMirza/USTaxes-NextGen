'use strict'
const {validateReturn}=require('../domain/return')
const {getYear,validateYearRules}=require('../rules/catalog')
const {marginalTax}=require('../../tools/tax2025/rules')
class TaxEngineError extends Error{constructor(code,message){super(message);this.name='TaxEngineError';this.code=code}}
/** Reference-only illustration. Cannot be used as a Form 1040 liability. */
function previewOrdinaryIncome(input){
 const errors=validateReturn(input);if(errors.length)throw new TaxEngineError('INVALID_RETURN',errors.join('; '))
 const rules=getYear(input.taxYear)
 if (rules.status!=='reference'&&rules.status!=='ready')throw new TaxEngineError('YEAR_UNAVAILABLE',rules.reason)
 const ruleErrors=validateYearRules(rules);if(ruleErrors.length)throw new TaxEngineError('INVALID_RULES',ruleErrors.join('; '))
 if(input.taxYear!==2025)throw new TaxEngineError('CALCULATOR_UNAVAILABLE','Reference calculation not implemented for year')
 if(input.incomeItems.some(x=>x.kind!=='w2'))throw new TaxEngineError('UNSUPPORTED_INCOME','Only W-2 ordinary-income preview is supported')
 const gross=input.incomeItems.reduce((a,x)=>a+x.amount,0)
 const deduction=rules.parameters.standardDeduction[input.filingStatus]
 const taxableIncome=Math.max(0,gross-deduction)
 return Object.freeze({taxYear:input.taxYear,filingStatus:input.filingStatus,grossIncome:gross,standardDeduction:deduction,taxableIncome,illustrativeMarginalTax:marginalTax(taxableIncome,input.filingStatus),filingReady:false,warning:'NOT a Form 1040 result. IRS tax table and other rules/credits not applied.'})
}
function calculateReturn(input){
 const errors=validateReturn(input);if(errors.length)throw new TaxEngineError('INVALID_RETURN',errors.join('; '))
 const year=getYear(input.taxYear)
 if(year.status!=='ready')throw new TaxEngineError('NOT_FILING_READY',`Tax year ${input.taxYear}: ${year.reason}`)
 throw new TaxEngineError('NOT_IMPLEMENTED','Certified production calculation adapter is not installed')
}
module.exports={TaxEngineError,previewOrdinaryIncome,calculateReturn}
