'use strict'
// Single source of truth for UI availability. Never promote a year from the UI.
const fs=require('fs'); const path=require('path');
const {listYears}=require('../rules/catalog');
const {getFormRegistry}=require('../forms/registry');
const years=listYears().map(y=>({
 year:y.year, status:y.status, reason:y.reason,
 capabilities:y.capabilities, formsStatus:getFormRegistry(y.year).status,
 filingReady:y.status==='ready' && getFormRegistry(y.year).status==='ready'
}));
const manifest={schemaVersion:1,generatedFrom:'platform/rules/catalog.js',years};
const target=path.resolve(__dirname,'../../src/nextgen/year-manifest.json');
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n');
console.log('Exported '+years.length+' tax years to '+target);
