const test=require('node:test');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const path=require('node:path');
const script=path.join(__dirname,'stage74-build-preflight.js');
const report=JSON.parse(cp.execFileSync(process.execPath,[script,'--json'],{encoding:'utf8'}));
test('preflight reports project and dependencies',()=>{assert.equal(report.stage,74);assert.ok(report.dependencies.length>=6);assert.ok(report.dependencies.every(x=>x.declared&&x.locked));});
test('preflight never claims successful React build',()=>{assert.equal(report.reactBuildPassed,false);assert.equal(report.filingReady,false);});
test('strict preflight detects missing installed packages',()=>{if(report.dependencies.some(x=>!x.installed))assert.notEqual(cp.spawnSync(process.execPath,[script,'--strict']).status,0);});
