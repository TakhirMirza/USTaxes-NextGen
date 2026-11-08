#!/usr/bin/env node
/* Static inventory, not a tax accuracy or IRS compliance certification. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root,p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root,p));
const enumText = read('src/core/data/index.ts');
const formText = read('src/forms/yearRegistry.ts');
const declared = [...enumText.matchAll(/\b(Y20\d\d)\s*=\s*(20\d\d)/g)].map(m=>({id:m[1], year:+m[2]}));
const dirs = fs.readdirSync(path.join(root,'src/forms'),{withFileTypes:true}).filter(x=>x.isDirectory()&&/^Y20\d\d$/.test(x.name)).map(x=>x.name);
const ids = [...new Set([...declared.map(x=>x.id),...dirs])].sort();
const years = ids.map(id=>{
  const y=id.slice(1), p=`src/forms/${id}`;
  const files={federalEntry:`${p}/irsForms/Main.ts`, federalForm:`${p}/irsForms/F1040.ts`, federalData:`${p}/data/federal.ts`, taxTable:`${p}/irsForms/TaxTable.ts`, federalPdf:`public/forms/${id}/irs/f1040.pdf`, tests:`${p}/tests/taxRates.test.ts`};
  const presence=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,exists(v)]));
  const declaredInEnum=declared.some(x=>x.id===id);
  const wiredFederal=new RegExp(`\\b${id}\\s*:\\s*\\{[\\s\\S]*?createF1040\\s*:\\s*takeSecond\\(create1040For${y}\\)`).test(formText);
  const unsupported=new RegExp(`\\b${id}\\s*:\\s*\\{[\\s\\S]*?createF1040\\s*:\\s*\\(\\)\\s*=>\\s*left\\(\\[F1040Error\\.unsupportedTaxYear\\]`).test(formText);
  return {year:+y,id,declaredInEnum,wiredFederal,unsupported,files:presence,structuralCandidate:declaredInEnum&&wiredFederal&&Object.values(presence).every(Boolean),verifiedAgainstIRS:false,availableForFiling:false};
});
const issues=[];
for(const item of years){
 if(item.wiredFederal && !item.declaredInEnum) issues.push(`${item.id}: wired but missing enum`);
 if(item.wiredFederal && !item.files.federalPdf) issues.push(`${item.id}: wired but no Form 1040 PDF`);
 if(item.wiredFederal && !item.files.tests) issues.push(`${item.id}: wired but no taxRates tests`);
}
const result={disclaimer:'Structural inventory ONLY. verifiedAgainstIRS and availableForFiling are deliberately false until independently established.',years,issues};
if(require.main===module){console.log(JSON.stringify(result,null,2));if(process.argv.includes('--strict')&&issues.length)process.exitCode=1;}
module.exports={result};
