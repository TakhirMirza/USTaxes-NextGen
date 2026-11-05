#!/usr/bin/env node
/** Dependency-free, fail-closed check that shipped runtime table matches IRS PDF CSV. */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const csvPath = path.join(root, 'data/irs-2025-pdf-extracted.csv')
const runtimePath = path.join(root, 'src/nextgen/taxYears/irsImportedTaxTable2025.ts')
const keys = ['lower','upper','single','marriedJoint','marriedSeparate','headOfHousehold']
function check() {
 const csvBytes = fs.readFileSync(csvPath)
 const digest = crypto.createHash('sha256').update(csvBytes).digest('hex')
 const runtime = fs.readFileSync(runtimePath, 'utf8')
 assert.ok(runtime.includes(`CSV SHA-256: ${digest}`), 'Runtime provenance digest does not match source CSV')
 const lines = csvBytes.toString('utf8').trim().split(/\r?\n/)
 assert.equal(lines.shift(),keys.join(','),'Unexpected CSV columns')
 const csvRows=lines.map((line,i)=>{const parts=line.split(',');assert.equal(parts.length,6,`CSV row ${i+1} column count`);const nums=parts.map(Number);assert.ok(nums.every(x=>Number.isSafeInteger(x)&&x>=0),`Invalid CSV row ${i+1}`);return nums})
 const matches=[...runtime.matchAll(/\{lower:\s*(\d+),\s*upper:\s*(\d+),\s*single:\s*(\d+),\s*marriedJoint:\s*(\d+),\s*marriedSeparate:\s*(\d+),\s*headOfHousehold:\s*(\d+)\}/g)]
 assert.equal(csvRows.length,2062,'Unexpected official CSV interval count')
 assert.equal(matches.length,csvRows.length,'Runtime row count differs from official CSV')
 for(let i=0;i<csvRows.length;i++){
  assert.deepEqual(matches[i].slice(1).map(Number),csvRows[i],`Runtime mismatch at CSV row ${i+1}`)
  if(i>0)assert.equal(csvRows[i][0],csvRows[i-1][1],`Gap/overlap at row ${i+1}`)
  assert.ok(csvRows[i][1]>csvRows[i][0],`Invalid interval at row ${i+1}`)
 }
 assert.equal(csvRows[0][0],0)
 assert.equal(csvRows.at(-1)[1],100000)
 const sample=csvRows.find(r=>r[0]===25300)
 assert.ok(sample,'IRS sample interval missing')
 assert.deepEqual(sample,[25300,25350,2801,2562,2801,2699])
 return {intervals:csvRows.length,values:csvRows.length*4,sha256:digest,matching:true}
}
if(require.main===module){try{console.log('Stage 78 official IRS CSV → shipped TypeScript audit:',JSON.stringify(check()))}catch(e){console.error('Stage 78 FAILED:',e.message);process.exitCode=1}}
module.exports={check}
