import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const folder=mkdtempSync(join(tmpdir(),'ustaxes-se-'))
try {
 execFileSync('npx',['tsc','--target','ES2020','--module','commonjs','--skipLibCheck','--outDir',folder,'src/nextgen/taxYears/scheduleSECore2025.ts'],{stdio:'pipe'})
 const {createRequire}=await import('node:module')
 const req=createRequire(import.meta.url)
 const {calculateScheduleSECore2025:calc,SE_2025_WAGE_BASE_CENTS:cap}=req(join(folder,'scheduleSECore2025.js'))
 const base={netProfitCents:10000000,socialSecurityWagesCents:0,medicareWagesCents:0,otherSEIncomeExcluded:true,optionalMethodsExcluded:true,churchIncomeExcluded:true,specialAdjustmentsExcluded:true,additionalMedicareTaxHandledSeparately:true}
 const r=calc(base)
 assert.equal(cap,17610000)
 assert.equal(r.status,'calculated-not-posted')
 assert.equal(r.netEarningsCents,9235000)
 assert.equal(r.socialSecurityTaxCents,1145140)
 assert.equal(r.medicareTaxCents,267815)
 assert.equal(r.totalTaxCents,1412955)
 assert.equal(r.halfDeductionCents,706478)
 const high=calc({...base,netProfitCents:20000000})
 assert.equal(high.socialSecurityTaxCents,2183640)
 assert.equal(high.medicareTaxCents,535630)
 const wage=calc({...base,socialSecurityWagesCents:17000000})
 assert.equal(wage.socialSecurityTaxCents,75640)
 assert.equal(calc({...base,socialSecurityWagesCents:17610000}).socialSecurityTaxCents,0)
 assert.equal(calc({...base,netProfitCents:40000}).status,'blocked')
 assert.equal(calc({...base,netProfitCents:-1}).status,'blocked')
 assert.equal(calc({...base,otherSEIncomeExcluded:false}).status,'blocked')
 assert.equal(calc({...base,additionalMedicareTaxHandledSeparately:false}).status,'blocked')
 assert.equal(calc({...base,netProfitCents:Infinity}).status,'blocked')
 const source=readFileSync('src/nextgen/taxYears/scheduleSECore2025.ts','utf8')
 assert.ok(source.includes("'calculated-not-posted'"))
 console.log('PASS: 2025 Schedule SE core: wage base, W-2 interaction, Medicare, half deduction, invalid inputs, and non-posting safeguards.')
} finally {rmSync(folder,{recursive:true,force:true})}
