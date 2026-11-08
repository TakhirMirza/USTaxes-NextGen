/** Phase 52: fictional source-to-form calculation bridge. No tax law calculations. */
import { cents, diagnostics, previewLines } from './unifiedReturnStore'
import type { UnifiedReturn, DocKind, FieldKey } from './unifiedReturnStore'
export type BridgeState = 'ready'|'blocked'|'unsupported'
export type BridgeNode = { id:string; target:string; label:string; state:BridgeState; amount:string|null; sourceIds:string[]; dependencies:string[]; explanation:string }
export type BridgeReport = { taxYear:string; revision:number; nodes:BridgeNode[]; blockers:string[]; status:'blocked'|'diagnostic-ready'; sourceCount:number }
const format=(v:bigint)=>`${v<0n?'-':''}${(v<0n?-v:v)/100n}.${String((v<0n?-v:v)%100n).padStart(2,'0')}`
function sourceNode(book:UnifiedReturn,kind:DocKind,key:FieldKey,id:string,target:string,label:string):BridgeNode{
  const docs=book.documents.filter(d=>d.kind===kind)
  const dependencies=docs.map(d=>d.id+':'+key)
  if(!docs.length)return {id,target,label,state:'blocked',amount:null,sourceIds:[],dependencies,explanation:`No ${kind} source document`}
  let sum=0n
  for(const d of docs){const amount=cents(d.fields[key]??'');if(amount===null)return {id,target,label,state:'blocked',amount:null,sourceIds:docs.map(x=>x.id),dependencies,explanation:`Missing or invalid ${key} in ${d.label}`};sum+=amount}
  return {id,target,label,state:'ready',amount:format(sum),sourceIds:docs.map(d=>d.id),dependencies,explanation:'Fictional source aggregation only; no IRS eligibility or tax treatment validated'}
}
export function buildBridge(book:UnifiedReturn):BridgeReport{
  const wages=sourceNode(book,'W2','wages','wages','1040:1a','W-2 wages')
  const interest=sourceNode(book,'1099-INT','interest','interest','1040:2b','1099-INT box 1 interest (partial)')
  const withholding=sourceNode(book,'W2','withholding','withholding','1040:25a','W-2 withholding')
  const scheduleDocs=book.documents.filter(d=>d.kind==='SCHEDULE-C')
  let schedule:BridgeNode={id:'scheduleC',target:'Schedule C:31 preview',label:'Schedule C arithmetic net',state:'blocked',amount:null,sourceIds:scheduleDocs.map(d=>d.id),dependencies:scheduleDocs.flatMap(d=>[d.id+':grossReceipts',d.id+':expenses']),explanation:'Schedule C source missing or incomplete'}
  if(scheduleDocs.length){let total=0n;let valid=true;for(const d of scheduleDocs){const a=cents(d.fields.grossReceipts??''),b=cents(d.fields.expenses??'');if(a===null||b===null){valid=false;break}total+=a-b}if(valid)schedule={...schedule,state:'ready',amount:format(total),explanation:'Arithmetic preview only; Schedule C rules and adjustments not implemented'}}
  const unsupported=(id:string,target:string,label:string,dependencies:string[]):BridgeNode=>({id,target,label,state:'unsupported',amount:null,sourceIds:[],dependencies,explanation:'Official tax-year rules and all required inputs are not validated; no value is inferred'})
  const nodes=[wages,interest,withholding,schedule,
    unsupported('schedule1','1040:8','Schedule 1 additional income',['scheduleC']),
    unsupported('agi','1040:11','Adjusted gross income',['wages','interest','schedule1']),
    unsupported('deductions','1040:12','Deductions',['agi']),
    unsupported('taxable','1040:15','Taxable income',['agi','deductions']),
    unsupported('tax','1040:24','Total tax',['taxable']),
    unsupported('payments','1040:33','Total payments',['withholding']),
    unsupported('refund','1040:34','Refund',['tax','payments'])]
  const blockers=[...diagnostics(book).filter(x=>x.severity==='blocker').map(x=>x.message),...nodes.filter(x=>x.state==='blocked').map(x=>`${x.target}: ${x.explanation}`),...nodes.filter(x=>x.state==='unsupported').map(x=>`${x.target}: official computation unavailable`)]
  return {taxYear:book.taxYear,revision:book.revision,nodes,blockers,status: blockers.length?'blocked':'diagnostic-ready',sourceCount:book.documents.length}
}
export function bridgeCsv(report:BridgeReport):string{
  const q=(v:string)=>`"${v.replace(/"/g,'""')}"`
  return [['tax_year','revision','target','state','fictional_amount','source_ids','dependencies','explanation'],...report.nodes.map(n=>[report.taxYear,String(report.revision),n.target,n.state,n.amount??'',n.sourceIds.join(';'),n.dependencies.join(';'),n.explanation])].map(r=>r.map(q).join(',')).join('\r\n')+'\r\n'
}
export function bridgeFixtures():{name:string;passed:boolean}[]{
 const base:UnifiedReturn={schema:1,taxYear:'2025',revision:2,updatedAt:'',documents:[{id:'w1',kind:'W2',label:'Example W2',fields:{wages:'1200.25',withholding:'100.20'}},{id:'w2',kind:'W2',label:'Example W2 second',fields:{wages:'300.05',withholding:'20.10'}},{id:'i1',kind:'1099-INT',label:'Example interest',fields:{interest:'8.01'}},{id:'c1',kind:'SCHEDULE-C',label:'Example C',fields:{grossReceipts:'50.00',expenses:'70.00'}}]}
 const r=buildBridge(base);const find=(id:string)=>r.nodes.find(n=>n.id===id)
 const empty=buildBridge({...base,documents:[]});const missing=buildBridge({...base,documents:[{...base.documents[0],fields:{wages:'1.00'}}]})
 const legacy=previewLines(base)
 return [
  {name:'Two W2 amounts summed in exact cents',passed:find('wages')?.amount==='1500.30'},
  {name:'Withholding summed in exact cents',passed:find('withholding')?.amount==='120.30'},
  {name:'Interest isolated from wages',passed:find('interest')?.amount==='8.01'},
  {name:'Negative Schedule C arithmetic retained',passed:find('scheduleC')?.amount==='-20.00'},
  {name:'Missing W2 withholding blocks value',passed:missing.nodes.find(n=>n.id==='withholding')?.state==='blocked'},
  {name:'No documents never yields zero',passed:empty.nodes.find(n=>n.id==='wages')?.amount===null},
  {name:'Tax calculation remains unsupported',passed:find('tax')?.state==='unsupported'&&find('tax')?.amount===null},
  {name:'Refund remains unsupported',passed:find('refund')?.amount===null},
  {name:'All nodes have target and explanation',passed:r.nodes.every(n=>!!n.target&&!!n.explanation)},
  {name:'Document lineage is preserved',passed:find('wages')?.sourceIds.join(',')==='w1,w2'},
  {name:'Legacy preview wages match',passed:legacy.find(n=>n.line==='1a')?.cents===150030n},
  {name:'Legacy preview interest match',passed:legacy.find(n=>n.line==='2b')?.cents===801n},
  {name:'Report year and revision match',passed:r.taxYear==='2025'&&r.revision===2},
  {name:'CSV identifies unsupported states',passed:bridgeCsv(r).includes('unsupported')},
  {name:'Report remains blocked until rules validated',passed:r.status==='blocked'},
 ]
}
