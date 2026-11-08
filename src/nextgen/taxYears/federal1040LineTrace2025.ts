/** Source-to-line arithmetic checks for fictional 2025 drafts. No tax eligibility determination. */
export type TraceStatus = 'match'|'mismatch'|'unverified'|'not-applicable'
export interface TraceInput2025 {
 year:string; wagesSelected:boolean; wageRows:readonly {wages:string;withholding:string}[];
 interestSelected:boolean;interest:string;
 line1a:number|null;line2b:number|null;line9:number|null;line11a:number|null;
 line12e:number|null;line15:number|null;line16:number|null;
 sourceMapped:boolean;taxVerified:boolean
}
export interface TraceRow2025 {line:string;origin:string;expected:number|null;actual:number|null;status:TraceStatus;note:string}
export interface TraceReport2025 {rows:TraceRow2025[];matches:number;mismatches:number;unverified:number;filingEnabled:false}
const parseDollars=(raw:string):number|null=>{
 if(!/^\d+(?:\.\d{1,2})?$/.test(raw.trim()))return null
 const cents=Math.round(Number(raw)*100)
 return Number.isSafeInteger(cents)&&cents>=0?cents:null
}
const toCents=(dollars:number|null):number|null=>dollars!==null&&Number.isFinite(dollars)&&Number.isSafeInteger(Math.round(dollars*100))?Math.round(dollars*100):null
const sum=(values:readonly (number|null)[]):number|null=>values.every(v=>v!==null)?values.reduce<number>((a,v)=>a+(v as number),0):null
export function traceFederal1040Lines2025(input:TraceInput2025):TraceReport2025 {
 const rows:TraceRow2025[]=[]
 const push=(line:string,origin:string,expected:number|null,actualDollars:number|null,note:string,eligible=true)=>{
  const actual=toCents(actualDollars)
  const status:TraceStatus=!eligible?'not-applicable':expected===null||actual===null?'unverified':expected===actual?'match':'mismatch'
  rows.push({line,origin,expected,actual,status,note})
 }
 const wages=input.wagesSelected?sum(input.wageRows.map(w=>parseDollars(w.wages))):0
 const withholding=input.wagesSelected?sum(input.wageRows.map(w=>parseDollars(w.withholding))):0
 const interest=input.interestSelected?parseDollars(input.interest):0
 const validYear=input.year==='2025'
 push('1a','W-2 Box 1 → Form 1040',validYear?wages:null,input.line1a,'Wage document total; exact cents')
 push('2b','1099-INT Box 1 → Form 1040',validYear?interest:null,input.line2b,'Taxable interest; exact cents')
 push('9','Wages + interest → total income',validYear?sum([wages,interest]):null,input.line9,'Only W-2 and 1099-INT sources; other income must be independently excluded',input.sourceMapped)
 push('11a','Total income → AGI',validYear&&input.sourceMapped?toCents(input.line9):null,input.line11a,'Valid only for explicitly simplified no-adjustment scenario',input.sourceMapped)
 const taxable=input.line11a!==null&&input.line12e!==null?Math.max(0,Math.round((input.line11a-input.line12e)*100)):null
 push('15','AGI minus deduction → taxable income',validYear?taxable:null,input.line15,'Does not cover other adjustments or deductions',input.sourceMapped)
 push('16','Verified tax worksheet → tax',validYear&&input.taxVerified?toCents(input.line16):null,input.line16,'A worksheet result is not independently validated against IRS tax tables',input.taxVerified)
 push('25a','W-2 Box 2 → withholding',validYear?withholding:null,null,'The mapped engine does not expose a verified line 25a here; do not assume zero')
 return {rows,matches:rows.filter(r=>r.status==='match').length,mismatches:rows.filter(r=>r.status==='mismatch').length,unverified:rows.filter(r=>r.status==='unverified').length,filingEnabled:false}
}
export function traceFederal1040Csv2025(report:TraceReport2025):string{
 const quote=(s:string)=>'"'+s.replace(/"/g,'""')+'"'
 return 'line,source,status,expected_cents,actual_cents,note\r\n'+report.rows.map(r=>[r.line,r.origin,r.status,r.expected===null?'':String(r.expected),r.actual===null?'':String(r.actual),r.note].map(quote).join(',')).join('\r\n')+'\r\n'
}
export function runLineTraceFixtures2025():{id:string;passed:boolean}[]{
 const sample:TraceInput2025={year:'2025',wagesSelected:true,wageRows:[{wages:'50000.00',withholding:'6000.00'}],interestSelected:true,interest:'100.00',line1a:50000,line2b:100,line9:50100,line11a:50100,line12e:15750,line15:34350,line16:4000,sourceMapped:true,taxVerified:true}
 const cases:[string,TraceInput2025,(r:TraceReport2025)=>boolean][]=[
 ['balanced',sample,r=>r.mismatches===0&&r.rows.find(x=>x.line==='1a')?.status==='match'],
 ['wage-drift',{...sample,line1a:49999},r=>r.rows.find(x=>x.line==='1a')?.status==='mismatch'],
 ['missing-source',{...sample,wageRows:[{wages:'',withholding:'6000'}]},r=>r.rows.find(x=>x.line==='1a')?.status==='unverified'],
 ['year-guard',{...sample,year:'2026'},r=>r.rows.find(x=>x.line==='1a')?.status==='unverified'],
 ['income-drift',{...sample,line9:50000},r=>r.rows.find(x=>x.line==='9')?.status==='mismatch'],
 ['tax-unverified',{...sample,taxVerified:false,line16:null},r=>r.rows.find(x=>x.line==='16')?.status==='not-applicable']
 ]
 return cases.map(([id,input,check])=>({id,passed:Boolean(check(traceFederal1040Lines2025(input)))}))
}
