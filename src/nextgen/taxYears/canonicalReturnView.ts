/** Phase 64: non-destructive read-through of Income into Unified Return. */
import type { DraftWorkspace } from '../navigation/draftWorkspace'
import type { UnifiedReturn, TaxDocument } from './unifiedReturnStore'
import { emptyReturn, validateReturn } from './unifiedReturnStore'

export type CanonicalView = {value:UnifiedReturn;blocked:boolean;message:string}
export function buildCanonicalReturn(saved:UnifiedReturn, income:DraftWorkspace|null):CanonicalView {
  const historical=saved.documents.filter(d=>d.kind==='W2'||d.kind==='1099-INT')
  const schedule=saved.documents.filter(d=>d.kind==='SCHEDULE-C')
  if(historical.length) return {value:{...saved,documents:schedule},blocked:true,message:'Historical W-2 / 1099-INT documents found in the old Unified Return store. They are excluded from calculations to prevent double counting. Export the old return and reconcile before continuing.'}
  if(!income) return {value:{...saved,documents:schedule},blocked:false,message:'No Income draft in this tab. Open Income to enter fictional W-2 / 1099-INT.'}
  if(income.year!==saved.taxYear) return {value:{...saved,documents:schedule},blocked:true,message:'Income tax year differs from this return. No income values were applied.'}
  const unsupported=income.incomeKinds.filter(k=>!['W-2 wages','1099-INT interest'].includes(k))
  if(unsupported.length) return {value:{...saved,documents:schedule},blocked:true,message:`Additional income categories (${unsupported.join(', ')}) are not mapped by this preview. No partial return calculation allowed.`}
  const docs:TaxDocument[]=[]
  if(income.incomeKinds.includes('W-2 wages')) for(const w of income.wages) docs.push({id:`canonical_w2_${w.id}`,kind:'W2',label:(w.employer.trim()||`W-2 ${w.id}`).slice(0,80),fields:{wages:w.wages,withholding:w.withholding}})
  if(income.incomeKinds.includes('1099-INT interest')) docs.push({id:'canonical_1099_int_1',kind:'1099-INT',label:(income.payer.trim()||'1099-INT').slice(0,80),fields:{interest:income.interest}})
  const value={...saved,documents:[...schedule,...docs]}
  const check=validateReturn(value,saved.taxYear)
  if(!check.value) return {value:{...saved,documents:schedule},blocked:true,message:`Income mapping invalid: ${check.error}`}
  return {value:check.value,blocked:false,message:''}
}
export function canonicalReturnFixtures():{name:string;passed:boolean}[]{
  const b=emptyReturn('2025')
  const i:DraftWorkspace={version:1,year:'2025',filingStatus:'single',hasDependents:'no',deduction:'standard',incomeKinds:['W-2 wages','1099-INT interest'],wages:[{id:1,employer:'Example',wages:'100.25',withholding:'10.25'}],interest:'2.10',payer:'Example bank',basicDeductionConfirmed:false,noOtherItemsConfirmed:false,ordinaryTaxMethodConfirmed:false}
  const a=buildCanonicalReturn(b,i)
  const c=buildCanonicalReturn({...b,documents:[{id:'old',kind:'W2',label:'Old',fields:{wages:'20',withholding:'2'}}]},i)
  return [
    {name:'Canonical W-2 visible without copying',passed:a.value.documents.some(d=>d.id==='canonical_w2_1')},
    {name:'Canonical interest visible',passed:a.value.documents.some(d=>d.kind==='1099-INT')},
    {name:'Original return stays unchanged',passed:b.documents.length===0},
    {name:'Historical income excluded and blocked',passed:c.blocked&&!c.value.documents.some(d=>d.kind==='W2')},
    {name:'Year mismatch blocks',passed:buildCanonicalReturn(b,{...i,year:'2026'}).blocked},
    {name:'Unsupported income blocks',passed:buildCanonicalReturn(b,{...i,incomeKinds:['Capital gains']}).blocked},
    {name:'Schedule C preserved',passed:buildCanonicalReturn({...b,documents:[{id:'c',kind:'SCHEDULE-C',label:'Business',fields:{grossReceipts:'20',expenses:'5'}}]},i).value.documents.some(d=>d.id==='c')},
    {name:'Invalid source amounts block',passed:buildCanonicalReturn(b,{...i,wages:[{...i.wages[0],wages:'bad'}]}).blocked},
  ]
}
