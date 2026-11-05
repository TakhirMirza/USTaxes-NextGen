#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {analyze,names}=require('./stage81-ci-triage');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stage81-'));
try{
 let r=analyze(dir);assert.equal(r.filesMissing.length,4);console.log('PASS missing logs reported');
 fs.writeFileSync(path.join(dir,'npm-ci.log'),'npm ERR! ERESOLVE unable to resolve dependency tree');
 r=analyze(dir);assert.equal(r.diagnostics[0].matches[0].category,'npm dependency resolution');console.log('PASS npm dependency failures');
 fs.writeFileSync(path.join(dir,'integration.log'),"error TS2307: Cannot find module 'abc'");
 r=analyze(dir);assert.ok(r.diagnostics[1].matches.some(x=>x.category==='TypeScript'));console.log('PASS TypeScript failures');
 fs.writeFileSync(path.join(dir,'jest.log'),'Test Suites: 1 failed, 2 passed');
 r=analyze(dir);assert.ok(r.diagnostics[2].matches.some(x=>x.category==='Jest assertion'));console.log('PASS Jest failures');
 fs.writeFileSync(path.join(dir,'react-build.log'),'Failed to compile.');
 r=analyze(dir);assert.ok(r.diagnostics[3].matches.some(x=>x.category==='React build'));console.log('PASS React failures');
 assert.deepEqual(r.filesMissing,[]);assert.deepEqual(r.filesFound,names);console.log('PASS complete inventory');
 assert.equal(r.schemaVersion,1);assert.match(r.warning,/not proof/);console.log('PASS status caveat');
 console.log('Stage 81: 7/7 passed');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
