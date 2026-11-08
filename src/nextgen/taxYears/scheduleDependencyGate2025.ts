/** Phase 17: conservative dependency graph for fictional 2025 drafts. No filing authorization. */
export type GateState = 'matched' | 'mismatch' | 'pending' | 'unsupported'
export interface GateInput2025 {
  year: string
  line1a: number | null
  line2b: number | null
  line9: number | null
  line11a: number | null
  line12e: number | null
  line15: number | null
  line16: number | null
  schedule1Reviewed: boolean
  schedule2Reviewed: boolean
  schedule3Reviewed: boolean
  incomeSourcesValidated: boolean
  deductionsValidated: boolean
  ordinaryTaxMethodReviewed: boolean
}
export interface GateNode { id: string; title: string; upstream: string[]; state: GateState; explanation: string; expectedCents: number | null; actualCents: number | null }
export interface GateResult { nodes: GateNode[]; matches: number; mismatches: number; pending: number; unsupported: number; filingEnabled: false }
const toCents = (v: number | null): number | null => v !== null && Number.isFinite(v) && v >= 0 && Number.isSafeInteger(Math.round(v * 100)) ? Math.round(v * 100) : null
export function checkScheduleDependencies2025(i: GateInput2025): GateResult {
  const nodes: GateNode[] = []
  const supported = i.year === '2025'
  const add = (id: string, title: string, upstream: string[], expected: number | null, actual: number | null, explanation: string, ready: boolean) => {
    const state: GateState = !supported ? 'unsupported' : !ready || expected === null || actual === null ? 'pending' : expected === actual ? 'matched' : 'mismatch'
    nodes.push({id,title,upstream,state,explanation,expectedCents:expected,actualCents:actual})
  }
  const w = toCents(i.line1a), interest = toCents(i.line2b), total = toCents(i.line9), agi = toCents(i.line11a), deduction = toCents(i.line12e)
  // Never infer Schedule 1 other income or adjustments are zero merely from a checkbox.
  add('1040-9', 'Total income / Schedule 1 additional income', ['1040-1a','1040-2b','Schedule 1 line 10'], w !== null && interest !== null && Number.isSafeInteger(w+interest) ? w+interest : null, total, 'W-2 plus interest is only a restricted baseline. Match requires independent confirmation that all other income lines and Schedule 1 additions are inapplicable.', i.incomeSourcesValidated && i.schedule1Reviewed)
  add('1040-11a', 'Adjusted gross income / Schedule 1 adjustments', ['1040-9','Schedule 1 line 26'], total, agi, 'Comparison assumes no Schedule 1 adjustments only after explicit review; does not prove tax-law eligibility.', i.incomeSourcesValidated && i.schedule1Reviewed)
  add('1040-15', 'Taxable income / deduction dependency', ['1040-11a','1040-12e','1040-13'], agi !== null && deduction !== null ? Math.max(0,agi-deduction) : null, toCents(i.line15), 'Requires confirmation that other deductions (including line 13) do not apply.', i.deductionsValidated && i.schedule1Reviewed)
  add('1040-16', 'Income tax / special tax methods', ['1040-15','IRS tax table or worksheet'], null, toCents(i.line16), 'Independent IRS table or worksheet result is required; matching taxable income is not sufficient.', false)
  add('1040-18', 'Tax before credits / Schedule 2 Part I', ['1040-16','Schedule 2 line 3'], null, null, 'Schedule 2 additional taxes must be independently established; an unanswered schedule cannot be treated as zero.', i.schedule2Reviewed)
  add('1040-21', 'Nonrefundable credits / Schedule 3 Part I', ['1040-19','Schedule 3 line 8'], null, null, 'Credit amounts and limitations require independent substantiation.', i.schedule3Reviewed)
  add('1040-24', 'Total tax / Schedule 2 Part II', ['1040-22','Schedule 2 line 21'], null, null, 'Additional taxes, nonrefundable credits, and applicable tax methods are not automatically calculated.', i.schedule2Reviewed && i.schedule3Reviewed)
  add('1040-31', 'Other payments / Schedule 3 Part II', ['Schedule 3 line 15'], null, null, 'Refundable credits and other payments must be verified independently.', i.schedule3Reviewed)
  add('1040-33', 'Total payments', ['1040-25d','1040-26','1040-32'], null, null, 'Requires verified withholding, estimated payments, and refundable credits.', false)
  add('1040-34-37', 'Refund or balance due', ['1040-24','1040-33'], null, null, 'No refund or amount due can be issued from incomplete tax and payment totals.', false)
  return {nodes, matches:nodes.filter(x=>x.state==='matched').length,mismatches:nodes.filter(x=>x.state==='mismatch').length,pending:nodes.filter(x=>x.state==='pending').length,unsupported:nodes.filter(x=>x.state==='unsupported').length,filingEnabled:false}
}
export function dependencyGateCsv2025(result: GateResult): string {
  const quote = (s:string) => '"'+s.replace(/"/g,'""')+'"'
  return ['node,status,dependencies,expected_cents,actual_cents,explanation',...result.nodes.map(n=>[n.id,n.state,n.upstream.join(' | '),n.expectedCents===null?'':String(n.expectedCents),n.actualCents===null?'':String(n.actualCents),n.explanation].map(quote).join(','))].join('\r\n')+'\r\n'
}
export function scheduleDependencyFixtures2025(): {name:string;pass:boolean}[] {
  const base:GateInput2025={year:'2025',line1a:50000,line2b:100,line9:50100,line11a:50100,line12e:15750,line15:34350,line16:4000,schedule1Reviewed:true,schedule2Reviewed:false,schedule3Reviewed:false,incomeSourcesValidated:true,deductionsValidated:true,ordinaryTaxMethodReviewed:false}
  const state=(i:GateInput2025,id:string)=>checkScheduleDependencies2025(i).nodes.find(n=>n.id===id)?.state
  return [
    {name:'Restricted source arithmetic',pass:state(base,'1040-9')==='matched'},
    {name:'Detect income mismatch',pass:state({...base,line9:50099},'1040-9')==='mismatch'},
    {name:'Schedule 1 review required',pass:state({...base,schedule1Reviewed:false},'1040-9')==='pending'},
    {name:'AGI mismatch',pass:state({...base,line11a:50000},'1040-11a')==='mismatch'},
    {name:'Taxable income match',pass:state(base,'1040-15')==='matched'},
    {name:'Deduction review required',pass:state({...base,deductionsValidated:false},'1040-15')==='pending'},
    {name:'Missing value not zero',pass:state({...base,line9:null},'1040-9')==='pending'},
    {name:'Schedule 2 never fabricated',pass:state({...base,schedule2Reviewed:true},'1040-18')==='pending'},
    {name:'Schedule 3 never fabricated',pass:state({...base,schedule3Reviewed:true},'1040-21')==='pending'},
    {name:'No automatic refund',pass:state(base,'1040-34-37')==='pending'},
    {name:'Unsupported year excluded',pass:state({...base,year:'2026'},'1040-9')==='unsupported'},
    {name:'Filing remains disabled',pass:checkScheduleDependencies2025(base).filingEnabled===false}
  ]
}
