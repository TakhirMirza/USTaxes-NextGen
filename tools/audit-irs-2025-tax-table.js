#!/usr/bin/env node
/** Stage 20: independently compare two human-reviewed transcriptions of the
 * 2025 IRS Publication 1040 Tax Table. Never authorizes filing. */
'use strict'
const fs = require('fs')
const crypto = require('crypto')
const {parseCandidate} = require('./import-irs-2025-tax-table')
const FIELDS = ['lower','upper','single','marriedJoint','marriedSeparate','headOfHousehold']
function auditIndependentTranscriptions(firstCsv, secondCsv) {
  const first = parseCandidate(firstCsv)
  const second = parseCandidate(secondCsv)
  const mismatches = []
  first.forEach((row, index) => {
    for (const field of FIELDS) {
      if (row[field] !== second[index][field]) {
        mismatches.push({row: index + 2, interval: `${row.lower}-${row.upper}`, field,
          first: row[field], second: second[index][field]})
      }
    }
  })
  return {
    taxYear: 2025,
    source: 'https://www.irs.gov/publications/p1040',
    firstSha256: crypto.createHash('sha256').update(firstCsv).digest('hex'),
    secondSha256: crypto.createHash('sha256').update(secondCsv).digest('hex'),
    intervalsChecked: first.length,
    valuesChecked: first.length * 4,
    mismatches,
    transcriptionsAgree: mismatches.length === 0,
    independentlyVerifiedAgainstIRS: false,
    filingReady: false,
    warning: 'Agreement of two CSV files does not prove either was independently transcribed or verified against IRS. Human source review and full tax-return tests remain mandatory.'
  }
}
if (require.main === module) {
  const [a,b,report] = process.argv.slice(2)
  if (!a || !b || !report) {
    console.error('Usage: node tools/audit-irs-2025-tax-table.js TRANSCRIPTION_A.csv TRANSCRIPTION_B.csv REPORT.json')
    process.exit(2)
  }
  try {
    if (require('path').resolve(a) === require('path').resolve(b)) throw Error('Two different input files required')
    const result = auditIndependentTranscriptions(fs.readFileSync(a,'utf8'), fs.readFileSync(b,'utf8'))
    fs.writeFileSync(report, JSON.stringify(result,null,2)+'\n')
    console.log(`${result.intervalsChecked} intervals, ${result.valuesChecked} tax amounts; ${result.mismatches.length} differences; filingReady=false`)
    if (!result.transcriptionsAgree) process.exitCode = 1
  } catch (e) {
    console.error('Audit rejected:', e.message)
    process.exitCode = 1
  }
}
module.exports = {auditIndependentTranscriptions}
