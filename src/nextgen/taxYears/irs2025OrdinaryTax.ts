/** IRS 2025 Form 1040 Tax Computation Worksheet, ordinary tax ONLY.
 * https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf (line 16 worksheet)
 * For taxable income BELOW $100,000 use the IRS Tax Table, NOT this worksheet.
 * Amounts in integer cents. Unknown and special-method tax returns must be blocked.
 */
export type Filing2025 = 'single'|'marriedJoint'|'marriedSeparate'|'headOfHousehold'|'qualifyingSurvivingSpouse'
interface Band { ceiling: number; rate: number; subtractionCents: number }
const tables: Record<Filing2025, readonly Band[]> = {
  single: [[103350,22,508600],[197300,24,715300],[250525,32,2293700],[626350,35,3045275],[Infinity,37,4297975]].map(([ceiling,rate,subtractionCents])=>({ceiling,rate,subtractionCents})),
  marriedJoint: [[206700,22,1017200],[394600,24,1430600],[501050,32,4587400],[751600,35,6090550],[Infinity,37,7593750]].map(([ceiling,rate,subtractionCents])=>({ceiling,rate,subtractionCents})),
  marriedSeparate: [[103350,22,508600],[197300,24,715300],[250525,32,2293700],[375800,35,3045275],[Infinity,37,3796875]].map(([ceiling,rate,subtractionCents])=>({ceiling,rate,subtractionCents})),
  headOfHousehold: [[103350,22,682500],[197300,24,889200],[250500,32,2467600],[626350,35,3219100],[Infinity,37,4471800]].map(([ceiling,rate,subtractionCents])=>({ceiling,rate,subtractionCents})),
  qualifyingSurvivingSpouse: [[206700,22,1017200],[394600,24,1430600],[501050,32,4587400],[751600,35,6090550],[Infinity,37,7593750]].map(([ceiling,rate,subtractionCents])=>({ceiling,rate,subtractionCents}))
}
export interface OrdinaryTaxInput2025 {year: number; filingStatus: Filing2025; taxableIncomeCents: number; ordinaryIncomeOnlyConfirmed: boolean; line15Reconciled: boolean }
export type OrdinaryTaxResult2025 = {status:'blocked'; blockers:string[]; line16Cents:null} | {status:'calculated'; blockers:[]; line16Cents:number; method:'2025 IRS Tax Computation Worksheet'; ratePercent:number}
export function computeOrdinaryTax2025(input: OrdinaryTaxInput2025): OrdinaryTaxResult2025 {
 const blockers:string[]=[]
 if(input.year!==2025)blockers.push('Only tax year 2025 is supported.')
 if(!Object.prototype.hasOwnProperty.call(tables,input.filingStatus))blockers.push('Unknown filing status.')
 if(!Number.isSafeInteger(input.taxableIncomeCents)||input.taxableIncomeCents<0||input.taxableIncomeCents>100000000000)blockers.push('Invalid taxable income.')
 else if(input.taxableIncomeCents<10000000)blockers.push('Below $100,000: the IRS Tax Table is required and is not implemented in this calculator.')
 if(!input.ordinaryIncomeOnlyConfirmed)blockers.push('Qualified dividends, capital gains, foreign earned income, Schedule J, Form 8615 and other special tax methods must be ruled out.')
 if(!input.line15Reconciled)blockers.push('Form 1040 line 15 must be reconciled to source documents and deductions.')
 if(blockers.length)return {status:'blocked',blockers,line16Cents:null}
 const row=tables[input.filingStatus].find(b=>input.taxableIncomeCents<=b.ceiling*100)!
 // worksheet amount: taxable income * rate - subtraction, rounded to nearest cent
 const tax=Math.round(input.taxableIncomeCents*row.rate/100-row.subtractionCents)
 if(!Number.isSafeInteger(tax)||tax<0)return {status:'blocked',blockers:['Tax arithmetic overflow.'],line16Cents:null}
 return {status:'calculated',blockers:[],line16Cents:tax,method:'2025 IRS Tax Computation Worksheet',ratePercent:row.rate}
}
