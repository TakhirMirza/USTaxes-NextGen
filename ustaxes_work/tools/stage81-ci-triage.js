#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');
const names=['npm-ci.log','integration.log','jest.log','react-build.log'];
const patterns=[
 ['npm dependency resolution',/npm ERR! (?:ERESOLVE|E404|ETARGET)|unable to resolve dependency tree/i,'Review lockfile and dependency versions; do not bypass integrity checks.'],
 ['npm network/cache',/npm ERR! (?:ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN)|network request failed/i,'Check registry connectivity and CI retry policy.'],
 ['missing module',/Cannot find module ['"`]|Module not found: Error: Can't resolve/i,'Check package installation and import paths.'],
 ['TypeScript',/error TS\d{4}:|Type error:/i,'Fix the reported TypeScript errors before retrying.'],
 ['Jest assertion',/Test Suites:.*failed|FAIL\s+.*\.test\./i,'Inspect failing test names and assertion diffs.'],
 ['React build',/Failed to compile|Treating warnings as errors because process\.env\.CI/i,'Inspect build errors and warnings; do not disable CI validation.'],
];
function analyze(dir){
 const logs=names.map(name=>({name,path:path.join(dir,name)}));
 const found=logs.filter(x=>fs.existsSync(x.path));
 const details=found.map(x=>{
  const content=fs.readFileSync(x.path,'utf8');
  const matches=patterns.filter(p=>p[1].test(content)).map(p=>({category:p[0],nextStep:p[2]}));
  return {name:x.name,bytes:Buffer.byteLength(content),matches,hasSuccessSignal:/(?:compiled successfully|test suites:\s*\d+ passed|tests:\s*\d+ passed)/i.test(content)};
 });
 return {schemaVersion:1,filesExpected:names,filesFound:found.map(x=>x.name),filesMissing:logs.filter(x=>!fs.existsSync(x.path)).map(x=>x.name),diagnostics:details,warning:'Log signatures are heuristic. A successful log is not proof that the full CI job passed. Check GitHub Actions job status.'};
}
function main(){const args=process.argv.slice(2);const dir=path.resolve(args.find(a=>!a.startsWith('--'))||'test-results');const result=analyze(dir);if(args.includes('--json'))console.log(JSON.stringify(result,null,2));else{console.log('Stage 81 CI log triage:',dir);console.log('Found:',result.filesFound.join(', ')||'none');console.log('Missing:',result.filesMissing.join(', ')||'none');for(const log of result.diagnostics){console.log(`\n${log.name}:`);if(!log.matches.length)console.log('  No recognized failure signature');for(const m of log.matches)console.log(`  ${m.category}: ${m.nextStep}`)}console.log('\n'+result.warning)}if(args.includes('--strict')&&result.filesMissing.length)process.exitCode=2;}
if(require.main===module)main();module.exports={analyze,names};
