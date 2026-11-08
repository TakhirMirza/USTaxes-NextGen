import { FederalCreditBalanceInput2025, reconcileFederalCreditBalance2025 } from './federal1040CreditBalance2025'

export interface ReconciliationTestCase2025 { id:string; purpose:string; input:FederalCreditBalanceInput2025; expected:Partial<Record<'18'|'21'|'22'|'24'|'32'|'33'|'34'|'37',number|null>>; blocked:boolean }
const complete:FederalCreditBalanceInput2025={year:'2025',line16Tax:1200000,line17Schedule2Part1:0,line19ChildDependentCredit:0,line20Schedule3Part1:0,line23Schedule2Part2:0,line25Withholding:1000000,line26EstimatedPayments:0,line27EarnedIncomeCredit:0,line28AdditionalChildTaxCredit:0,line29EducationCredit:0,line31Schedule3Part2:0}
const scenario=(changes:Partial<FederalCreditBalanceInput2025>):FederalCreditBalanceInput2025=>({...complete,...changes})
export const reconciliationCases2025:readonly ReconciliationTestCase2025[]=[
 {id:'balance-due',purpose:'Positive amount owed',input:scenario({}),expected:{'18':1200000,'24':1200000,'33':1000000,'34':0,'37':200000},blocked:false},
 {id:'refund',purpose:'Refund when payments exceed total tax',input:scenario({line25Withholding:1500000}),expected:{'24':1200000,'33':1500000,'34':300000,'37':0},blocked:false},
 {id:'exact',purpose:'Zero balance',input:scenario({line25Withholding:1200000}),expected:{'34':0,'37':0},blocked:false},
 {id:'schedule-2',purpose:'Schedule 2 parts I and II posting',input:scenario({line17Schedule2Part1:20000,line23Schedule2Part2:35000}),expected:{'18':1220000,'24':1255000,'37':255000},blocked:false},
 {id:'schedule-3',purpose:'Schedule 3 nonrefundable and refundable amounts',input:scenario({line20Schedule3Part1:15000,line31Schedule3Part2:5000}),expected:{'21':15000,'22':1185000,'32':5000,'33':1005000,'37':180000},blocked:false},
 {id:'refundable',purpose:'Refundable credit posting',input:scenario({line27EarnedIncomeCredit:10000,line28AdditionalChildTaxCredit:20000,line29EducationCredit:5000}),expected:{'32':35000,'33':1035000,'37':165000},blocked:false},
 {id:'missing',purpose:'Missing values never become zero',input:scenario({line20Schedule3Part1:null}),expected:{'21':null,'22':null,'24':null,'34':null,'37':null},blocked:true},
 {id:'negative',purpose:'Reject negative payment',input:scenario({line25Withholding:-1}),expected:{'33':null,'34':null,'37':null},blocked:true},
 {id:'fractional',purpose:'Reject fractional cents',input:scenario({line16Tax:1200000.5}),expected:{'18':null,'24':null,'37':null},blocked:true},
 {id:'other-year',purpose:'Reject tax years other than 2025',input:scenario({year:'2026'}),expected:{'24':1200000},blocked:true},
 {id:'credit-overflow',purpose:'Flag nonrefundable credits exceeding tax',input:scenario({line19ChildDependentCredit:1300000}),expected:{'22':0,'24':0,'34':1000000},blocked:true},
 {id:'zero-confirmed',purpose:'Verified zero is a real value',input:scenario({line16Tax:0,line25Withholding:0}),expected:{'18':0,'24':0,'33':0,'34':0,'37':0},blocked:false},
]
export interface ReconciliationTestResult2025 { id:string; purpose:string; passed:boolean; details:string }
export function runFederalReconciliationRegression2025():ReconciliationTestResult2025[]{return reconciliationCases2025.map(test=>{
 const actual=reconcileFederalCreditBalance2025(test.input)
 const differences=Object.entries(test.expected).filter(([line,value])=>actual.lines[line as keyof typeof actual.lines]!==value).map(([line,value])=>`line ${line}: expected ${value}, received ${actual.lines[line as keyof typeof actual.lines]}`)
 if((actual.status==='blocked')!==test.blocked)differences.push(`expected blocked=${test.blocked}, received ${actual.status}`)
 if(actual.filingEnabled!==false)differences.push('filing unexpectedly enabled')
 return {id:test.id,purpose:test.purpose,passed:differences.length===0,details:differences.length?differences.join('; '):'All assertions passed'}
})}
export function reconciliationRegressionCsv2025(results:readonly ReconciliationTestResult2025[]):string{
 const escape=(s:string)=>'"'+s.replace(/"/g,'""')+'"'
 return 'case_id,purpose,status,details\r\n'+results.map(r=>[r.id,r.purpose,r.passed?'PASS':'FAIL',r.details].map(escape).join(',')).join('\r\n')+'\r\n'
}
