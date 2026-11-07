'use strict'
const assert=require('assert').strict
const {listYears,getYear,validateYearRules}=require('../rules/catalog')
const {validateReturn}=require('../domain/return')
const {previewOrdinaryIncome,calculateReturn}=require('../engine/calculate')
const {plan,fetchBuffer}=require('../irs/sync')
const {getFormRegistry}=require('../forms/registry')
const base={taxYear:2025,filingStatus:'single',incomeItems:[{kind:'w2',amount:100000}],withholdingItems:[{amount:15000}]}
let count=0
function test(name,fn){fn();console.log('PASS',name);count++}
test('year registry supports forward-looking years',()=>assert.deepEqual(listYears().map(y=>y.year),[2020,2021,2025,2026,2027,2028]))
test('2025 reference brackets are well-formed',()=>assert.deepEqual(validateYearRules(getYear(2025)),[]))
test('unknown year blocked',()=>assert.equal(getYear(2035).status,'unavailable'))
test('2025 cannot be filed',()=>assert.throws(()=>calculateReturn(base),e=>e.code==='NOT_FILING_READY'))
test('2026 cannot be filed',()=>assert.throws(()=>calculateReturn({...base,taxYear:2026}),e=>e.code==='NOT_FILING_READY'))
test('2027 cannot be filed',()=>assert.throws(()=>calculateReturn({...base,taxYear:2027}),e=>e.code==='NOT_FILING_READY'))
test('2025 preview flagged as non-fileable',()=>{const x=previewOrdinaryIncome(base);assert.equal(x.taxableIncome,84250);assert.equal(x.filingReady,false)})
test('unsupported income blocked',()=>assert.throws(()=>previewOrdinaryIncome({...base,incomeItems:[{kind:'dividends',amount:100}]}),e=>e.code==='UNSUPPORTED_INCOME'))
test('bad input blocked',()=>assert.ok(validateReturn({...base,filingStatus:'unknown'}).length))
test('2026 PDFs are not falsely marked validated',()=>assert.equal(getFormRegistry(2026).status,'pending'))
test('IRS plan only references approved host',()=>assert.ok(plan(2026).documents.every(d=>d.url.startsWith('https://www.irs.gov/'))))
test('IRS plan rejects bad years',()=>assert.throws(()=>plan(0)))
console.log(`${count} architecture tests passed`)
