/** Development-only read model. Never substitutes an unknown value with zero. */
export type SourceState2025 = 'verified' | 'pending' | 'conflict' | 'excluded'
export interface SourceLine2025 {
  id: string
  label: string
  source: string
  cents: number | null
  state: SourceState2025
  reason: string
  dependencies: string[]
}
export interface UnifiedLedgerInput2025 {
  year: number
  wagesSelected: boolean
  wages: Array<{wages: number | string; withholding: number | string}>
  interestSelected: boolean
  interest: number | string
  sourceMapped: boolean
  scheduleReconciled: boolean
  deductionReviewed: boolean
  taxReviewed: boolean
  line1a: number | null
  line2b: number | null
  line9: number | null
  line11a: number | null
  line12e: number | null
  line15: number | null
  line16: number | null
}
const toCents = (n: number | null): number | null => n === null || !Number.isFinite(n) ? null : Math.round(n * 100)
const parseMoney = (v: string | number): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null
  const s = v.trim().replace(/[$,]/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(Math.round(n * 100)) ? Math.round(n * 100) : null
}
export function buildUnifiedLedger2025(input: UnifiedLedgerInput2025): SourceLine2025[] {
  const rows: SourceLine2025[] = []
  const add = (id: string,label: string,source: string,value: number|null,ready: boolean,reason: string,dependencies: string[] = []) => {
    const invalid = value !== null && (!Number.isSafeInteger(value) || value < 0)
    rows.push({id,label,source,cents:invalid?null:value,state:invalid?'conflict':ready&&value!==null?'verified':'pending',reason:invalid?'Invalid or out-of-range monetary value':ready&&value!==null?'Value present with required review flags':reason,dependencies})
  }
  const wages = input.wages.map(x=>parseMoney(x.wages))
  const withholding = input.wages.map(x=>parseMoney(x.withholding))
  if (input.wagesSelected) {
    input.wages.forEach((_,i)=>{
      add(`W2-${i+1}-1`,'W-2 Box 1 wages',`W-2 entry ${i+1}`,wages[i],wages[i]!==null,'Missing or invalid wage entry')
      add(`W2-${i+1}-2`,'W-2 Box 2 withholding',`W-2 entry ${i+1}`,withholding[i],withholding[i]!==null,'Missing or invalid withholding entry')
    })
  }
  if (input.interestSelected) add('1099INT-1','Taxable interest','1099-INT draft',parseMoney(input.interest),true,'Interest amount missing')
  add('1040-1a','Wages, salaries, tips','Form 1040 mapping',toCents(input.line1a),input.sourceMapped,'Income source mapping incomplete',input.wagesSelected?input.wages.map((_,i)=>`W2-${i+1}-1`):[])
  add('1040-2b','Taxable interest','Form 1040 mapping',toCents(input.line2b),input.sourceMapped,'Interest source mapping incomplete',input.interestSelected?['1099INT-1']:[])
  add('1040-9','Total income','Federal calculation engine',toCents(input.line9),input.sourceMapped&&input.scheduleReconciled,'Schedules or income sources unresolved',['1040-1a','1040-2b','Schedule 1'])
  add('1040-11a','Adjusted gross income','Federal calculation engine',toCents(input.line11a),input.sourceMapped&&input.scheduleReconciled,'Schedule 1 adjustments unresolved',['1040-9','Schedule 1'])
  add('1040-12e','Deduction','Deduction eligibility review',toCents(input.line12e),input.deductionReviewed,'Deduction review incomplete',['Schedule A / standard deduction'])
  add('1040-15','Taxable income','Federal calculation engine',toCents(input.line15),input.sourceMapped&&input.scheduleReconciled&&input.deductionReviewed,'Income or deduction review incomplete',['1040-11a','1040-12e'])
  add('1040-16','Tax','Tax worksheet',toCents(input.line16),input.taxReviewed&&input.deductionReviewed,'Tax computation not fully reviewed',['1040-15','Tax worksheet'])
  const expectedWages = input.wagesSelected && wages.length>0 && wages.every(v=>v!==null) ? wages.reduce<number>((a,b)=>a+(b as number),0):null
  const mappedWages = toCents(input.line1a)
  if (expectedWages!==null && mappedWages!==null && expectedWages!==mappedWages) {
    const line=rows.find(r=>r.id==='1040-1a')!
    line.state='conflict';line.reason=`W-2 source total ${expectedWages} cents differs from mapped ${mappedWages} cents`
  }
  const expectedInterest = input.interestSelected?parseMoney(input.interest):null
  const mappedInterest = toCents(input.line2b)
  if(expectedInterest!==null&&mappedInterest!==null&&expectedInterest!==mappedInterest){
    const line=rows.find(r=>r.id==='1040-2b')!
    line.state='conflict';line.reason='1099-INT source amount differs from mapped Form 1040 line'
  }
  if(input.year!==2025) rows.forEach(r=>{r.state='excluded';r.reason='2025-only mapping; tax-year rules not established'})
  return rows
}
export function unifiedLedgerCsv2025(rows:SourceLine2025[]):string {
  const quote=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`
  return ['line,label,source,cents,status,reason,dependencies',...rows.map(r=>[r.id,r.label,r.source,r.cents??'',r.state,r.reason,r.dependencies.join(' | ')].map(quote).join(','))].join('\r\n')
}
export function unifiedLedgerFixtures2025(){
 const base:UnifiedLedgerInput2025={year:2025,wagesSelected:true,wages:[{wages:'100.00',withholding:'10.00'}],interestSelected:false,interest:'',sourceMapped:true,scheduleReconciled:true,deductionReviewed:true,taxReviewed:true,line1a:100,line2b:null,line9:100,line11a:100,line12e:0,line15:100,line16:10}
 const check=(name:string,change:Partial<UnifiedLedgerInput2025>,expect:(rows:SourceLine2025[])=>boolean)=>({name,pass:expect(buildUnifiedLedger2025({...base,...change}))})
 return [check('Matching wages',{},r=>r.find(x=>x.id==='1040-1a')?.state==='verified'),check('Mismatch flagged',{line1a:90},r=>r.find(x=>x.id==='1040-1a')?.state==='conflict'),check('Missing is not zero',{line1a:null},r=>r.find(x=>x.id==='1040-1a')?.cents===null),check('Unreviewed tax stays pending',{taxReviewed:false},r=>r.find(x=>x.id==='1040-16')?.state==='pending'),check('Other tax year excluded',{year:2026},r=>r.every(x=>x.state==='excluded')),check('Malformed source pending',{wages:[{wages:'abc',withholding:10}]},r=>r.find(x=>x.id==='W2-1-1')?.state==='pending'),check('Interest conflict',{interestSelected:true,interest:12,line2b:11},r=>r.find(x=>x.id==='1040-2b')?.state==='conflict')]
}
