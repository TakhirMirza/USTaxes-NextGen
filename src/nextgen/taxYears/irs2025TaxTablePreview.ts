/**
 * 2025 ordinary-income tax-table arithmetic PREVIEW.
 * Reconstructs $50 IRS Tax Table intervals using 2025 ordinary brackets.
 * This is not a transcription of the IRS table and must be independently
 * compared against the published 2025 table before real taxpayer use.
 * All input/output money values are integer cents.
 */
export type TableFilingStatus2025 =
  'single'|'marriedJoint'|'marriedSeparate'|'headOfHousehold'|'qualifyingSurvivingSpouse'
type Bracket = readonly [number, number]
const brackets: Record<TableFilingStatus2025, readonly Bracket[]> = {
 single:[[11925,0.10],[48350,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[626350,0.35],[Infinity,0.37]],
 marriedJoint:[[23850,0.10],[96700,0.12],[206700,0.22],[394600,0.24],[501050,0.32],[751600,0.35],[Infinity,0.37]],
 marriedSeparate:[[11925,0.10],[48350,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[375800,0.35],[Infinity,0.37]],
 headOfHousehold:[[17000,0.10],[64850,0.12],[103350,0.22],[197300,0.24],[250500,0.32],[626350,0.35],[Infinity,0.37]],
 qualifyingSurvivingSpouse:[[23850,0.10],[96700,0.12],[206700,0.22],[394600,0.24],[501050,0.32],[751600,0.35],[Infinity,0.37]]
}
export type TableResult2025 =
 | {status:'blocked';blockers:string[];taxCents:null}
 | {status:'preview';taxCents:number;intervalStart:number;intervalEnd:number;method:'2025 $50 interval bracket reconstruction — unverified'}
function marginalTax(dollars:number, filingStatus:TableFilingStatus2025):number {
 let prior=0, tax=0
 for(const [ceiling,rate] of brackets[filingStatus]) {
   const taxable=Math.min(dollars,ceiling)-prior
   if(taxable>0)tax+=taxable*rate
   if(dollars<=ceiling)break
   prior=ceiling
 }
 return tax
}
export function preview2025TaxTable(input:{
 year:number;filingStatus:TableFilingStatus2025;taxableIncomeCents:number;
 ordinaryIncomeOnlyConfirmed:boolean;line15Reconciled:boolean
}):TableResult2025 {
 const blockers:string[]=[]
 if(input.year!==2025)blockers.push('Only 2025 is supported.')
 if(!Object.prototype.hasOwnProperty.call(brackets,input.filingStatus))blockers.push('Invalid filing status.')
 if(!Number.isSafeInteger(input.taxableIncomeCents)||input.taxableIncomeCents<0||input.taxableIncomeCents>=10000000)
   blockers.push('Taxable income must be from $0 to less than $100,000.')
 if(!input.ordinaryIncomeOnlyConfirmed)blockers.push('Special tax computation methods must be excluded.')
 if(!input.line15Reconciled)blockers.push('Line 15 requires independent source reconciliation.')
 if(blockers.length)return {status:'blocked',blockers,taxCents:null}
 const dollars=input.taxableIncomeCents/100
 const intervalStart=Math.floor(dollars/50)*50
 const intervalEnd=intervalStart+50
 // The 2025 tax table uses $50 intervals. This reconstruction uses the midpoint
 // and rounds to a whole dollar. Compare against official published cells.
 const taxCents=Math.floor(marginalTax(intervalStart+25,input.filingStatus)+0.5)*100
 return {status:'preview',taxCents,intervalStart,intervalEnd,
   method:'2025 $50 interval bracket reconstruction — unverified'}
}
