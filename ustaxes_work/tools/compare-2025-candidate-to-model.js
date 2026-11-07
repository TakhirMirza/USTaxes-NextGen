#!/usr/bin/env node
/**
 * Diagnostic only: compare an independently sourced IRS CSV against the
 * reconstructed 2025 rate-model CSV. The model is NOT IRS source evidence.
 * A zero-difference result never establishes filing readiness.
 */
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const {parseCandidate} = require('./import-irs-2025-tax-table')
const TAX_FIELDS = ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold']
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex')
function compareCandidateToModel(candidateCsv, modelCsv) {
  const candidate = parseCandidate(candidateCsv)
  const model = parseCandidate(modelCsv)
  const differences = []
  for (let i = 0; i < candidate.length; i++) {
    for (const field of TAX_FIELDS) {
      if (candidate[i][field] !== model[i][field]) {
        differences.push({ lower: candidate[i].lower, upper: candidate[i].upper,
          filingStatus: field, publishedCandidate: candidate[i][field], reconstructedModel: model[i][field] })
      }
    }
  }
  return {
    taxYear: 2025,
    officialSourceUrl: 'https://www.irs.gov/publications/p1040',
    candidateSha256: sha256(candidateCsv), modelSha256: sha256(modelCsv),
    intervalsCompared: candidate.length, taxValuesCompared: candidate.length * TAX_FIELDS.length,
    differenceCount: differences.length, differences,
    independentlyVerifiedAgainstIRS: false, filingReady: false,
    warning: 'The comparison is diagnostic only. The reconstructed model is not a second IRS transcription. Confirm every candidate value directly against IRS Publication 1040.'
  }
}
if (require.main === module) {
  const [candidatePath, modelPath, reportPath] = process.argv.slice(2)
  if (!candidatePath || !modelPath || !reportPath) {
    console.error('Usage: node tools/compare-2025-candidate-to-model.js IRS_CANDIDATE.csv RECONSTRUCTED.csv REPORT.json')
    process.exit(2)
  }
  try {
    const resolved = [candidatePath, modelPath, reportPath].map(p => path.resolve(p))
    if (new Set(resolved).size !== 3) throw Error('All three paths must be different')
    const report = compareCandidateToModel(fs.readFileSync(candidatePath, 'utf8'), fs.readFileSync(modelPath, 'utf8'))
    fs.mkdirSync(path.dirname(reportPath), {recursive: true})
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
    console.log(`${report.taxValuesCompared} values compared; ${report.differenceCount} differences; filingReady=false`)
    if (report.differenceCount) process.exitCode = 1
  } catch (error) {
    console.error('Comparison failed:', error.message)
    process.exitCode = 1
  }
}
module.exports = {compareCandidateToModel}
