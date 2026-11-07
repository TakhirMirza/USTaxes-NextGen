#!/usr/bin/env node
/** Development-only IRS 2025 tax-table reconstruction. NOT IRS-published data.
 * Source for brackets: https://www.irs.gov/irb/2024-45_IRB
 * Source for official spot checks: https://www.irs.gov/publications/p1040
 * A zero-mismatch spot check does not certify all 8,248 amounts.
 */
'use strict'
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const STATUSES = ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold']
const brackets = {
  single: [[11925,.10],[48475,.12],[103350,.22]],
  marriedJoint: [[23850,.10],[96950,.12],[206700,.22]],
  marriedSeparate: [[11925,.10],[48475,.12],[103350,.22]],
  headOfHousehold: [[17000,.10],[64850,.12],[103350,.22]],
}
function taxAt(income, status) {
  if (!Number.isFinite(income) || income < 0 || income >= 100000 || !brackets[status]) throw Error('Invalid tax input')
  let previous = 0, total = 0
  for (const [ceiling, rate] of brackets[status]) {
    total += Math.max(0, Math.min(income, ceiling) - previous) * rate
    previous = ceiling
    if (income <= ceiling) break
  }
  return Math.round(total)
}
function bands() {
  const b = [[0,5],[5,15],[15,25]]
  for (let lo=25;lo<3000;lo+=25) b.push([lo,lo+25])
  for (let lo=3000;lo<100000;lo+=50) b.push([lo,lo+50])
  assert.strictEqual(b.length,2062)
  return b
}
function generate() {
  return bands().map(([lower,upper]) => {
    const mid = (lower+upper)/2
    return {lower,upper,...Object.fromEntries(STATUSES.map(s=>[s,taxAt(mid,s)]))}
  })
}
function officialSpotChecks() {
  const first = [0,1,2,4,6,9,11,14,16,19,21,24,26,29,31,34,36,39,41,44,46,49,51,54,56,59,61,64,66,69,71,74,76,79,81,84,86,89,91,94,96,99]
  const b=bands();const checks=[]
  first.forEach((v,i)=>{const [lower,upper]=b[i];for(const s of STATUSES)checks.push({lower,upper,status:s,expected:v})})
  for(const [lower,vals] of [
    [25200,[2789,2550,2789,2687]],
    [25250,[2795,2556,2795,2693]],
    [25300,[2801,2562,2801,2699]],
    [25350,[2807,2568,2807,2705]],
  ]) STATUSES.forEach((status,i)=>checks.push({lower,upper:lower+50,status,expected:vals[i]}))
  return checks
}
function audit(rows, checks=officialSpotChecks()) {
  const issues=[]
  for(const {lower,upper,status,expected} of checks) {
    const row=rows.find(r=>r.lower===lower && r.upper===upper)
    if(!row || row[status]!==expected) issues.push({lower,upper,status,expected,actual:row&&row[status]})
  }
  return {checkedCells:checks.length,mismatches:issues}
}
function csv(rows) {
  return ['lower,upper,single,marriedJoint,marriedSeparate,headOfHousehold',...rows.map(r=>[r.lower,r.upper,...STATUSES.map(s=>r[s])].join(','))].join('\n')+'\n'
}
if(require.main===module) {
  const rows=generate(), result=audit(rows)
  const out=path.resolve(process.argv[2] || path.join(__dirname,'../research/2025-tax-table-RECONSTRUCTED.csv'))
  fs.mkdirSync(path.dirname(out),{recursive:true})
  fs.writeFileSync(out,csv(rows))
  console.log(JSON.stringify({output:out,rows:rows.length,taxCells:rows.length*4,...result,officialFullTableVerified:false},null,2))
  if(result.mismatches.length)process.exitCode=1
}
module.exports={STATUSES,taxAt,bands,generate,officialSpotChecks,audit,csv}
