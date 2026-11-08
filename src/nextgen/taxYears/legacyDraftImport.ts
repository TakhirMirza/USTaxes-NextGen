/** Phase 61: explicit, one-way fictional legacy W-2/1099-INT import. */
import type { DraftWorkspace } from '../navigation/draftWorkspace'
import type { UnifiedReturn, TaxDocument } from './unifiedReturnStore'
import { validateReturn } from './unifiedReturnStore'

export type LegacyImport = { value: UnifiedReturn | null; error: string | null; imported: number }
export function previewLegacyImport(source: DraftWorkspace, current: UnifiedReturn): LegacyImport {
  if (source.year !== current.taxYear) return {value:null,error:'Tax-year mismatch. Switch to the matching year before importing.',imported:0}
  const supported = ['W-2 wages','1099-INT interest']
  const unsupported = source.incomeKinds.filter(k => !supported.includes(k))
  if (unsupported.length) return {value:null,error:`Unsupported income categories: ${unsupported.join(', ')}. No data changed.`,imported:0}
  const docs: TaxDocument[] = []
  if (source.incomeKinds.includes('W-2 wages')) {
    for (const w of source.wages) {
      docs.push({id:`legacy_w2_${w.id}`,kind:'W2',label:(w.employer.trim() || `Fictional W-2 ${w.id}`).slice(0,80),fields:{wages:w.wages,withholding:w.withholding}})
    }
  }
  if (source.incomeKinds.includes('1099-INT interest')) {
    docs.push({id:'legacy_1099_int_1',kind:'1099-INT',label:(source.payer.trim() || 'Fictional 1099-INT').slice(0,80),fields:{interest:source.interest}})
  }
  // Keep Schedule C and all other documents; replace only previous legacy imports.
  const retained=current.documents.filter(d=>!d.id.startsWith('legacy_w2_')&&d.id!=='legacy_1099_int_1')
  const conflicts=new Set(retained.map(d=>d.id))
  if (docs.some(d=>conflicts.has(d.id))) return {value:null,error:'Document ID collision. No data changed.',imported:0}
  const candidate: UnifiedReturn={...current,documents:[...retained,...docs],revision:current.revision+1,updatedAt:new Date().toISOString()}
  const checked=validateReturn(candidate,current.taxYear)
  return {value:checked.value,error:checked.error,imported:docs.length}
}
export function legacyImportFixtures():{name:string;passed:boolean}[]{
  const base:DraftWorkspace={version:1,year:'2025',filingStatus:'single',hasDependents:'no',deduction:'standard',incomeKinds:['W-2 wages','1099-INT interest'],wages:[{id:1,employer:'Test Employer',wages:'123.45',withholding:'12.00'}],interest:'4.56',payer:'Test Bank',basicDeductionConfirmed:false,noOtherItemsConfirmed:false,ordinaryTaxMethodConfirmed:false}
  const current:UnifiedReturn={schema:1,taxYear:'2025',revision:0,updatedAt:'',documents:[{id:'schedule_1',kind:'SCHEDULE-C',label:'Fictional business',fields:{grossReceipts:'100',expenses:'20'}}]}
  const result=previewLegacyImport(base,current)
  const repeat=result.value?previewLegacyImport(base,result.value):null
  return [
    {name:'W-2 and interest mapped',passed:result.imported===2&&result.value?.documents.length===3},
    {name:'Schedule C preserved',passed:result.value?.documents.some(d=>d.id==='schedule_1')===true},
    {name:'W-2 cents preserved',passed:result.value?.documents.find(d=>d.id==='legacy_w2_1')?.fields.wages==='123.45'},
    {name:'Repeated import does not duplicate',passed:repeat?.value?.documents.length===3},
    {name:'Year mismatch rejected',passed:previewLegacyImport({...base,year:'2026'},current).value===null},
    {name:'Unsupported income rejected',passed:previewLegacyImport({...base,incomeKinds:['Capital gains']},current).value===null},
    {name:'Invalid monetary value rejected',passed:previewLegacyImport({...base,wages:[{...base.wages[0],wages:'invalid'}]},current).value===null},
  ]
}

/** Non-destructive automatic projection of Income sources into the fictional return. */
export function projectIncomeSafely(source: DraftWorkspace | null, current: UnifiedReturn): LegacyImport {
  if (!source) return {value:null,error:'Income draft unavailable.',imported:0}
  if (source.year !== current.taxYear) return {value:null,error:'Different tax year.',imported:0}
  const independentlyEdited=current.documents.some(d=>(d.kind==='W2'||d.kind==='1099-INT')&&!d.id.startsWith('legacy_w2_')&&d.id!=='legacy_1099_int_1')
  if (independentlyEdited) return {value:null,error:'Independent W-2/1099 documents exist in Unified Return; automatic sync paused to prevent duplicate income. Use the existing manual review workflow.',imported:0}
  const result=previewLegacyImport(source,current)
  if (!result.value) return result
  const same=JSON.stringify(result.value.documents)===JSON.stringify(current.documents)
  return same?{value:null,error:null,imported:0}:result
}
export function incomeProjectionFixtures():{name:string;passed:boolean}[]{
 const source:DraftWorkspace={version:1,year:'2025',filingStatus:'single',hasDependents:'no',deduction:'standard',incomeKinds:['W-2 wages'],wages:[{id:1,employer:'Example',wages:'150.25',withholding:'12.30'}],interest:'',payer:'',basicDeductionConfirmed:false,noOtherItemsConfirmed:false,ordinaryTaxMethodConfirmed:false}
 const empty:UnifiedReturn={schema:1,taxYear:'2025',revision:0,updatedAt:'',documents:[]}
 const first=projectIncomeSafely(source,empty)
 const second=first.value?projectIncomeSafely(source,first.value):null
 const independent={...empty,documents:[{id:'manual',kind:'W2' as const,label:'Manual',fields:{wages:'4',withholding:'1'}}]}
 return [
 {name:'Income W-2 projected',passed:first.value?.documents[0]?.fields.wages==='150.25'},
 {name:'No duplicate projection',passed:second?.value===null&&second?.error===null},
 {name:'Independent W-2 protected',passed:projectIncomeSafely(source,independent).value===null},
 {name:'Different year protected',passed:projectIncomeSafely({...source,year:'2026'},empty).value===null},
 {name:'Invalid amount rejected',passed:projectIncomeSafely({...source,wages:[{...source.wages[0],wages:'bad'}]},empty).value===null},
 {name:'Schedule C preserved',passed:projectIncomeSafely(source,{...empty,documents:[{id:'business',kind:'SCHEDULE-C',label:'Business',fields:{grossReceipts:'40',expenses:'10'}}]}).value?.documents.length===2}
 ]
}
