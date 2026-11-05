'use strict'
const assert = require('assert')
const { parseCandidate, createCandidate, expectedIntervals } = require('./import-irs-2025-tax-table')
const header = 'lower,upper,single,marriedJoint,marriedSeparate,headOfHousehold\n'
const ranges = expectedIntervals()
assert.strictEqual(ranges[0].join(','), '0,5')
assert.strictEqual(ranges[2].join(','), '15,25')
assert.strictEqual(ranges[3].join(','), '25,50')
assert.strictEqual(ranges[ranges.length-1].join(','), '99950,100000')
assert.strictEqual(ranges.length, 2062)
const first = [0,1,2,4,6,9,11,14,16,19,21,24,26,29,31,34,36,39,41,44,46,49,51,54,56,59,61,64,66,69,71,74,76,79,81,84,86,89,91,94,96,99]
const fakeRows = ranges.map(([a,b],i) => `${a},${b},${i<first.length?first[i]:100},${i<first.length?first[i]:100},${i<first.length?first[i]:100},${i<first.length?first[i]:100}`)
assert.throws(() => parseCandidate(header + fakeRows.join('\n')), /reference row/)
assert.throws(() => parseCandidate(header + fakeRows.slice(1).join('\n')), /Expected .* intervals/)
const malformed = [...fakeRows]
malformed[3] = '25,55,0,0,0,0'
assert.throws(() => parseCandidate(header + malformed.join('\n')), /expected IRS interval/)
const invalid = [...fakeRows]
invalid[4] = '50,75,-1,0,0,0'
assert.throws(() => parseCandidate(header + invalid.join('\n')), /invalid integer/)
const sample = [...fakeRows]
const idx = ranges.findIndex(([a]) => a === 25300)
sample[idx] = '25300,25350,2801,2562,2801,2699'
assert.throws(() => parseCandidate(header + sample.join('\n')), /tax decreases|reference row/)
assert.strictEqual(typeof createCandidate, 'function')
console.log('PASS: IRS 2025 Tax Table strict importer — 10 assertions')
