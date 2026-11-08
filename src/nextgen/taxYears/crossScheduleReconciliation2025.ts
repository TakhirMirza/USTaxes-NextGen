/** 2025 development-only reconciliation. No tax advice, filing, or authoritative posting. */
export type LineKey2025 = 'c31'|'se12'|'se13'|'s1l3'|'s1otherIncome'|'s1l10'|'s1l15'|'s1otherAdjustments'|'s1l26'|'s2l4'|'s2otherTaxes'|'s2l21'|'f1040l8'|'f1040l10'|'f1040l23'
export type ReconciliationInput2025 = Partial<Record<LineKey2025,string>>
export type ReconciliationFinding2025 = {code:string;severity:'blocker'|'review';message:string;lines:LineKey2025[]}
export type ReconciliationResult2025 = {status:'blocked';findings:ReconciliationFinding2025[];lines:{key:LineKey2025;label:string;valueCents:number|null}[];checked:number;matched:number;missing:number}
export const RECONCILIATION_LINES_2025: {key:LineKey2025;label:string;group:string}[] = [
 {key:'c31',label:'Schedule C line 31 — net profit/loss',group:'Business'},
 {key:'se12',label:'Schedule SE line 12 — self-employment tax',group:'Self-employment'},
 {key:'se13',label:'Schedule SE line 13 — deductible portion',group:'Self-employment'},
 {key:'s1l3',label:'Schedule 1 line 3 — business income/loss',group:'Schedule 1'},
 {key:'s1otherIncome',label:'Other Schedule 1 additional income (aggregate)',group:'Schedule 1'},
 {key:'s1l10',label:'Schedule 1 line 10 — additional income total',group:'Schedule 1'},
 {key:'s1l15',label:'Schedule 1 line 15 — deductible part of SE tax',group:'Schedule 1'},
 {key:'s1otherAdjustments',label:'Other Schedule 1 adjustments (aggregate)',group:'Schedule 1'},
 {key:'s1l26',label:'Schedule 1 line 26 — adjustments total',group:'Schedule 1'},
 {key:'s2l4',label:'Schedule 2 line 4 — self-employment tax',group:'Schedule 2'},
 {key:'s2otherTaxes',label:'Other Schedule 2 taxes (aggregate)',group:'Schedule 2'},
 {key:'s2l21',label:'Schedule 2 line 21 — other taxes total',group:'Schedule 2'},
 {key:'f1040l8',label:'Form 1040 line 8 — additional income',group:'Form 1040'},
 {key:'f1040l10',label:'Form 1040 line 10 — adjustments',group:'Form 1040'},
 {key:'f1040l23',label:'Form 1040 line 23 — other taxes',group:'Form 1040'}
]
export function parseMoney2025(raw:unknown):number|null {
 if(typeof raw!=='string'||raw.trim()==='')return null
 const clean=raw.trim().replace(/,/g,'')
 if(!/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(clean))return null
 const neg=clean.startsWith('-');const digits=neg?clean.slice(1):clean
 const [whole,frac='']=digits.split('.')
 const cents=Number(whole)*100+Number(frac.padEnd(2,'0'))
 return Number.isSafeInteger(cents)?(neg?-cents:cents):null
}
export function reconcileCrossSchedules2025(input:ReconciliationInput2025):ReconciliationResult2025 {
 const values={} as Record<LineKey2025,number|null>
 const findings:ReconciliationFinding2025[]=[]
 const add=(code:string,severity:'blocker'|'review',message:string,lines:LineKey2025[])=>findings.push({code,severity,message,lines})
 for(const {key,label} of RECONCILIATION_LINES_2025){
  const raw=input[key];values[key]=parseMoney2025(raw)
  if(values[key]===null)add(`MISSING_${key}`,'blocker',`${label}: enter an amount (including explicit 0) in the fictional scenario.`,[key])
 }
 let checked=0,matched=0
 const eq=(code:string,a:LineKey2025,b:LineKey2025)=>{
  if(values[a]===null||values[b]===null)return
  checked++;if(values[a]===values[b])matched++;else add(code,'blocker',`${a} (${values[a]} cents) does not equal ${b} (${values[b]} cents).`,[a,b])
 }
 const sum=(code:string,total:LineKey2025,parts:LineKey2025[])=>{
  if(values[total]===null||parts.some(k=>values[k]===null))return
  checked++;const expected=parts.reduce((acc,k)=>acc+(values[k] as number),0)
  if(Number.isSafeInteger(expected)&&values[total]===expected)matched++
  else add(code,'blocker',`${total} does not equal the sum of ${parts.join(' + ')}.`,[total,...parts])
 }
 eq('C_TO_S1','c31','s1l3');eq('SE_TO_S2','se12','s2l4');eq('SE_TO_S1','se13','s1l15')
 sum('S1_INCOME_TOTAL','s1l10',['s1l3','s1otherIncome'])
 sum('S1_ADJUSTMENT_TOTAL','s1l26',['s1l15','s1otherAdjustments'])
 sum('S2_TAX_TOTAL','s2l21',['s2l4','s2otherTaxes'])
 eq('S1_TO_1040_INCOME','s1l10','f1040l8');eq('S1_TO_1040_ADJUSTMENTS','s1l26','f1040l10');eq('S2_TO_1040_TAX','s2l21','f1040l23')
 add('NON_POSTING','blocker','This is a manual-source arithmetic audit only. It does not verify IRS eligibility, other forms, tax-year instructions, rounding, or permit filing.',[])
 return {status:'blocked',findings,lines:RECONCILIATION_LINES_2025.map(({key,label})=>({key,label,valueCents:values[key]})),checked,matched,missing:RECONCILIATION_LINES_2025.filter(({key})=>values[key]===null).length}
}
function csvCell(value:string){return '"'+(/^[=+@\-\t\r]/.test(value)?"'":'')+value.replace(/"/g,'""')+'"'}
export function reconciliationReportCsv2025(result:ReconciliationResult2025):string{
 const rows=[['Type','Code/Line','Description','Value USD','Severity'],...result.lines.map(x=>['Line',x.key,x.label,x.valueCents===null?'missing':(x.valueCents/100).toFixed(2),'']),...result.findings.map(x=>['Finding',x.code,x.message,'',x.severity])]
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}
