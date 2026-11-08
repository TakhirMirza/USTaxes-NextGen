/** 2025 draft Form 1040 cross-line integrity; never authorizes filing. */
export interface Integrated1040Input2025 {
 year:string; filingStatus:string;line1a:number|null;line2b:number|null;line9:number|null;line11a:number|null;line12e:number|null;line15:number|null;line16:number|null;withholdingCents:number|null;
 sourceMapped:boolean;scheduleReconciled:boolean;deductionReviewed:boolean;creditsAndOtherTaxesExcluded:boolean
}
export type IntegratedStatus='verified-arithmetic'|'difference'|'unverified'|'excluded'
export interface IntegratedRow {line:string;description:string;expectedCents:number|null;actualCents:number|null;status:IntegratedStatus;reason:string}
export interface IntegratedReport {rows:IntegratedRow[];passed:number;differences:number;unverified:number;excluded:number;filingEnabled:false}
const cents=(value:number|null):number|null=>value!==null&&Number.isFinite(value)&&Number.isSafeInteger(Math.round(value*100))&&value>=0?Math.round(value*100):null
const safeSum=(a:number|null,b:number|null):number|null=>a===null||b===null||!Number.isSafeInteger(a+b)?null:a+b
export function auditIntegrated1040(input:Integrated1040Input2025):IntegratedReport {
 const rows:IntegratedRow[]=[]
 const add=(line:string,description:string,expectedCents:number|null,actualCents:number|null,reason:string,enabled=true)=>{
  const status:IntegratedStatus=!enabled?'excluded':expectedCents===null||actualCents===null?'unverified':expectedCents===actualCents?'verified-arithmetic':'difference'
  rows.push({line,description,expectedCents,actualCents,status,reason})
 }
 const validYear=input.year==='2025'
 const sources=validYear&&input.sourceMapped&&input.scheduleReconciled
 add('9','Total income from limited wage and interest sources',sources?safeSum(cents(input.line1a),cents(input.line2b)):null,cents(input.line9),'Other income must be explicitly excluded',validYear)
 add('11a','Adjusted gross income',sources&&input.creditsAndOtherTaxesExcluded?cents(input.line9):null,cents(input.line11a),'Requires independent exclusion of Schedule 1 adjustments',validYear)
 const agi=cents(input.line11a),deduction=cents(input.line12e)
 add('15','Taxable income',sources&&input.deductionReviewed&&agi!==null&&deduction!==null?Math.max(0,agi-deduction):null,cents(input.line15),'Simplified calculation excludes other deductions and eligibility rules',validYear)
 add('16','Federal income tax',null,cents(input.line16),'Requires independent IRS Tax Table or worksheet verification; cannot be inferred from AGI',validYear)
 add('18','Tax before credits',input.creditsAndOtherTaxesExcluded?cents(input.line16):null,null,'Line 17 Schedule 2 tax not independently verified',validYear)
 add('21','Nonrefundable credits',null,null,'Schedule 3 and other credits are not established',validYear)
 add('24','Total tax',null,null,'Requires verified lines 18–23, including additional taxes',validYear)
 add('25a','Federal W-2 withholding',input.withholdingCents,null,'Document total available; Form 1040 line 25a is not independently posted',validYear)
 add('33','Total payments',null,null,'Refundable credits, estimated payments and withholding must be reconciled',validYear)
 add('34 / 37','Refund or amount owed',null,null,'Do not infer a refund or balance from incomplete return',validYear)
 return {rows,passed:rows.filter(r=>r.status==='verified-arithmetic').length,differences:rows.filter(r=>r.status==='difference').length,unverified:rows.filter(r=>r.status==='unverified').length,excluded:rows.filter(r=>r.status==='excluded').length,filingEnabled:false}
}
export function integrated1040Csv(report:IntegratedReport):string {
 const q=(s:string)=>'"'+s.replace(/"/g,'""')+'"'
 return ['line,description,status,expected_cents,actual_cents,reason',...report.rows.map(r=>[r.line,r.description,r.status,r.expectedCents===null?'':String(r.expectedCents),r.actualCents===null?'':String(r.actualCents),r.reason].map(q).join(','))].join('\r\n')+'\r\n'
}
export function integrated1040Fixtures():{name:string;pass:boolean}[]{
 const base:Integrated1040Input2025={year:'2025',filingStatus:'single',line1a:50000,line2b:100,line9:50100,line11a:50100,line12e:15750,line15:34350,line16:4000,withholdingCents:600000,sourceMapped:true,scheduleReconciled:true,deductionReviewed:true,creditsAndOtherTaxesExcluded:true}
 const row=(r:IntegratedReport,line:string)=>r.rows.find(x=>x.line===line)?.status
 return [
 {name:'Income sources match',pass:row(auditIntegrated1040(base),'9')==='verified-arithmetic'},
 {name:'Income discrepancy detected',pass:row(auditIntegrated1040({...base,line9:50000}),'9')==='difference'},
 {name:'AGI mismatch detected',pass:row(auditIntegrated1040({...base,line11a:50099}),'11a')==='difference'},
 {name:'Taxable income discrepancy detected',pass:row(auditIntegrated1040({...base,line15:34349}),'15')==='difference'},
 {name:'Unverified schedule blocks income',pass:row(auditIntegrated1040({...base,scheduleReconciled:false}),'9')==='unverified'},
 {name:'Deduction review required',pass:row(auditIntegrated1040({...base,deductionReviewed:false}),'15')==='unverified'},
 {name:'Missing AGI remains unknown',pass:row(auditIntegrated1040({...base,line11a:null}),'15')==='unverified'},
 {name:'Unsupported tax year excluded',pass:row(auditIntegrated1040({...base,year:'2026'}),'9')==='excluded'},
 {name:'Credits never assumed zero',pass:row(auditIntegrated1040(base),'21')==='unverified'},
 {name:'Refund never invented',pass:row(auditIntegrated1040(base),'34 / 37')==='unverified'},
 {name:'No filing from a passing audit',pass:auditIntegrated1040(base).filingEnabled===false},
 {name:'Invalid negative line blocked',pass:row(auditIntegrated1040({...base,line15:-1}),'15')==='unverified'}
 ]
}
