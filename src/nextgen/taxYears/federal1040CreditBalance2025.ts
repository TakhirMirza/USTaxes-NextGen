/** Restricted 2025 Form 1040 credit/payment arithmetic. Fictional scenarios only.
 * Unknown is NOT zero. Credit eligibility and tax methods are not determined here.
 */
export type Cents = number | null
export interface FederalCreditBalanceInput2025 {
  year: string
  line16Tax: Cents
  line17Schedule2Part1: Cents
  line19ChildDependentCredit: Cents
  line20Schedule3Part1: Cents
  line23Schedule2Part2: Cents
  line25Withholding: Cents
  line26EstimatedPayments: Cents
  line27EarnedIncomeCredit: Cents
  line28AdditionalChildTaxCredit: Cents
  line29EducationCredit: Cents
  line31Schedule3Part2: Cents
}
export type LineKey2025 = '16'|'17'|'18'|'19'|'20'|'21'|'22'|'23'|'24'|'25'|'26'|'27'|'28'|'29'|'31'|'32'|'33'|'34'|'37'
export interface FederalCreditBalanceResult2025 {
  lines: Record<LineKey2025,Cents>
  blockers: string[]
  status: 'blocked'|'arithmetically-reconciled'
  filingEnabled: false
}
const valid=(n:Cents):n is number => n !== null && Number.isSafeInteger(n) && n>=0 && n<=100000000000
const add=(...values:Cents[]):Cents => values.every(valid) ? values.reduce<number>((sum,value)=>sum+(value as number),0) : null
const difference=(a:Cents,b:Cents):Cents => valid(a)&&valid(b) ? Math.max(0,a-b) : null
export function reconcileFederalCreditBalance2025(input:FederalCreditBalanceInput2025):FederalCreditBalanceResult2025 {
  const blockers:string[]=[]
  const required:[keyof FederalCreditBalanceInput2025,string][]=[
    ['line16Tax','Form 1040 line 16: independently validated tax'],
    ['line17Schedule2Part1','Schedule 2 Part I / line 17'],
    ['line19ChildDependentCredit','Child/dependent credit / line 19'],
    ['line20Schedule3Part1','Schedule 3 Part I / line 20'],
    ['line23Schedule2Part2','Schedule 2 Part II / line 23'],
    ['line25Withholding','Withholding / line 25'],
    ['line26EstimatedPayments','Estimated payments / line 26'],
    ['line27EarnedIncomeCredit','Earned income credit / line 27'],
    ['line28AdditionalChildTaxCredit','Additional child tax credit / line 28'],
    ['line29EducationCredit','Refundable education credit / line 29'],
    ['line31Schedule3Part2','Schedule 3 Part II / line 31']]
  if(input.year!=='2025')blockers.push('Only tax year 2025 is supported')
  for(const [key,label] of required)if(!valid(input[key] as Cents))blockers.push(`Unverified: ${label}. Enter verified zero only if confirmed not applicable.`)
  const line18=add(input.line16Tax,input.line17Schedule2Part1)
  const line21=add(input.line19ChildDependentCredit,input.line20Schedule3Part1)
  const line22=difference(line18,line21)
  const line24=add(line22,input.line23Schedule2Part2)
  const line32=add(input.line27EarnedIncomeCredit,input.line28AdditionalChildTaxCredit,input.line29EducationCredit,input.line31Schedule3Part2)
  const line33=add(input.line25Withholding,input.line26EstimatedPayments,line32)
  const line34=valid(line33)&&valid(line24)?Math.max(0,line33-line24):null
  const line37=valid(line33)&&valid(line24)?Math.max(0,line24-line33):null
  const lines:Record<LineKey2025,Cents>={
    '16':input.line16Tax,'17':input.line17Schedule2Part1,'18':line18,
    '19':input.line19ChildDependentCredit,'20':input.line20Schedule3Part1,'21':line21,'22':line22,
    '23':input.line23Schedule2Part2,'24':line24,'25':input.line25Withholding,'26':input.line26EstimatedPayments,
    '27':input.line27EarnedIncomeCredit,'28':input.line28AdditionalChildTaxCredit,'29':input.line29EducationCredit,
    '31':input.line31Schedule3Part2,'32':line32,'33':line33,'34':line34,'37':line37}
  if(valid(line21)&&valid(line18)&&line21>line18)blockers.push('Credits exceed line 18; review nonrefundable credit limitations before posting')
  return {lines,blockers,status:blockers.length?'blocked':'arithmetically-reconciled',filingEnabled:false}
}
export function federalCreditBalanceCsv2025(result:FederalCreditBalanceResult2025):string {
  return 'form_1040_line,amount_cents,status\r\n'+Object.entries(result.lines).map(([key,value])=>`${key},${value===null?'':value},${value===null?'unverified':'arithmetic-only'}`).join('\r\n')+'\r\n'
}
