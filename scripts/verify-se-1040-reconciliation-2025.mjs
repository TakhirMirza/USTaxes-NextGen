import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const path='src/nextgen/taxYears/se1040Reconciliation2025.ts'
const source=fs.readFileSync(path,'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {reconcileSETo1040Workpaper2025:check}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const base={scheduleCProfitCents:5000000,schedule1Line3Cents:5000000,schedule1OtherIncomeCents:0,schedule1Line10Cents:5000000,
 schedule1Line15Cents:353300,schedule1OtherAdjustmentsCents:0,schedule1Line26Cents:353300,
 scheduleSELine12Cents:706600,scheduleSELine13Cents:353300,schedule2Line4Cents:706600,
 schedule2OtherTaxesCents:0,schedule2Line21Cents:706600,form1040Line8Cents:5000000,
 form1040Line10Cents:353300,form1040Line23Cents:706600,
 scheduleCReviewed:true,scheduleSEReviewed:true,otherSchedule1IncomeReviewed:true,
 otherSchedule1AdjustmentsReviewed:true,otherSchedule2TaxesReviewed:true}
const result=check(base)
assert.equal(result.status,'reconciled-not-posted')
assert.equal(result.filingReady,false)
assert.equal(result.trace.length,6)
for(const [name,changes] of [
 ['missing SE', {scheduleSELine12Cents:null}],
 ['mismatched Schedule 1', {form1040Line8Cents:4999999}],
 ['mismatched Schedule 2', {form1040Line23Cents:0}],
 ['mismatched half deduction', {scheduleSELine13Cents:353301,schedule1Line15Cents:353301,schedule1Line26Cents:353301,form1040Line10Cents:353301}],
 ['unreviewed zero', {otherSchedule2TaxesReviewed:false}],
 ['negative profit', {scheduleCProfitCents:-1}],
 ['fractional cents', {schedule1Line3Cents:1.2}],
 ['missing other taxes', {schedule2OtherTaxesCents:null}],
 ['unsafe number', {scheduleSELine12Cents:Number.MAX_SAFE_INTEGER}]
]) assert.equal(check({...base,...changes}).status,'blocked',name)
console.log('PASS: 2025 SE -> Schedule 1/2 -> Form 1040 reconciliation, nine negative cases, no automatic posting.')
