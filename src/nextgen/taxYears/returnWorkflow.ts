/** Phase 53 — fictional-only workflow. Does not determine filing eligibility. */
import { diagnostics, KINDS, cents } from './unifiedReturnStore'
import type { UnifiedReturn, DocKind } from './unifiedReturnStore'
import { buildBridge } from './unifiedCalculationBridge'
export type WorkflowStep = {id:string;title:string;state:'complete'|'needs-attention'|'not-implemented';detail:string;documentIds:string[];action:string}
export type WorkflowReport = {steps:WorkflowStep[];sourceIssues:{documentId:string;message:string;severity:string}[];readyForFiling:false;reviewedSources:number;totalSources:number;unavailableTargets:number;year:string;revision:number}
const sections:{kind:DocKind;id:string;title:string}[]=[{kind:'W2',id:'w2',title:'W-2 wages and withholding'},{kind:'1099-INT',id:'interest',title:'1099-INT interest'},{kind:'SCHEDULE-C',id:'scheduleC',title:'Schedule C business income'}]
export function buildWorkflow(book:UnifiedReturn):WorkflowReport{
 const issues=diagnostics(book);const bridge=buildBridge(book)
 const steps:WorkflowStep[]=sections.map(s=>{
  const docs=book.documents.filter(d=>d.kind===s.kind)
  const incomplete=docs.filter(d=>KINDS[s.kind].some(key=>cents(d.fields[key]??'')===null))
  return {id:s.id,title:s.title,state:docs.length&&incomplete.length===0?'complete':'needs-attention',detail:!docs.length?'No fictional source entered; confirm whether this document type applies.':incomplete.length?`${incomplete.length} incomplete source(s) of ${docs.length}`:`${docs.length} fictional source(s) have all supported fields`,documentIds:docs.map(d=>d.id),action:!docs.length?'Add a fictional source if applicable':incomplete.length?'Open a source and complete missing amounts':'Review source and calculation lineage'}
 })
 steps.push({id:'calculations',title:'Cross-form calculation review',state:bridge.nodes.some(n=>n.state==='blocked')?'needs-attention':'complete',detail:`${bridge.nodes.filter(n=>n.state==='ready').length} preview values; ${bridge.nodes.filter(n=>n.state==='blocked').length} blocked`,documentIds:[],action:'Inspect Calculation Bridge below'})
 steps.push({id:'official',title:'Official Form 1040 and filing',state:'not-implemented',detail:'IRS tax-year rules, eligibility, deductions, tax, refund, PDF and e-file are not certified or implemented.',documentIds:[],action:'No filing action available in this development preview'})
 return {steps,sourceIssues:issues,readyForFiling:false,reviewedSources:book.documents.filter(d=>KINDS[d.kind].every(key=>cents(d.fields[key]??'')!==null)).length,totalSources:book.documents.length,unavailableTargets:bridge.nodes.filter(n=>n.state!=='ready').length,year:book.taxYear,revision:book.revision}
}
export function workflowCsv(r:WorkflowReport):string{const quote=(s:string)=>`"${s.replace(/"/g,'""')}"`;return [['tax_year','revision','step','state','detail','document_ids','action'],...r.steps.map(s=>[r.year,String(r.revision),s.title,s.state,s.detail,s.documentIds.join(';'),s.action])].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n'}
export function workflowFixtures(){
 const b:UnifiedReturn={schema:1,taxYear:'2025',revision:1,updatedAt:'',documents:[{id:'w1',kind:'W2',label:'Example',fields:{wages:'100.00',withholding:'20.00'}}]}
 const r=buildWorkflow(b),empty=buildWorkflow({...b,documents:[]}),bad=buildWorkflow({...b,documents:[{...b.documents[0],fields:{wages:'100.00'}}]})
 return [
  {name:'Valid W2 step is complete',passed:r.steps[0].state==='complete'},
  {name:'Missing source does not count as complete',passed:empty.steps[0].state==='needs-attention'},
  {name:'Incomplete W2 is flagged',passed:bad.steps[0].state==='needs-attention'},
  {name:'Incomplete W2 navigates to its source',passed:bad.steps[0].documentIds[0]==='w1'},
  {name:'Empty year has no reviewed sources',passed:empty.reviewedSources===0},
  {name:'Valid W2 counted once',passed:r.reviewedSources===1},
  {name:'Official filing always unavailable',passed:r.readyForFiling===false&&r.steps[r.steps.length - 1]?.state==='not-implemented'},
  {name:'Year preserved',passed:r.year==='2025'},
  {name:'Revision preserved',passed:r.revision===1},
  {name:'Unimplemented targets remain visible',passed:r.unavailableTargets>0},
  {name:'CSV includes tax year',passed:workflowCsv(r).includes('2025')},
  {name:'CSV quotes every field',passed:workflowCsv(r).startsWith('"tax_year"')},
 ]
}
