const fs = require('fs')
const file = process.argv[2]
if (!file || !fs.existsSync(file)) { console.error('Missing NextGen ESLint report'); process.exit(1) }
const reports = JSON.parse(fs.readFileSync(file, 'utf8'))
const errors = reports.reduce((n, r) => n + (r.errorCount || 0) + (r.fatalErrorCount || 0), 0)
const warnings = reports.reduce((n, r) => n + (r.warningCount || 0), 0)
console.log(`NextGen lint: ${errors} errors, ${warnings} warnings in ${reports.length} files`)
if (errors > 0) { console.error('NextGen lint errors must be fixed before merge'); process.exit(1) }
