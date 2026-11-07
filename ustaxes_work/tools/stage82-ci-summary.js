#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { analyze } = require('./stage81-ci-triage');
function buildSummary(dir, statuses={}) {
  const triage=analyze(dir);
  const rows=triage.filesExpected.map(name=>{
    const detail=triage.diagnostics.find(x=>x.name===name);
    const key=name.replace(/\.log$/,'');
    const status=statuses[key] || 'unknown';
    return {name,status,logPresent:!!detail,diagnostics:detail?detail.matches.map(m=>m.category):[]};
  });
  const failed=Object.values(statuses).some(s=>s==='failure');
  const allSuccess=rows.every(r=>r.status==='success' && r.logPresent);
  return {schemaVersion:1,verdict:failed?'FAILED':allSuccess?'PASSED':'INCOMPLETE',rows,missingLogs:triage.filesMissing,disclaimer:'Workflow step conclusions are authoritative; log signatures are only diagnostic. A missing log never counts as success.'};
}
function renderMarkdown(report){
  const lines=['# Stage 82 CI validation summary','',`**Verdict: ${report.verdict}**`,'','| Step | GitHub step conclusion | Log | Diagnostic categories |','|---|---|---|---|'];
  for(const r of report.rows)lines.push(`| ${r.name} | ${r.status} | ${r.logPresent?'present':'missing'} | ${r.diagnostics.join(', ')||'—'} |`);
  lines.push('',report.disclaimer,'');return lines.join('\n');
}
function main(){
  const dir=path.resolve(process.argv[2]||'test-results');
  const statuses={};
  for(const arg of process.argv.slice(3)){const m=/^(npm-ci|integration|jest|react-build)=(success|failure|cancelled|skipped)$/.exec(arg);if(!m)throw new Error(`Invalid step conclusion: ${arg}`);statuses[m[1]]=m[2];}
  const report=buildSummary(dir,statuses);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'stage82-summary.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'stage82-summary.md'),renderMarkdown(report));
  console.log(renderMarkdown(report));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,renderMarkdown(report)+'\n');
}
if(require.main===module)main();
module.exports={buildSummary,renderMarkdown};
