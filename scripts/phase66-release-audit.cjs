#!/usr/bin/env node
/* Read-only acceptance audit. A passing audit is NOT a filing authorization. */
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const checks=[];
function check(id,description,fn){try{const evidence=fn();checks.push({id,description,status:'PASS',evidence});}catch(e){checks.push({id,description,status:'FAIL',evidence:String(e.message)});}}
check('SRC-001','Application entry point and build manifest exist',()=>{for(const p of ['src/main.tsx','package.json','tsconfig.json','vite.config.ts'])if(!exists(p))throw Error('Missing '+p);return 'Core source and build manifest present';});
check('SRC-002','2025 calculation source explicitly denies filing readiness',()=>{const p='src/nextgen/taxYears/taxEngineCore2025.ts',s=read(p);if(!s.includes('filingReady: false'))throw Error('No explicit filing denial');return p;});
check('SRC-003','2025 IRS worksheet does not silently use computation worksheet below $100k',()=>{const p='src/nextgen/taxYears/irsTaxComputationWorksheet2025.ts',s=read(p);if(!s.includes('taxableIncomeDollars < 100000')||!s.includes('filingReady: false'))throw Error('Worksheet guard missing');return p;});
check('SRC-004','2025 source-to-1040 core names unsupported tax and filing paths',()=>{const s=read('src/nextgen/taxYears/taxEngineCore2025.ts');for(const term of ['Tax Table','refund','electronic filing'])if(!s.includes(term))throw Error('Missing unsupported feature: '+term);return 'Unsupported calculations declared';});
check('SRC-005','IRS fixture audit and sources are present',()=>{for(const p of ['scripts/phase65-irs-audit.cjs','PHASE65_IRS_SOURCES.json'])if(!exists(p))throw Error('Missing '+p);const m=JSON.parse(read('PHASE65_IRS_SOURCES.json'));if(m.taxYear!==2025||m.releaseAuthorized!==false)throw Error('Invalid IRS fixture manifest');return '2025 fixture source manifest present';});
check('SRC-006','Canonical Income integration exists',()=>{const p='src/nextgen/taxYears/canonicalReturnView.ts';if(!exists(p))throw Error('Missing '+p);return p;});
check('SRC-007','Release manifest denies official tax filing',()=>{const m=JSON.parse(read('PHASE66_RELEASE_MANIFEST.json'));if(m.releaseAuthorized!==false||m.realTaxpayerDataAllowed!==false||m.efileEnabled!==false)throw Error('Unsafe release flags');return 'Release flags all fail closed';});
const blockers=[
{id:'TAX-001',severity:'BLOCKER',area:'2025 federal tax',reason:'2025 IRS Tax Table for taxable income under $100,000 not implemented and independently validated',acceptance:'Tax Table values verified against IRS source with boundary and filing-status tests'},
{id:'TAX-002',severity:'BLOCKER',area:'2025 federal tax',reason:'Special tax rate worksheets, additional schedules, adjustments, credits and additional taxes lack complete coverage',acceptance:'Document supported filing situations; independently test every advertised calculation and unsupported fallback'},
{id:'RET-001',severity:'BLOCKER',area:'Return output',reason:'Final Form 1040 line 24, refunds and amount due not fully produced and validated',acceptance:'End-to-end reconciliation from source documents to all required 1040 lines'},
{id:'PRIV-001',severity:'BLOCKER',area:'Privacy and security',reason:'Browser-only storage and prototype security have not been approved for real taxpayer information',acceptance:'Threat model, privacy controls, secure persistence, data lifecycle and review completed'},
{id:'PDF-001',severity:'BLOCKER',area:'Output',reason:'Official printable tax return PDF not implemented and validated',acceptance:'IRS-compatible PDF output and cross-field validation verified'},
{id:'EFILE-001',severity:'BLOCKER',area:'Electronic filing',reason:'No IRS-authorized e-file integration or compliance validation',acceptance:'Separate integration, certification and operational compliance; not required for preview release'},
{id:'YEAR-001',severity:'BLOCKER',area:'2026–2028',reason:'Future-year federal rules not implemented and verified',acceptance:'Year-specific source manifests, calculations and regression tests'}];
const manifest=JSON.parse(read('PHASE66_RELEASE_MANIFEST.json'));
const report={schemaVersion:1,project:'USTaxes NextGen',audit:'Phase 66 acceptance audit',taxYear:2025,sourceRevision:process.env.GITHUB_SHA||'local-unversioned',releaseStatus:'DEVELOPMENT_PREVIEW_ONLY',officialTaxFilingAuthorized:false,realTaxpayerDataAllowed:false,summary:{checksPassed:checks.filter(x=>x.status==='PASS').length,checksFailed:checks.filter(x=>x.status==='FAIL').length,openReleaseBlockers:blockers.length},checks,blockers,releaseManifest:manifest};
const output=path.join(root,'PHASE66_ACCEPTANCE_REPORT.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('Phase 66 acceptance audit');for(const c of checks)console.log(`${c.status} ${c.id}: ${c.description}${c.status==='FAIL'?' — '+c.evidence:''}`);
console.log(`Release blockers: ${blockers.length}. Status: DEVELOPMENT_PREVIEW_ONLY`);
console.log('Wrote PHASE66_ACCEPTANCE_REPORT.json');
if(report.summary.checksFailed)process.exitCode=1;
