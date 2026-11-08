// Read-only inventory. Does not certify tax calculations or IRS compliance.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const exists = (p) => fs.existsSync(path.join(root, p));
const files = fs.readdirSync(path.join(root, 'src/forms'), {withFileTypes:true});
const years = files.filter(x=>x.isDirectory() && /^Y\d{4}$/.test(x.name)).map(x=>x.name).sort();
const results = years.map(year => ({
  year: Number(year.slice(1)),
  federalLogic: exists(`src/forms/${year}/irsForms/F1040.ts`),
  federalData: exists(`src/forms/${year}/data/federal.ts`),
  federalEntry: exists(`src/forms/${year}/irsForms/Main.ts`),
  taxTable: exists(`src/forms/${year}/irsForms/TaxTable.ts`),
  pdfTemplate: exists(`public/forms/${year.slice(1)}/irs/f1040.pdf`),
  testsFolder: exists(`src/forms/${year}/tests`)
}));
console.log(JSON.stringify({ note:'File presence only; not correctness or tax-year certification', years: results }, null, 2));
