import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STATES, stateInfo } from './states.ts'
import { normalizeReturn } from './model.ts'

test('all 50 states and DC, each once', () => {
  assert.equal(STATES.length, 51)
  assert.equal(new Set(STATES.map((s) => s.code)).size, 51)
  assert.deepEqual(STATES.filter((s) => s.support === 'no-tax').map((s) => s.code).sort(), ['AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY'])
  assert.ok(STATES.filter((s) => s.support !== 'no-tax').every((s) => s.form))
  assert.equal(stateInfo('va')?.support, 'supported')
})

test('a saved return with a Virginia return switched on gets Virginia as its state', () => {
  assert.equal(normalizeReturn({ virginia: { enabled: true } }).residentState, 'VA')
  assert.equal(normalizeReturn({}).residentState, '')
  assert.equal(normalizeReturn({ residentState: 'tx', virginia: { enabled: true } }).residentState, 'TX')
})
