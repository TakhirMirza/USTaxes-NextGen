'use strict'
const fs=require('fs');const path=require('path');const https=require('https');const crypto=require('crypto')
const {BASE,documents}=require('./catalog')
function plan(year){if(!Number.isInteger(year)||year<2020||year>2100)throw new Error('Invalid year');return {taxYear:year,createdAt:new Date().toISOString(),notice:'Current IRS URLs may not be tax-year-specific; review each PDF tax year before using it.',documents:documents.map(d=>({...d,url:BASE+d.path}))}}
function fetchBuffer(url,redirects=0){return new Promise((resolve,reject)=>{
 if(redirects>3)return reject(new Error('Too many redirects'))
 const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='www.irs.gov')return reject(new Error('Unapproved IRS host'))
 https.get(u,{timeout:20000,headers:{'User-Agent':'USTaxes-Research/1.0'}},res=>{
  if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();return fetchBuffer(new URL(res.headers.location,u).toString(),redirects+1).then(resolve,reject)}
  if(res.statusCode!==200){res.resume();return reject(new Error(`HTTP ${res.statusCode}`))}
  let parts=[],size=0;res.on('data',chunk=>{size+=chunk.length;if(size>15*1024*1024){res.destroy(new Error('File too large'));return}parts.push(chunk)});res.on('end',()=>resolve(Buffer.concat(parts)));res.on('error',reject)
 }).on('timeout',function(){this.destroy(new Error('Timeout'))}).on('error',reject)
})}
async function download(year,dir){const p=plan(year);const target=path.resolve(dir,String(year));fs.mkdirSync(target,{recursive:true});const result=[]
 for(const d of p.documents){const body=await fetchBuffer(d.url);if(body.slice(0,4).toString()!=='%PDF')throw new Error(`${d.id} is not PDF`);const filename=d.id+'.pdf';fs.writeFileSync(path.join(target,filename),body);result.push({...d,filename,sha256:crypto.createHash('sha256').update(body).digest('hex'),bytes:body.length,downloadedAt:new Date().toISOString(),verifiedTaxYear:false})}
 const manifest={...p,documents:result,reviewStatus:'pending',approvedForFiling:false};fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest
}
module.exports={plan,download,fetchBuffer}
