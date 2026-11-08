import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const source=readFileSync(new URL('../src/nextgen/taxYears/federalBalanceValidation2025.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const module={exports:{}};new Function('module','exports',js)(module,module.exports)
const {cents2025,validateFederalBalance2025,BALANCE_FIXTURE_2025,federalBalanceCsv2025}=module.exports
assert.equal(cents2025('1,234.56'),123456)
assert.equal(cents2025('-1.02'),-102)
for(const bad of ['','1.234','Infinity','1e4','$1','-'])assert.equal(cents2025(bad),null)
const good=validateFederalBalance2025(BALANCE_FIXTURE_2025)
assert.equal(good.evaluated,12)
assert.equal(good.passed,12)
assert.equal(good.missing,0)
assert.equal(good.findings.filter(x=>x.severity==='blocker').length,0)
assert.equal(good.status,'blocked')
const wrong=validateFederalBalance2025({...BALANCE_FIXTURE_2025,l24:'8600',l34:'500',l37:'100'})
assert.ok(wrong.findings.some(x=>x.code==='TOTAL_TAX'))
assert.ok(wrong.findings.some(x=>x.code==='OVERPAYMENT'))
assert.ok(wrong.findings.some(x=>x.code==='MUTUALLY_EXCLUSIVE_BALANCE'))
const missing=validateFederalBalance2025({...BALANCE_FIXTURE_2025,l9:''})
assert.equal(missing.missing,1)
assert.equal(missing.evaluated,11)
assert.ok(federalBalanceCsv2025(good).includes('NOT_TAX_ADVICE'))
console.log('Phase 32: 2025 federal balance validation tests passed')
