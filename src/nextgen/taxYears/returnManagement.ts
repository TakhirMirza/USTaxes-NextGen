/** Phase 55: fictional-only return management. Pure functions, no browser access. */
import { KINDS, diagnostics, previewLines, cents } from './unifiedReturnStore'
import type { DocKind, UnifiedReturn } from './unifiedReturnStore'
export type Action={id:string;group:'documents'|'fields'|'review'|'save';severity:'blocker'|'notice';title:string;detail:string;documentId?:string;kind?:DocKind}
export type ManagementSummary={documents:number;completeDocuments:number;missingFields:number;blockers:number;previewLines:number;unavailableLines:number;unsaved:boolean;actions:Action[];canFile:false}
export function manageReturn(book:UnifiedReturn,unsaved:boolean):ManagementSummary{
 const actions:Action[]=[]
 const kinds=Object.keys(KINDS) as DocKind[]
 for(const kind of kinds)if(!book.documents.some(d=>d.kind===kind))actions.push({id:`missing-${kind}`,group:'documents',severity:'notice',title:`No ${kind} source`,detail:'Add only if applicable to this fictional scenario.',kind})
 let completeDocuments=0,missingFields=0
 for(const d of book.documents){
  let complete=true
  for(const field of KINDS[d.kind])if(cents(d.fields[field]??'')===null){
   complete=false;missingFields++
   actions.push({id:`field-${d.id}-${field}`,group:'fields',severity:'blocker',title:`${d.label}: ${field}`,detail:'Missing or invalid fictional amount. Select the document to edit.',documentId:d.id})
  }
  if(complete)completeDocuments++
 }
 if(!book.documents.length)actions.unshift({id:'no-documents',group:'documents',severity:'blocker',title:'No source documents',detail:'Add a fictional W-2, 1099-INT, or Schedule C to begin.'})
 const lines=previewLines(book)
 for(const line of lines)if(line.status==='unavailable')actions.push({id:`line-${line.line}`,group:'review',severity:'notice',title:`${line.line}: unavailable`,detail:'A missing source or value prevents this preview. No zero will be substituted.'})
 if(unsaved)actions.push({id:'unsaved',group:'save',severity:'notice',title:'Unsaved fictional edits',detail:'Save the current year explicitly after reviewing changes.'})
 const otherBlockers=diagnostics(book).filter(x=>x.severity==='blocker').length
 return {documents:book.documents.length,completeDocuments,missingFields,blockers:otherBlockers,previewLines:lines.filter(x=>x.status==='preview').length,unavailableLines:lines.filter(x=>x.status==='unavailable').length,unsaved,actions,canFile:false}
}
export function actionCsv(year:string,summary:ManagementSummary){
 const q=(v:string)=>`"${v.replace(/"/g,'""')}"`
 return [['year','group','severity','action','detail','document_id','fictional_only'],...summary.actions.map(a=>[year,a.group,a.severity,a.title,a.detail,a.documentId??'','YES'])].map(row=>row.map(q).join(',')).join('\r\n')+'\r\n'
}
export function managementFixtures(){
 const blank:UnifiedReturn={schema:1,taxYear:'2025',revision:0,updatedAt:'',documents:[]}
 const doc={id:'w1',kind:'W2' as const,label:'Example W2',fields:{wages:'100.00',withholding:'10.00'}}
 const populated={...blank,documents:[doc]}
 const missing={...blank,documents:[{...doc,fields:{wages:''}}]}
 const a=manageReturn(blank,false),b=manageReturn(populated,false),c=manageReturn(missing,true)
 return [
 {name:'Empty return blocked',passed:a.blockers>0},
 {name:'No sources never marked filing ready',passed:a.canFile===false},
 {name:'Complete W2 counted',passed:b.completeDocuments===1},
 {name:'Incomplete W2 counted',passed:c.completeDocuments===0},
 {name:'Missing values produce field actions',passed:c.actions.some(x=>x.group==='fields'&&x.documentId==='w1')},
 {name:'Unsaved edits produce save action',passed:c.actions.some(x=>x.id==='unsaved')},
 {name:'Missing forms are optional notices',passed:b.actions.some(x=>x.id==='missing-1099-INT'&&x.severity==='notice')},
 {name:'Preview unavailable without source',passed:b.unavailableLines>0},
 {name:'No missing amount replaced with zero',passed:c.previewLines===0},
 {name:'CSV labels fictional data',passed:actionCsv('2025',b).includes('"YES"')},
 {name:'Document count accurate',passed:b.documents===1},
 {name:'No real filing permitted',passed:c.canFile===false},
 ]
}
