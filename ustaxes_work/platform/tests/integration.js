'use strict'
const assert=require('assert').strict;const fs=require('fs');const path=require('path');
const {listYears}=require('../rules/catalog');const {getFormRegistry}=require('../forms/registry');
const ui=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/nextgen/year-manifest.json'),'utf8'));
assert.equal(ui.schemaVersion,1);
assert.deepEqual(ui.years.map(y=>y.year),listYears().map(y=>y.year));
for(const year of ui.years){
 const rule=listYears().find(y=>y.year===year.year);
 assert.equal(year.status,rule.status);
 assert.equal(year.formsStatus,getFormRegistry(year.year).status);
 assert.equal(year.filingReady,year.status==='ready'&&year.formsStatus==='ready');
 if(year.year>=2025)assert.equal(year.filingReady,false);
}
const main=fs.readFileSync(path.join(__dirname,'../../src/components/Main.tsx'),'utf8');
assert.ok(main.includes('<TaxYearManager />'));
console.log('PASS: UI manifest, release gates, and React integration');
