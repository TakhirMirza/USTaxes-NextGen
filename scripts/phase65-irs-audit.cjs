/* Phase 65: deterministic regression checks against IRS 2025 source fixtures.
   Never grants filing authorization. Run after npm install. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = process.cwd();
let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; process.stdout.write('PASS '+name+'\n'); } catch(e) { failed++; process.stderr.write('FAIL '+name+': '+e.message+'\n'); } }
function loadTs(rel, mocks={}) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext('(function(require,module,exports){'+js+'\n})', { }, {filename:rel})(id=>{
    if (id in mocks) return mocks[id];
    throw Error('Unexpected dependency '+id+' in '+rel);
  },module,module.exports);
  return module.exports;
}
const rules = JSON.parse(fs.readFileSync(path.join(root,'src/nextgen/tax2025-reference.json'),'utf8'));
const standard = {single:15750,marriedJoint:31500,marriedSeparate:15750,headOfHousehold:23625,qualifyingSurvivingSpouse:31500};
for(const [status, amount] of Object.entries(standard)) check('2025 standard deduction '+status,()=>assert.equal(rules.standardDeduction[status],amount));
const worksheet = loadTs('src/nextgen/taxYears/irsTaxComputationWorksheet2025.ts');
const cases = [
  ['single',100000,16914],['single',103350,17651],['single',197300,40199],
  ['marriedJoint',100000,11828],['marriedSeparate',100000,16914],['headOfHousehold',100000,15175],
  ['qualifyingSurvivingSpouse',100000,11828],
];
for(const [status,income,expected] of cases) check('IRS worksheet '+status+' $'+income,()=>{
  const r=worksheet.computeIrsTaxWorksheet2025(income,status,true);
  assert.equal(r.status,'computed'); assert.equal(r.line16TaxDollars,expected); assert.equal(r.filingReady,false);
});
for(const [name,income,status,confirmed] of [
  ['tax table required',99999,'single',true],['special methods not ruled out',100000,'single',false],
  ['negative taxable income',-1,'single',true],['fractional taxable income',100000.5,'single',true],
  ['invalid filing status',100000,'unknown',true]
]) check('block '+name,()=>assert.equal(worksheet.computeIrsTaxWorksheet2025(income,status,confirmed).status,'blocked'));
const core = loadTs('src/nextgen/taxYears/taxEngineCore2025.ts',{'../tax2025-reference.json':rules});
const base = {year:2025,filingStatus:'single',w2:[{id:'w1',employer:'Fictional Employer',box1:'50000.00',box2:'4000.00'}],interest:[{id:'i1',payer:'Fictional Bank',box1:'100.00'}],standardDeductionFactsConfirmed:true,taxpayerUnder65AndNotBlind:true,spouseUnder65AndNotBlind:true,notClaimableAsDependent:true,noOtherIncomeAdjustmentsCreditsOrTaxes:true};
check('W-2 + interest 1040 mapping',()=>{const r=core.map2025SourcesTo1040(base);assert.equal(r.status,'mapped');assert.equal(r.lines['1a'],50000);assert.equal(r.lines['2b'],100);assert.equal(r.lines['9'],50100);assert.equal(r.lines['12e'],15750);assert.equal(r.lines['15'],34350);assert.equal(r.lines['25a'],4000);assert.equal(r.filingReady,false)});
check('other year never falls back to 2025',()=>assert.equal(core.map2025SourcesTo1040({...base,year:2026}).status,'blocked'));
check('missing deduction eligibility blocks',()=>assert.equal(core.map2025SourcesTo1040({...base,notClaimableAsDependent:false}).status,'blocked'));
check('duplicate document ID blocks',()=>assert.equal(core.map2025SourcesTo1040({...base,w2:[base.w2[0],base.w2[0]]}).status,'blocked'));
check('malformed amount blocks',()=>assert.equal(core.map2025SourcesTo1040({...base,w2:[{...base.w2[0],box1:'50,000'}]}).status,'blocked'));
check('missing withholding blocks',()=>assert.equal(core.map2025SourcesTo1040({...base,w2:[{...base.w2[0],box2:''}]}).status,'blocked'));
check('source does not authorize filing',()=>{const r=core.map2025SourcesTo1040(base);assert.equal(r.filingReady,false);assert.ok(r.unsupported.length>0)});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'PHASE65_IRS_SOURCES.json'),'utf8'));
check('IRS source manifest completeness',()=>{assert.equal(manifest.taxYear,2025);assert.ok(manifest.sources.every(s=>s.url.startsWith('https://www.irs.gov/')));assert.equal(manifest.releaseAuthorized,false)});
process.stdout.write(`\nPhase 65: ${passed} passed, ${failed} failed. Filing/PDF/e-file remain disabled.\n`);
if(failed) process.exit(1);
