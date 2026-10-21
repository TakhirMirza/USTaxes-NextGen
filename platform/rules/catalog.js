'use strict'
const ref2025=require('../../tools/tax2025/rules')
const statuses=['single','marriedJoint','marriedSeparate','headOfHousehold','qualifyingSurvivingSpouse']
const catalog=Object.freeze({
  2020:{year:2020,status:'legacy',reason:'Existing legacy implementation; not verified in NextGen',capabilities:[]},
  2021:{year:2021,status:'legacy',reason:'Existing legacy implementation; not verified in NextGen',capabilities:[]},
  2025:{year:2025,status:'reference',reason:'Ordinary brackets and standard deduction only; 1040 tax table, credits, schedules and PDFs not integrated',capabilities:['ordinary-brackets','standard-deduction'],parameters:{standardDeduction:ref2025.STANDARD_DEDUCTION,brackets:ref2025.BRACKETS},sources:[{title:'IRS tax year 2025 forms and instructions',url:'https://www.irs.gov/forms-instructions'}]},
  2026:{year:2026,status:'unavailable',reason:'2026 return engine, schedules and forms not verified',capabilities:[]},
  2027:{year:2027,status:'unavailable',reason:'Await verified annual tax rules and forms',capabilities:[]},
  2028:{year:2028,status:'unavailable',reason:'Await verified annual tax rules and forms',capabilities:[]}
})
function getYear(year){const y=Number(year);return catalog[y]||{year:y,status:'unavailable',reason:'No reviewed year module',capabilities:[]}}
function listYears(){return Object.keys(catalog).map(y=>getYear(y))}
function validateYearRules(r){
 const errors=[]
 if (!r||!r.parameters) return ['Missing parameters']
 for (const status of statuses){
  const deduction=r.parameters.standardDeduction[status]
  const tiers=r.parameters.brackets[status]
  if (!Number.isFinite(deduction)||deduction<0)errors.push(`${status}: invalid deduction`)
  if (!Array.isArray(tiers)||tiers.length<2||tiers[0][0]!==0) {errors.push(`${status}: invalid brackets`);continue}
  for(let i=0;i<tiers.length;i++) if (!Array.isArray(tiers[i])||tiers[i].length!==2||!Number.isFinite(tiers[i][0])||tiers[i][1]<0||tiers[i][1]>1||(i>0&&tiers[i][0]<=tiers[i-1][0])) errors.push(`${status}: invalid bracket ${i}`)
 }
 return errors
}
module.exports={catalog,getYear,listYears,validateYearRules}
