#!/usr/bin/env node
const assert=require('node:assert/strict');
const {audit}=require('./stage79-lockfile-audit');
const pkg=require('../package.json');
const lock=require('../package-lock.json');
const tests=[
 ['Actual project lockfile',()=>assert.equal(audit(pkg,lock).ok,true,JSON.stringify(audit(pkg,lock).issues.slice(0,8)))],
 ['Missing package fails closed',()=>{const l=structuredClone(lock);delete l.packages['node_modules/react'];assert.equal(audit(pkg,l).ok,false)}],
 ['Stale direct dependency fails closed',()=>{const p=structuredClone(pkg);p.dependencies.react='^999.0.0';assert.equal(audit(p,lock).ok,false)}],
 ['Missing root metadata fails closed',()=>assert.equal(audit(pkg,{lockfileVersion:2,packages:{}}).ok,false)],
 ['Version mismatch fails closed',()=>{const l=structuredClone(lock);l.version='999';assert.equal(audit(pkg,l).ok,false)}],
];
for(const [name,fn] of tests){fn();console.log('PASS',name)}
console.log(`Stage 79 lockfile tests: ${tests.length}/${tests.length}`);
