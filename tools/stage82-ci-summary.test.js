'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {test}=require('node:test');
const {buildSummary,renderMarkdown}=require('./stage82-ci-summary');
function fixture(fn){const d=fs.mkdtempSync(path.join(os.tmpdir(),'stage82-'));try{fn(d)}finally{fs.rmSync(d,{recursive:true,force:true})}}
test('missing logs cannot count as passing',()=>fixture(d=>{const r=buildSummary(d,{'npm-ci':'success',integration:'success',jest:'success','react-build':'success'});assert.equal(r.verdict,'INCOMPLETE');assert.equal(r.missingLogs.length,4)}));
test('a failed step makes the verdict FAILED even with missing logs',()=>fixture(d=>{const r=buildSummary(d,{'npm-ci':'failure'});assert.equal(r.verdict,'FAILED')}));
test('all four successful conclusions with logs yields PASSED',()=>fixture(d=>{for(const n of ['npm-ci.log','integration.log','jest.log','react-build.log'])fs.writeFileSync(path.join(d,n),'ok');const r=buildSummary(d,{'npm-ci':'success',integration:'success',jest:'success','react-build':'success'});assert.equal(r.verdict,'PASSED')}));
test('skipped steps do not count as success',()=>fixture(d=>{for(const n of ['npm-ci.log','integration.log','jest.log','react-build.log'])fs.writeFileSync(path.join(d,n),'ok');assert.equal(buildSummary(d,{'npm-ci':'failure',integration:'skipped',jest:'skipped','react-build':'skipped'}).verdict,'FAILED')}));
test('known log error signatures appear in summary',()=>fixture(d=>{fs.writeFileSync(path.join(d,'react-build.log'),'error TS2322: incompatible type');const r=buildSummary(d,{'react-build':'failure'});assert.ok(r.rows[3].diagnostics.includes('TypeScript'));assert.match(renderMarkdown(r),/TypeScript/)}));
