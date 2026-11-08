// Dependency-light regression checks for the standalone source-integrity layer.
// Run after npm install: node scripts/check-federal-sources-2025.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const source = readFileSync(new URL('../src/nextgen/taxYears/federalSourceIntegrity2025.ts', import.meta.url), 'utf8')
const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true })
assert.equal(result.diagnostics?.length || 0, 0, 'TypeScript transpilation errors')
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(result.outputText).toString('base64')
const { parseCents2025, reviewFederalSources2025, federalSourceIntegrityCsv2025 } = await import(moduleUrl)

const valid = {
  version: 1, year: '2025', filingStatus: 'single', hasDependents: 'no', deduction: 'standard',
  incomeKinds: ['W-2 wages', '1099-INT interest'],
  wages: [{ id: 1, employer: 'FICTIONAL EMPLOYER', wages: '12000.01', withholding: '1000.02' }],
  interest: '12.34', payer: 'FICTIONAL PAYER', basicDeductionConfirmed: true,
  noOtherItemsConfirmed: true, ordinaryTaxMethodConfirmed: true
}
let count = 0
function test(label, fn) { fn(); count++; process.stdout.write(`PASS ${label}\n`) }
function codes(draft) { return reviewFederalSources2025(draft).findings.map(f => f.code) }
test('integer cents exact', () => assert.equal(parseCents2025('100.01'), 10001))
test('zero cents exact', () => assert.equal(parseCents2025('0'), 0))
test('excess precision rejected', () => assert.equal(parseCents2025('1.001'), null))
test('negative values rejected', () => assert.equal(parseCents2025('-1'), null))
test('scientific notation rejected', () => assert.equal(parseCents2025('1e4'), null))
test('unsafe integers rejected', () => assert.equal(parseCents2025('999999999999999'), null))
test('W-2 and interest aggregate exactly', () => {
  const r = reviewFederalSources2025(valid)
  assert.deepEqual(r.totals, { wagesCents: 1200001, withholdingCents: 100002, interestCents: 1234 })
  assert.equal(r.filingReady, false)
})
test('missing W-2 detected', () => assert(codes({ ...valid, wages: [] }).includes('W2_MISSING')))
test('invalid W-2 money detected', () => assert(codes({ ...valid, wages: [{ ...valid.wages[0], wages: '1.234' }] }).includes('W2_1_WAGES')))
test('high withholding flagged', () => assert(codes({ ...valid, wages: [{ ...valid.wages[0], withholding: '13000' }] }).includes('W2_1_HIGH_WITHHOLDING')))
test('duplicate W-2 IDs blocked', () => assert(codes({ ...valid, wages: [valid.wages[0], valid.wages[0]] }).includes('W2_DUPLICATE_ID')))
test('unselected W-2 entries flagged', () => assert(codes({ ...valid, incomeKinds: ['1099-INT interest'] }).includes('W2_NOT_SELECTED')))
test('unselected interest fields flagged', () => assert(codes({ ...valid, incomeKinds: ['W-2 wages'] }).includes('INTEREST_NOT_SELECTED')))
test('duplicate income selection blocked', () => assert(codes({ ...valid, incomeKinds: ['W-2 wages', 'W-2 wages'] }).includes('INCOME_SELECTION_DUPLICATE')))
test('unsupported tax year blocked', () => assert(codes({ ...valid, year: '2026' }).includes('YEAR_UNSUPPORTED')))
test('unsupported income category blocked', () => assert(codes({ ...valid, incomeKinds: ['1099-DIV dividends'] }).includes('UNSUPPORTED_INCOME')))
test('diagnostic CSV excludes labels and money', () => {
  const csv = federalSourceIntegrityCsv2025(reviewFederalSources2025(valid))
  for (const secret of ['FICTIONAL EMPLOYER', 'FICTIONAL PAYER', '12000.01', '1000.02', '12.34']) assert(!csv.includes(secret))
})
console.log(`PASS ${count} federal source-integrity regression checks`)
