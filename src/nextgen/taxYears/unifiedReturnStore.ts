/** Phase 51: versioned, fictional-only unified tax document store. No tax-law computation. */
export type DocKind = 'W2' | '1099-INT' | 'SCHEDULE-C'
export type FieldKey = 'wages' | 'withholding' | 'interest' | 'grossReceipts' | 'expenses'
export type TaxDocument = { id:string; kind:DocKind; label:string; fields:Partial<Record<FieldKey,string>> }
export type UnifiedReturn = { schema:1; taxYear:string; revision:number; updatedAt:string; documents:TaxDocument[] }
export type Diagnostic = { severity:'blocker'|'warning'; documentId:string; message:string }
export type PreviewLine = { line:string; label:string; cents:bigint|null; status:'preview'|'unavailable'; sources:string[] }
export const KINDS:Record<DocKind,FieldKey[]> = {'W2':['wages','withholding'],'1099-INT':['interest'],'SCHEDULE-C':['grossReceipts','expenses']}
export const LABELS:Record<FieldKey,string> = {wages:'Wages (W-2 box 1)',withholding:'Federal withholding (W-2 box 2)',interest:'Taxable interest (1099-INT box 1)',grossReceipts:'Gross receipts (Schedule C)',expenses:'Expenses (Schedule C)'}
export const STORE_PREFIX='ustaxes-nextgen-fictional-return-v1:'
export const storeKey=(year:string)=>STORE_PREFIX+year
export const emptyReturn=(year:string):UnifiedReturn=>({schema:1,taxYear:year,revision:0,updatedAt:'',documents:[]})
export function cents(raw:string):bigint|null {
  if(!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(raw))return null
  const [whole,fraction='']=raw.split('.')
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))
}
export function money(value:bigint|null):string {if(value===null)return 'Unavailable';return `${value<0n?'-':''}$${(value<0n?-value:value)/100n}.${String((value<0n?-value:value)%100n).padStart(2,'0')}`}
export function validateReturn(obj:unknown,year:string):{value:UnifiedReturn|null;error:string|null}{
  try {
    if(!/^20\d{2}$/.test(year))throw Error('Unsupported year format')
    if(!obj||typeof obj!=='object')throw Error('Invalid file')
    const b=obj as Record<string,unknown>
    if(b.schema!==1||b.taxYear!==year||!Number.isSafeInteger(b.revision)||Number(b.revision)<0||!Array.isArray(b.documents)||b.documents.length>100)throw Error('Incompatible schema, tax year, revision, or document count')
    const ids=new Set<string>();const documents:TaxDocument[]=[]
    for(const item of b.documents){
      if(!item||typeof item!=='object')throw Error('Invalid document')
      const d=item as Record<string,unknown>
      if(typeof d.id!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(d.id)||ids.has(d.id))throw Error('Invalid or duplicate document ID')
      ids.add(d.id)
      if(d.kind!=='W2'&&d.kind!=='1099-INT'&&d.kind!=='SCHEDULE-C')throw Error('Unsupported document kind')
      if(typeof d.label!=='string'||d.label.length>80||!d.label.trim())throw Error('Invalid document label')
      if(!d.fields||typeof d.fields!=='object'||Array.isArray(d.fields))throw Error('Invalid fields')
      const fields=d.fields as Record<string,unknown>
      if(Object.keys(fields).some(k=>!KINDS[d.kind as DocKind].includes(k as FieldKey)))throw Error('Unexpected document field')
      for(const v of Object.values(fields))if(typeof v!=='string'||(v!==''&&cents(v)===null))throw Error('Invalid monetary value')
      documents.push({id:d.id,kind:d.kind as DocKind,label:d.label,fields:fields as TaxDocument['fields']})
    }
    return {value:{schema:1,taxYear:year,revision:Number(b.revision),updatedAt:typeof b.updatedAt==='string'?b.updatedAt.slice(0,40):'',documents},error:null}
  }catch(e){return {value:null,error:e instanceof Error?e.message:'Invalid data'}}
}
export function diagnostics(book:UnifiedReturn):Diagnostic[]{
  const out:Diagnostic[]=[]
  if(!book.documents.length)out.push({severity:'blocker',documentId:'',message:'No fictional source documents added.'})
  for(const doc of book.documents){
    for(const key of KINDS[doc.kind]){
      const raw=doc.fields[key]
      if(raw===undefined||raw==='')out.push({severity:'blocker',documentId:doc.id,message:`${doc.label}: ${LABELS[key]} missing`})
      else if(cents(raw)===null)out.push({severity:'blocker',documentId:doc.id,message:`${doc.label}: invalid ${LABELS[key]}`})
    }
    if(doc.kind==='SCHEDULE-C' && cents(doc.fields.grossReceipts??'')!==null && cents(doc.fields.expenses??'')!==null && (cents(doc.fields.expenses??'') as bigint)>(cents(doc.fields.grossReceipts??'') as bigint))out.push({severity:'warning',documentId:doc.id,message:`${doc.label}: expenses exceed receipts; review the fictional inputs.`})
  }
  return out
}
export function previewLines(book:UnifiedReturn):PreviewLine[]{
  const specs:{line:string;label:string;kind:DocKind;key:FieldKey}[]=[
    {line:'1a',label:'W-2 wages',kind:'W2',key:'wages'},
    {line:'2b',label:'Taxable interest (1099-INT box 1 only)',kind:'1099-INT',key:'interest'},
    {line:'25a',label:'W-2 federal withholding',kind:'W2',key:'withholding'},
    {line:'Schedule C (preview)',label:'Gross receipts minus expenses',kind:'SCHEDULE-C',key:'grossReceipts'}]
  return specs.map(spec=>{
    const docs=book.documents.filter(d=>d.kind===spec.kind)
    if(!docs.length)return {line:spec.line,label:spec.label,cents:null,status:'unavailable',sources:[]}
    let total=0n
    for(const d of docs){
      const a=cents(d.fields[spec.key]??'')
      if(a===null)return {line:spec.line,label:spec.label,cents:null,status:'unavailable',sources:docs.map(x=>x.label)}
      if(spec.kind==='SCHEDULE-C'){
        const expense=cents(d.fields.expenses??'')
        if(expense===null)return {line:spec.line,label:spec.label,cents:null,status:'unavailable',sources:docs.map(x=>x.label)}
        total+=a-expense
      }else total+=a
    }
    return {line:spec.line,label:spec.label,cents:total,status:'preview',sources:docs.map(d=>d.label)}
  })
}
export function exportCsv(book:UnifiedReturn):string {
  const q=(s:string)=>`"${s.replace(/"/g,'""')}"`
  const rows=[['tax_year','document_id','kind','label','field','fictional_amount','status']]
  for(const d of book.documents)for(const k of KINDS[d.kind])rows.push([book.taxYear,d.id,d.kind,d.label,k,d.fields[k]??'','FICTIONAL_ONLY'])
  return rows.map(row=>row.map(q).join(',')).join('\r\n')+'\r\n'
}
export function fixtures():{name:string;passed:boolean}[]{
  const b=emptyReturn('2025');const d:TaxDocument={id:'test',kind:'W2',label:'Fictional W2',fields:{wages:'123.45',withholding:'12.34'}}
  const populated={...b,documents:[d]}
  return [
    {name:'Decimal cents exact',passed:cents('123.45')===12345n},
    {name:'Reject excessive decimal precision',passed:cents('12.345')===null},
    {name:'Reject negative source amounts',passed:cents('-1')===null},
    {name:'Versioned round-trip',passed:validateReturn(JSON.parse(JSON.stringify(populated)),'2025').value?.documents.length===1},
    {name:'Tax-year mismatch rejected',passed:validateReturn(populated,'2026').value===null},
    {name:'Duplicate source IDs rejected',passed:validateReturn({...populated,documents:[d,d]},'2025').value===null},
    {name:'Unknown field rejected',passed:validateReturn({...populated,documents:[{...d,fields:{wages:'1',unexpected:'2'}}]},'2025').value===null},
    {name:'Missing inputs block preview',passed:previewLines({...b,documents:[{...d,fields:{wages:''}}]})[0].cents===null},
    {name:'W2 mapping to 1040 line 1a',passed:previewLines(populated)[0].cents===12345n},
    {name:'Cross-document W2 sum',passed:previewLines({...b,documents:[d,{...d,id:'second'}]})[0].cents===24690n},
    {name:'No source does not silently equal zero',passed:previewLines(b)[0].cents===null},
    {name:'CSV labels fictional values',passed:exportCsv(populated).includes('FICTIONAL_ONLY')},
  ]
}
