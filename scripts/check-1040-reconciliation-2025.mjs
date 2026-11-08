import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let ts
try { ts = require('typescript') } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript') }
const source = readFileSync(new URL('../src/nextgen/taxYears/federal1040SourceReconciliation2025.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import .*$/gm, ''), { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText
const mapping = (input) => ({ year: 2025, filingReady: false, status: 'blocked', blockers: ['Age, blindness and claimability facts not independently verified.'], lines: { '1a': null, '2b': null, '9': null, '11a': null, '15': null, '25a': null, '25d': null } })
const integrity = (draft) => ({ totals: { wagesCents: 10001, withholdingCents: 200, interestCents: 35 }, findings: draft.year === '2025' ? [] : [{ code: 'YEAR_UNSUPPORTED', severity: 'error', message: 'Unsupported year' }] })
const evaluate = new Function('reviewFederalSources2025', 'map2025SourcesTo1040', 'exports', js.replace(/export /g, '') + '\nreturn { reconcile2025DraftTo1040, reconciliationCsv2025 }')
const { reconcile2025DraftTo1040, reconciliationCsv2025 } = evaluate(integrity, mapping, {})
const base = { year: '2025', filingStatus: 'single', hasDependents: 'no', deduction: 'standard', incomeKinds: ['W-2 wages', '1099-INT interest'], wages: [{ id: 1, employer: 'SECRET EMPLOYER', wages: '100.01', withholding: '2.00' }], interest: '0.35', payer: 'SECRET PAYER', basicDeductionConfirmed: true, noOtherItemsConfirmed: true, ordinaryTaxMethodConfirmed: true }
let count = 0
function check(label, fn) { fn(); console.log('PASS', label); count++ }
const report = reconcile2025DraftTo1040(base)
check('filing is always disabled', () => assert.equal(report.filingReady, false))
check('missing independent facts block mapping', () => assert.equal(report.status, 'blocked'))
check('blocked mapping never exposes line values', () => assert(Object.values(report.lines).every(x => x === null)))
check('six explicit reconciliation controls', () => assert.equal(report.checks.length, 6))
check('failed controls have blocking findings', () => assert(report.issues.some(i => i.code === 'CHECK_W2_1A')))
check('unsupported year rejected', () => assert(reconcile2025DraftTo1040({ ...base, year: '2026' }).issues.some(i => i.code === 'UNSUPPORTED_YEAR')))
check('unsupported income rejected', () => assert(reconcile2025DraftTo1040({ ...base, incomeKinds: ['Capital gains'] }).issues.some(i => i.code === 'INCOME_SCOPE')))
check('dependent cases rejected', () => assert(reconcile2025DraftTo1040({ ...base, hasDependents: 'yes' }).issues.some(i => i.code === 'DEPENDENT_SCOPE')))
check('itemized deductions rejected', () => assert(reconcile2025DraftTo1040({ ...base, deduction: 'itemized' }).issues.some(i => i.code === 'DEDUCTION_SCOPE')))
check('missing confirmation rejected', () => assert(reconcile2025DraftTo1040({ ...base, basicDeductionConfirmed: false }).issues.some(i => i.code === 'UNVERIFIED_FACTS')))
const csv = reconciliationCsv2025(report)
check('diagnostic export excludes employer', () => assert(!csv.includes('SECRET EMPLOYER')))
check('diagnostic export excludes payer', () => assert(!csv.includes('SECRET PAYER')))
check('diagnostic export excludes source amounts', () => assert(!csv.includes('100.01') && !csv.includes('0.35')))
check('diagnostic export includes check codes', () => assert(csv.includes('W2_1A')))
console.log(`PASS ${count} 2025 reconciliation regression checks`)
