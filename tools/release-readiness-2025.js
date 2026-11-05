#!/usr/bin/env node
/* Conservative, deterministic release gate. No network calls. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const manifest = JSON.parse(read('src/nextgen/year-manifest.json'));
const year = manifest.years.find(y => y.year === 2025);
const table = read('src/nextgen/taxYears/irsImportedTaxTable2025.ts');
const checks = [
  { name: '2025 year is explicitly not filing-ready', pass: !!year && year.filingReady === false },
  { name: 'Year registry still blocks filing', pass: read('src/nextgen/taxYears/registry.ts').includes("config.status === 'ready'") },
  { name: 'Pipeline explicitly refuses filing', pass: /filingReady:\s*false/.test(read('src/nextgen/taxYears/form1040Pipeline2025.ts')) },
  { name: 'Review UI uses pipeline', pass: read('src/components/Tax2025Preview.tsx').includes('build2025Form1040Review') },
  { name: 'PDF and e-file remain explicitly unsupported', pass: read('src/nextgen/taxYears/form1040Pipeline2025.ts').includes('PDF/e-file have not been implemented') },
  { name: 'Full verified IRS tax table is present', pass: !/IMPORTED_2025_TAX_ROWS[^=]*=\s*\[\s*\]/.test(table) && !/verified:\s*false/.test(table) },
];
const blockers = checks.filter(c => !c.pass).map(c => c.name);
const report = { year: 2025, releaseReady: false, checks, blockers,
  note: 'Passing structural checks never authorizes filing; human tax review, full tax-table provenance, end-to-end testing, and IRS-compliant PDF/e-file are required.' };
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  for (const c of checks) console.log(`${c.pass ? 'PASS' : 'BLOCK'} ${c.name}`);
  console.log('FILING RELEASE: BLOCKED');
}
if (process.argv.includes('--strict')) process.exit(1);
