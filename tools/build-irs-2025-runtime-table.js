#!/usr/bin/env node
/** Stage 21: compile two matching full transcriptions into an explicitly
 * unapproved TypeScript data module. Does NOT prove IRS source accuracy. */
'use strict'
const fs = require('fs')
const path = require('path')
const {auditIndependentTranscriptions} = require('./audit-irs-2025-tax-table')
function build(a, b) {
  const report = auditIndependentTranscriptions(a, b)
  if (!report.transcriptionsAgree) throw Error('Independent CSV copies disagree')
  const {parseCandidate} = require('./import-irs-2025-tax-table')
  const rows = parseCandidate(a)
  const header = `/** GENERATED CANDIDATE — NOT independently approved for tax filing.
 * IRS source: https://www.irs.gov/publications/p1040
 * CSV A SHA256: ${report.firstSha256}
 * CSV B SHA256: ${report.secondSha256}
 * A matching second CSV alone does not establish independent review.
 */
import { PublishedTaxRow2025 } from './irsPublishedTaxTable2025'
`
  return {source: header + 'export const IMPORTED_2025_TAX_ROWS: ReadonlyArray<PublishedTaxRow2025> = ' + JSON.stringify(rows) + '\n', report}
}
if (require.main === module) {
  const [a,b,out] = process.argv.slice(2)
  if (!a || !b || !out) {console.error('Usage: node tools/build-irs-2025-runtime-table.js A.csv B.csv OUTPUT.ts'); process.exit(2)}
  try {
    if (path.resolve(a) === path.resolve(b)) throw Error('Separate source files required')
    const {source, report} = build(fs.readFileSync(a,'utf8'),fs.readFileSync(b,'utf8'))
    fs.mkdirSync(path.dirname(out),{recursive:true})
    fs.writeFileSync(out,source)
    console.log(`Generated ${report.intervalsChecked} candidate rows; filingReady=false`)
  } catch (e) {console.error(e.message);process.exit(1)}
}
module.exports = {build}
