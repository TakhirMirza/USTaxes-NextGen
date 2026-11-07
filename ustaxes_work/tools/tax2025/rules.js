/** IRS tax-year 2025 reference parameters; not a complete return engine. */
'use strict'
const STANDARD_DEDUCTION = Object.freeze({single:15750, marriedJoint:31500, marriedSeparate:15750, headOfHousehold:23625, qualifyingSurvivingSpouse:31500})
// Thresholds are LOWER bounds for each marginal bracket (2025 ordinary income).
const BRACKETS = Object.freeze({
 single:[[0,.10],[11925,.12],[48475,.22],[103350,.24],[197300,.32],[250525,.35],[626350,.37]],
 marriedJoint:[[0,.10],[23850,.12],[96950,.22],[206700,.24],[394600,.32],[501050,.35],[751600,.37]],
 marriedSeparate:[[0,.10],[11925,.12],[48475,.22],[103350,.24],[197300,.32],[250525,.35],[375800,.37]],
 headOfHousehold:[[0,.10],[17000,.12],[64850,.22],[103350,.24],[197300,.32],[250500,.35],[626350,.37]],
 qualifyingSurvivingSpouse:[[0,.10],[23850,.12],[96950,.22],[206700,.24],[394600,.32],[501050,.35],[751600,.37]]
})
/** Marginal-rate calculation ONLY. Do not use as the 1040 tax line: IRS tax table
 * generally applies below $100,000; special rates/credits also apply. */
function marginalTax(taxableIncome,status) {
 if(!Number.isFinite(taxableIncome)||taxableIncome<0) throw new RangeError('Invalid taxable income')
 const tiers=BRACKETS[status];if(!tiers)throw new RangeError('Invalid filing status')
 let result=0
 for(let i=0;i<tiers.length;i++){
  const [floor,rate]=tiers[i];const ceiling=i+1<tiers.length?tiers[i+1][0]:Infinity
  result+=Math.max(0,Math.min(taxableIncome,ceiling)-floor)*rate
 }
 return Math.round((result+Number.EPSILON)*100)/100
}
module.exports={STANDARD_DEDUCTION,BRACKETS,marginalTax}
