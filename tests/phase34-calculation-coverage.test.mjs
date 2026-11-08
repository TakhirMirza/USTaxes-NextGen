import assert from 'node:assert/strict'
import fs from 'node:fs'
const core=fs.readFileSync('src/nextgen/taxYears/calculationCoverage2025.ts','utf8')
const component=fs.readFileSync('src/components/NextGen2025CalculationCoverage.tsx','utf8')
const foundation=fs.readFileSync('src/components/NextGenV2Foundation.tsx','utf8')
const rules=[...core.matchAll(/\{code:'([A-Z_]+)',target:'(l\w+)'/g)]
assert.equal(rules.length,12,'12 arithmetic rules registered')
assert.equal(new Set(rules.map(r=>r[1])).size,12,'unique rule codes')
assert.match(core,/validateFederalBalance2025\(mutated\)/)
assert.match(core,/validateFederalBalance2025\(missingFixture\)/)
assert.match(core,/filingAllowed:false/)
assert.match(component,/calculationCoverageCsv2025/)
assert.match(foundation,/NextGen2025CalculationCoverage year=\{year\}/)
console.log('Phase 34 coverage structure: 7 assertions passed')
