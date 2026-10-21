'use strict'
const path=require('path');const {plan,download}=require('../irs/sync')
async function main(){const args=process.argv.slice(2);const at=args.indexOf('--year');const year=Number(args[at+1]);if(at<0||!Number.isInteger(year))throw new Error('Usage: node platform/cli/irs-update.js --year 2026 --dry-run|--download')
 if(args.includes('--download')){const result=await download(year,path.resolve(__dirname,'../../irs-cache'));console.log(JSON.stringify(result,null,2))}
 else console.log(JSON.stringify(plan(year),null,2))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
