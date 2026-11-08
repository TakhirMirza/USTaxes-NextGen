import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const code=readFileSync(new URL('../src/nextgen/taxYears/scenarioRegression2025.ts',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/components/NextGen2025ScenarioRegression.tsx',import.meta.url),'utf8')
const root=readFileSync(new URL('../src/components/NextGenV2Foundation.tsx',import.meta.url),'utf8')
for(const phrase of ['compareScenarios2025','REGRESSION_SCENARIOS_2025','scenarioRegressionCsv2025','regressions','improvements','cents2025'])assert.ok(code.includes(phrase),phrase)
assert.ok(ui.includes('FILING DISABLED'))
assert.ok(ui.includes('Export Phase 33 comparison CSV'))
assert.ok(root.includes("<NextGen2025ScenarioRegression year={year} />"))
assert.ok(!code.includes('localStorage'))
console.log('Phase 33 source/integration smoke checks passed (not an execution test of tax arithmetic)')
