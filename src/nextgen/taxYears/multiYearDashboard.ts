/** Phase 54: read-only overview of fictional local tax-year returns. */
import { diagnostics, emptyReturn, previewLines, storeKey, validateReturn } from './unifiedReturnStore'
import type { UnifiedReturn } from './unifiedReturnStore'
export const DASHBOARD_YEARS=['2025','2026','2027','2028'] as const
export type YearSummary={year:string;exists:boolean;valid:boolean;revision:number;documents:number;blockers:number;warnings:number;previewLines:number;unavailableLines:number;updatedAt:string;status:'empty'|'invalid'|'review-needed'|'fictional-preview';message:string}
export function summarizeYear(year:string,raw:string|null):YearSummary{
 const base={year,exists:raw!==null,valid:false,revision:0,documents:0,blockers:0,warnings:0,previewLines:0,unavailableLines:0,updatedAt:'',status:'empty' as YearSummary['status'],message:'No fictional return stored'}
 if(raw===null)return base
 let book:UnifiedReturn
 try{const parsed=validateReturn(JSON.parse(raw),year);if(!parsed.value)return {...base,status:'invalid',message:parsed.error||'Invalid stored return'};book=parsed.value}catch{return {...base,status:'invalid',message:'Unreadable JSON'}}
 const issues=diagnostics(book),lines=previewLines(book),blockers=issues.filter(i=>i.severity==='blocker').length,warnings=issues.filter(i=>i.severity==='warning').length
 return {...base,valid:true,revision:book.revision,documents:book.documents.length,blockers,warnings,previewLines:lines.filter(l=>l.status==='preview').length,unavailableLines:lines.filter(l=>l.status==='unavailable').length,updatedAt:book.updatedAt,status:blockers?'review-needed':'fictional-preview',message:blockers?`${blockers} source issue(s) require review`:'Fictional source preview only — not ready to file'}
}
export function summarizeYears(get:(key:string)=>string|null):YearSummary[]{return DASHBOARD_YEARS.map(year=>summarizeYear(year,get(storeKey(year))))}
export function dashboardCsv(rows:YearSummary[]):string{
 const quote=(s:string)=>`"${s.replace(/"/g,'""')}"`
 const data=[['year','status','documents','revision','blockers','warnings','preview_lines','unavailable_lines','last_updated','fictional_only'],...rows.map(r=>[r.year,r.status,String(r.documents),String(r.revision),String(r.blockers),String(r.warnings),String(r.previewLines),String(r.unavailableLines),r.updatedAt,'YES'])]
 return data.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n'
}
export function dashboardFixtures(){
 const blank=emptyReturn('2025');const populated:UnifiedReturn={...blank,revision:3,documents:[{id:'a',kind:'W2',label:'Example',fields:{wages:'100.00',withholding:'10.00'}}]}
 const ok=summarizeYear('2025',JSON.stringify(populated));const empty=summarizeYear('2025',null);const invalid=summarizeYear('2025','not-json');const wrong=summarizeYear('2026',JSON.stringify(populated))
 return [
  {name:'Missing year is empty',passed:empty.status==='empty'&&!empty.exists},
  {name:'Malformed JSON is rejected',passed:invalid.status==='invalid'},
  {name:'Wrong tax year is rejected',passed:wrong.status==='invalid'},
  {name:'Document count preserved',passed:ok.documents===1},
  {name:'Revision preserved',passed:ok.revision===3},
  {name:'Valid fictional data never marked filing-ready',passed:ok.status==='fictional-preview'},
  {name:'Missing source values are blockers',passed:summarizeYear('2025',JSON.stringify({...populated,documents:[{...populated.documents[0],fields:{wages:''}}]})).blockers>0},
  {name:'All four years are present',passed:summarizeYears(()=>null).length===4},
  {name:'CSV declares fictional data',passed:dashboardCsv([ok]).includes('"YES"')},
  {name:'CSV includes 2025',passed:dashboardCsv([ok]).includes('"2025"')},
 ]
}
