import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const source=readFileSync(new URL('../src/nextgen/taxYears/crossScheduleReconciliation2025.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const module={exports:{}};new Function('module','exports',js)(module,module.exports)
const {parseMoney2025,reconcileCrossSchedules2025,reconciliationReportCsv2025}=module.exports
assert.equal(parseMoney2025('1,234.56'),123456)
assert.equal(parseMoney2025('-12.03'),-1203)
assert.equal(parseMoney2025(''),null)
assert.equal(parseMoney2025('1.234'),null)
assert.equal(parseMoney2025('1e4'),null)
assert.equal(parseMoney2025('Infinity'),null)
const valid={c31:'1000',se12:'140',se13:'70',s1l3:'1000',s1otherIncome:'0',s1l10:'1000',s1l15:'70',s1otherAdjustments:'0',s1l26:'70',s2l4:'140',s2otherTaxes:'0',s2l21:'140',f1040l8:'1000',f1040l10:'70',f1040l23:'140'}
const good=reconcileCrossSchedules2025(valid)
assert.equal(good.checked,9)
assert.equal(good.matched,9)
assert.equal(good.missing,0)
assert.equal(good.status,'blocked')
assert.equal(good.findings.filter(f=>f.severity==='blocker').length,1)
const bad=reconcileCrossSchedules2025({...valid,f1040l23:'139',s1l3:'900'})
assert.ok(bad.findings.some(f=>f.code==='S2_TO_1040_TAX'))
assert.ok(bad.findings.some(f=>f.code==='C_TO_S1'))
assert.ok(bad.findings.some(f=>f.code==='S1_INCOME_TOTAL'))
const incomplete=reconcileCrossSchedules2025({...valid,s2otherTaxes:''})
assert.equal(incomplete.missing,1)
assert.equal(incomplete.checked,8)
assert.ok(reconciliationReportCsv2025(good).includes('NON_POSTING'))
console.log('Phase 31: all reconciliation regression assertions passed')
