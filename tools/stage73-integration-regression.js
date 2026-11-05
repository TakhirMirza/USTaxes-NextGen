#!/usr/bin/env node
/** Stage 73: executable, dependency-free Form 1040/Schedules 2-3 integration regression. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const cp = require('node:child_process')
const root = path.resolve(__dirname, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaxes-stage73-'))
try {
  const compiler = path.join(root, 'node_modules', '.bin', 'tsc')
  if (!fs.existsSync(compiler)) {
    throw new Error('Local TypeScript compiler missing: run npm ci before integration regression (no global tsc fallback).')
  }
  cp.execFileSync(compiler, ['--pretty','false','--outDir',temp,'--esModuleInterop','--resolveJsonModule','--skipLibCheck','--moduleResolution','node','--module','commonjs','--target','es2019',
    'src/nextgen/taxYears/form1040SchedulesReconciliation2025.ts', 'src/nextgen/taxYears/schedule2And3Review2025.ts'], {cwd:root, stdio:'pipe'})
  const {reconcile2025SchedulesWith1040: reconcile} = require(path.join(temp,'taxYears','form1040SchedulesReconciliation2025.js'))
  const {review2025Schedules2And3: review} = require(path.join(temp,'taxYears','schedule2And3Review2025.js'))
  let checks=0
  const amount = (n) => ({amount:n,reviewed:true,sourceReference:'test fixture'})
  const schedules = review({schedule2PartIAdditionalTax:amount(150),schedule2PartIIOtherTaxes:amount(40),schedule3PartINonrefundableCredits:amount(60),schedule3PartIIRefundableCreditsAndPayments:amount(80),noDuplicatePaymentsConfirmed:true,creditOrderingConfirmed:true})
  assert.equal(schedules.candidates.form1040Line17,150); checks++
  assert.equal(schedules.candidates.form1040Line23,40); checks++
  const balance = {year:2025,filingReady:false,postingAuthorized:false,blockers:[],officialLines:{'16':null,'19':null,'20':null,'22':null,'23':null,'24':null,'28':null,'33':null,'34':null,'37':null},candidates:{line16Tax:1000,line19ChildAndDependentCredit:200,line20OtherNonrefundableCredits:60,line23OtherTaxes:40,line28AdditionalChildTaxCredit:300,line25dWithholding:500,line33TotalPayments:930}}
  const input={balance,schedules,line18TaxBeforeNonrefundableCredits:1150,additionalPaymentsExcludingSchedule3:50,creditOrderReviewed:true,paymentSourcesReviewed:true}
  const r=reconcile(input)
  assert.deepEqual([r.candidates.line18,r.candidates.line21,r.candidates.line22,r.candidates.line24],[1150,260,890,930]); checks++
  assert.deepEqual([r.candidates.line31,r.candidates.line32,r.candidates.line33,r.candidates.line34,r.candidates.line37],[80,380,930,0,0]); checks++
  assert.equal(r.filingReady,false);assert.equal(r.postingAuthorized,false);assert.ok(Object.values(r.officialLines).every(v=>v===null)); checks++
  assert.ok(r.blockers.some(x=>x.includes('Stage 62 line 24 excludes'))); checks++
  const mismatch=reconcile({...input,line18TaxBeforeNonrefundableCredits:1151})
  assert.ok(mismatch.blockers.some(x=>x.includes('line 18 must equal'))); checks++
  const missing=reconcile({...input,additionalPaymentsExcludingSchedule3:null})
  assert.equal(missing.candidates.line33,null);assert.equal(missing.candidates.line34,null); checks++
  const excess=reconcile({...input,balance:{...balance,candidates:{...balance.candidates,line19ChildAndDependentCredit:1200}}})
  assert.equal(excess.candidates.line22,null);assert.ok(excess.blockers.some(x=>x.includes('exceed line 18'))); checks++
  assert.throws(()=>reconcile({...input,additionalPaymentsExcludingSchedule3:-1}),RangeError); checks++
  assert.throws(()=>review({schedule2PartIAdditionalTax:amount(NaN),schedule2PartIIOtherTaxes:amount(0),schedule3PartINonrefundableCredits:amount(0),schedule3PartIIRefundableCreditsAndPayments:amount(0),noDuplicatePaymentsConfirmed:true,creditOrderingConfirmed:true}),RangeError); checks++
  console.log(`Stage 73: ${checks}/${checks} executable integration checks PASS (TypeScript compiled with local tsc).`)
} finally { fs.rmSync(temp,{recursive:true,force:true}) }
