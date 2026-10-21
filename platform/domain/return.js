'use strict'
const STATUSES = Object.freeze(['single','marriedJoint','marriedSeparate','headOfHousehold','qualifyingSurvivingSpouse'])
function validateReturn(input) {
  const errors=[]
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['Return must be an object']
  if (!Number.isInteger(input.taxYear) || input.taxYear < 2020 || input.taxYear > 2100) errors.push('Invalid tax year')
  if (!STATUSES.includes(input.filingStatus)) errors.push('Invalid filing status')
  if (!Array.isArray(input.incomeItems)) errors.push('incomeItems must be an array')
  else for (const [i,item] of input.incomeItems.entries()) {
    if (!item || !['w2','interest','dividends','business','other'].includes(item.kind) || !Number.isFinite(item.amount) || item.amount < 0) errors.push(`Invalid incomeItems[${i}]`)
  }
  if (!Array.isArray(input.withholdingItems)) errors.push('withholdingItems must be an array')
  else for (const [i,item] of input.withholdingItems.entries()) {
    if (!item || !Number.isFinite(item.amount) || item.amount < 0) errors.push(`Invalid withholdingItems[${i}]`)
  }
  return errors
}
module.exports={STATUSES,validateReturn}
