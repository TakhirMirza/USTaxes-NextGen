/* Stage 71: executable safety regression for the restricted Form 1040 JSON viewer. */
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaxes-stage71-'))
try {
  execFileSync('tsc', ['--target','es2020','--module','commonjs','--skipLibCheck','--resolveJsonModule','--esModuleInterop','--outDir',tmp,'src/nextgen/taxYears/form1040ReviewPresentation2025.ts'], {cwd:root, stdio:'pipe'})
  const {presentRestricted2025Review: review} = require(path.join(tmp,'taxYears','form1040ReviewPresentation2025.js'))
  const keys = ['17','18','20','21','22','23','24','31','32','33','34','37']
  const officialLines = Object.fromEntries(keys.map(k=>[k,null]))
  const candidateKeys = ['line17','line18','line20','line21','line22','line23','line24','line31','line32','line33','line34','line37']
  const candidates = Object.fromEntries(candidateKeys.map(k=>[k,null]))
  const base = {year:2025,filingReady:false,postingAuthorized:false,officialLines,candidates,blockers:['Development only']}
  const good = review(base)
  assert.equal(good.rows.length,12)
  assert(good.rows.every(r=>r.display==='Not reviewed'))
  assert.equal(review({...base,candidates:{...candidates,line24:123.45}}).rows[6].display,'$123.45')
  assert.throws(()=>review({...base,candidates:{...candidates,line24:undefined}}), /Invalid diagnostic amount/)
  assert.throws(()=>review({...base,candidates:{...candidates,line24:NaN}}), /Invalid diagnostic amount/)
  assert.throws(()=>review({...base,candidates:{...candidates,line24:-1}}), /Invalid diagnostic amount/)
  assert.throws(()=>review({...base,officialLines:{...officialLines,'24':0}}), /Official Form 1040 lines/)
  assert.throws(()=>review({...base,officialLines:{...officialLines,'99':null}}), /Official Form 1040 lines/)
  assert.throws(()=>review({...base,officialLines:{'17':null}}), /Official Form 1040 lines/)
  assert.throws(()=>review({...base,candidates:{...candidates,unexpected:0}}), /Invalid review fields/)
  assert.throws(()=>review({...base,candidates:{line17:null}}), /Invalid review fields/)
  assert.throws(()=>review({...base,filingReady:true}), /Only unapproved/)
  assert.throws(()=>review({...base,postingAuthorized:true}), /Only unapproved/)
  console.log('Stage 71: 13 restricted-view regression assertions passed')
} finally { fs.rmSync(tmp,{recursive:true,force:true}) }
