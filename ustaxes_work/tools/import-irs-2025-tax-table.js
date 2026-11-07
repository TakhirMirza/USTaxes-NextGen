#!/usr/bin/env node
/**
 * Stage 18: strict, dependency-free importer for manually checked IRS 2025
 * Publication 1040 Tax Table CSV. This tool NEVER promotes imported data
 * to a filing-ready calculation. Output is a candidate for human review.
 *
 * Usage: node tools/import-irs-2025-tax-table.js INPUT.csv OUTPUT.json
 * CSV columns: lower,upper,single,marriedJoint,marriedSeparate,headOfHousehold
 * Source: https://www.irs.gov/publications/p1040
 */
'use strict'
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

const FIELDS = ['lower','upper','single','marriedJoint','marriedSeparate','headOfHousehold']
const EXPECTED_SOURCE = 'https://www.irs.gov/publications/p1040'
const REFERENCE = { lower:25300, upper:25350, single:2801, marriedJoint:2562, marriedSeparate:2801, headOfHousehold:2699 }
// Independently visible in the first panel of IRS Publication 1040 (2025).
const FIRST_PANEL = [
  0,1,2,4,6,9,11,14,16,19,21,24,26,29,31,34,36,39,41,44,46,
  49,51,54,56,59,61,64,66,69,71,74,76,79,81,84,86,89,91,94,96,99
]
const SAMPLE_ROWS = [
  [25200,25250,2789,2550,2789,2687],
  [25250,25300,2795,2556,2795,2693],
  [25300,25350,2801,2562,2801,2699],
  [25350,25400,2807,2568,2807,2705],
]
function expectedIntervals() {
  const ranges = [[0,5],[5,15],[15,25]]
  for (let lower=25;lower<3000;lower+=25) ranges.push([lower,lower+25])
  for (let lower=3000;lower<100000;lower+=50) ranges.push([lower,lower+50])
  return ranges
}
const EXPECTED_INTERVALS = expectedIntervals()


function parseCandidate(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  if (lines.length < 2) throw Error('CSV must have header and rows')
  const header = lines.shift().trim().split(',').map(s => s.trim())
  if (header.join(',') !== FIELDS.join(',')) throw Error('Unexpected CSV columns: ' + header.join(','))
  const rows = lines.map((line, i) => {
    const cells = line.split(',').map(s => s.trim())
    if (cells.length !== FIELDS.length) throw Error(`Row ${i+2}: expected ${FIELDS.length} fields`)
    const row = {}
    FIELDS.forEach((key, k) => {
      if (!/^\d+$/.test(cells[k])) throw Error(`Row ${i+2}: invalid integer for ${key}`)
      row[key] = Number(cells[k])
      if (!Number.isSafeInteger(row[key])) throw Error(`Row ${i+2}: unsafe integer for ${key}`)
    })
    return row
  })
  validateCandidate(rows)
  return rows
}

function validateCandidate(rows) {
  if (rows.length !== EXPECTED_INTERVALS.length) {
    throw Error(`Expected ${EXPECTED_INTERVALS.length} official tax-table intervals, received ${rows.length}`)
  }
  for (const [i, row] of rows.entries()) {
    const [lower,upper] = EXPECTED_INTERVALS[i]
    if (row.lower !== lower || row.upper !== upper) {
      throw Error(`Row ${i+2}: expected IRS interval [${lower},${upper}), received [${row.lower},${row.upper})`)
    }
    for (const status of FIELDS.slice(2)) {
      if (!Number.isSafeInteger(row[status]) || row[status] < 0) {
        throw Error(`Row ${i+2}: invalid tax for ${status}`)
      }
      if (i && row[status] < rows[i-1][status]) {
        throw Error(`Row ${i+2}: tax decreases for ${status}`)
      }
    }
    // The IRS publication uses the same column for qualifying surviving spouse and MFJ.
    // That fifth filing status is mapped by the consumer, not a separate CSV column.
    if (i < FIRST_PANEL.length) {
      for (const status of FIELDS.slice(2)) {
        if (row[status] !== FIRST_PANEL[i]) {
          throw Error(`Row ${i+2}: IRS first-panel value mismatch for ${status}`)
        }
      }
    }
  }
  for (const [lower,upper,single,marriedJoint,marriedSeparate,headOfHousehold] of SAMPLE_ROWS) {
    const row = rows.find(r => r.lower === lower)
    if (!row || row.upper !== upper || row.single !== single ||
        row.marriedJoint !== marriedJoint || row.marriedSeparate !== marriedSeparate ||
        row.headOfHousehold !== headOfHousehold) {
      throw Error(`IRS reference row $${lower}–$${upper} does not match publication`)
    }
  }
  return true
}

function createCandidate(text) {
  const rows = parseCandidate(text)
  return {
    schemaVersion: 1,
    taxYear: 2025,
    source: EXPECTED_SOURCE,
    sourceFormat: 'human-transcribed-csv',
    reviewedAgainstOfficialPublication: false,
    filingReady: false,
    csvSha256: crypto.createHash('sha256').update(text).digest('hex'),
    rowCount: rows.length,
    rows,
  }
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) {
    console.error('Usage: node tools/import-irs-2025-tax-table.js INPUT.csv OUTPUT.json')
    process.exit(2)
  }
  try {
    const raw = fs.readFileSync(input, 'utf8')
    const candidate = createCandidate(raw)
    const target = path.resolve(output)
    if (path.resolve(input) === target) throw Error('Input and output paths must differ')
    fs.mkdirSync(path.dirname(target), {recursive:true})
    fs.writeFileSync(target, JSON.stringify(candidate, null, 2) + '\n')
    console.log(`Validated ${candidate.rowCount} contiguous intervals. Saved UNREVIEWED candidate to ${target}`)
  } catch (error) {
    console.error('IRS 2025 Tax Table import rejected:', error.message)
    process.exit(1)
  }
}
module.exports = {parseCandidate, validateCandidate, createCandidate, expectedIntervals}
