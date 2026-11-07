#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const EXPECTED = ['npm-ci.log','integration.log','jest.log','react-build.log'];
function evaluate(summary) {
  const reasons=[];
  if (!summary || summary.schemaVersion!==1 || !Array.isArray(summary.rows)) reasons.push('Invalid Stage 82 summary schema');
  else {
    for(const name of EXPECTED){
      const rows=summary.rows.filter(r=>r.name===name);
      if(rows.length!==1){reasons.push(`Expected exactly one ${name} entry`);continue;}
      if(rows[0].status!=='success') reasons.push(`${name}: step ${rows[0].status||'unknown'}`);
      if(rows[0].logPresent!==true) reasons.push(`${name}: log missing`);
    }
    if(summary.verdict!=='PASSED') reasons.push(`Summary verdict: ${summary.verdict||'missing'}`);
  }
  return {passed:reasons.length===0,reasons,filingReady:false,postingAuthorized:false};
}
function main(){
  const filename=path.resolve(process.argv[2]||'test-results/stage82-summary.json');
  let report;
  try { report=evaluate(JSON.parse(fs.readFileSync(filename,'utf8'))); }
  catch(e) { report={passed:false,reasons:[`Cannot read summary: ${e.message}`],filingReady:false,postingAuthorized:false}; }
  console.log(JSON.stringify(report,null,2));
  if(!report.passed)process.exitCode=1;
}
if(require.main===module)main();
module.exports={evaluate};
