/** Fictional 2025 Form 1040 arithmetic-only worksheet. Not a tax calculator or filing approval. */
export const BALANCE_FIELDS_2025 = [
 ['l9','Line 9 — total income'],['l10','Line 10 — adjustments'],['l11a','Line 11a — adjusted gross income'],
 ['l12e','Line 12e — deductions'],['l13a','Line 13a — qualified business income deduction'],['l13b','Line 13b — additional deductions'],['l14','Line 14 — total deductions'],['l15','Line 15 — taxable income'],
 ['l16','Line 16 — income tax'],['l17','Line 17 — Schedule 2 line 3 tax'],['l18','Line 18 — tax before credits'],['l19','Line 19 — child tax credit and other dependent credit'],['l20','Line 20 — Schedule 3 line 8 credits'],['l21','Line 21 — total nonrefundable credits'],['l22','Line 22 — tax after credits'],['l23','Line 23 — other taxes'],['l24','Line 24 — total tax'],
 ['l25a','Line 25a — W-2 withholding'],['l25b','Line 25b — 1099 withholding'],['l25c','Line 25c — other withholding'],['l25d','Line 25d — total withholding'],['l26','Line 26 — estimated tax payments'],['l27a','Line 27a — earned income credit'],['l28','Line 28 — additional child tax credit'],['l29','Line 29 — education credit'],['l31','Line 31 — other refundable credits'],['l32','Line 32 — total other payments and refundable credits'],['l33','Line 33 — total payments'],['l34','Line 34 — overpayment'],['l37','Line 37 — amount owed']
] as const
export type BalanceKey2025 = typeof BALANCE_FIELDS_2025[number][0]
export type BalanceInputs2025 = Partial<Record<BalanceKey2025,string>>
export type BalanceFinding2025 = {code:string;severity:'blocker'|'notice';description:string;fields:BalanceKey2025[]}
export type BalanceReport2025 = {status:'blocked';evaluated:number;passed:number;missing:number;findings:BalanceFinding2025[];values:Partial<Record<BalanceKey2025,number>>}
export function cents2025(raw:unknown):number|null {
 if(typeof raw!=='string'||!raw.trim())return null
 const cleaned=raw.trim().replace(/,/g,'')
 if(!/^-?(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/.test(cleaned))return null
 const negative=cleaned.startsWith('-');const [integer,fraction='']=(negative?cleaned.slice(1):cleaned).split('.')
 const cents=Number(integer)*100+Number(fraction.padEnd(2,'0'))
 return Number.isSafeInteger(cents)?(negative?-cents:cents):null
}
export function validateFederalBalance2025(inputs:BalanceInputs2025):BalanceReport2025 {
 const values:Partial<Record<BalanceKey2025,number>>={}
 const findings:BalanceFinding2025[]=[]
 for(const [key,label] of BALANCE_FIELDS_2025){const parsed=cents2025(inputs[key]);if(parsed===null)findings.push({code:`MISSING_${key}`,severity:'blocker',description:`${label}: enter a valid amount (including zero).`,fields:[key]});else values[key]=parsed}
 let evaluated=0,passed=0
 const check=(code:string,target:BalanceKey2025,parts:BalanceKey2025[],calculate:(v:number[])=>number)=>{
  if(values[target]===undefined||parts.some(k=>values[k]===undefined))return
  evaluated++;const expected=calculate(parts.map(k=>values[k]!));
  if(Number.isSafeInteger(expected)&&values[target]===expected)passed++
  else findings.push({code,severity:'blocker',description:`${target} must be ${(expected/100).toFixed(2)} based on ${parts.join(', ')}; entered ${((values[target]??0)/100).toFixed(2)}.`,fields:[target,...parts]})
 }
 const sum=(code:string,target:BalanceKey2025,parts:BalanceKey2025[])=>check(code,target,parts,v=>v.reduce((a,b)=>a+b,0))
 check('AGI','l11a',['l9','l10'],([a,b])=>a-b)
 sum('DEDUCTIONS','l14',['l12e','l13a','l13b'])
 check('TAXABLE_INCOME','l15',['l11a','l14'],([a,b])=>Math.max(0,a-b))
 sum('TAX_BEFORE_CREDITS','l18',['l16','l17'])
 sum('NONREFUNDABLE_CREDITS','l21',['l19','l20'])
 check('TAX_AFTER_CREDITS','l22',['l18','l21'],([a,b])=>Math.max(0,a-b))
 sum('TOTAL_TAX','l24',['l22','l23'])
 sum('WITHHOLDING','l25d',['l25a','l25b','l25c'])
 sum('REFUNDABLE_PAYMENTS','l32',['l27a','l28','l29','l31'])
 sum('TOTAL_PAYMENTS','l33',['l25d','l26','l32'])
 check('OVERPAYMENT','l34',['l33','l24'],([a,b])=>Math.max(0,a-b))
 check('AMOUNT_OWED','l37',['l24','l33'],([a,b])=>Math.max(0,a-b))
 if(values.l34!==undefined&&values.l37!==undefined&&values.l34>0&&values.l37>0)findings.push({code:'MUTUALLY_EXCLUSIVE_BALANCE',severity:'blocker',description:'Overpayment and amount owed cannot both be positive.',fields:['l34','l37']})
 findings.push({code:'NOT_TAX_ADVICE',severity:'notice',description:'Arithmetic-only draft validation. Eligibility, credits, rounding, schedules, tax tables, IRS instructions, and e-filing are not certified. Filing remains disabled.',fields:[]})
 return {status:'blocked',evaluated,passed,missing:BALANCE_FIELDS_2025.filter(([k])=>values[k]===undefined).length,findings,values}
}
export function federalBalanceCsv2025(report:BalanceReport2025):string{
 const cell=(s:string)=>'"'+(/^[=+@\-\t\r]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"'
 const rows=[['Type','Code','Description','Amount USD','Severity'],...BALANCE_FIELDS_2025.map(([k,label])=>['Line',k,label,report.values[k]===undefined?'missing':(report.values[k]!/100).toFixed(2),'']),...report.findings.map(f=>['Finding',f.code,f.description,'',f.severity])]
 return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n'
}
export const BALANCE_FIXTURE_2025:BalanceInputs2025={l9:'80000',l10:'2000',l11a:'78000',l12e:'15000',l13a:'1000',l13b:'0',l14:'16000',l15:'62000',l16:'9000',l17:'0',l18:'9000',l19:'1000',l20:'0',l21:'1000',l22:'8000',l23:'500',l24:'8500',l25a:'9000',l25b:'0',l25c:'0',l25d:'9000',l26:'0',l27a:'0',l28:'0',l29:'0',l31:'0',l32:'0',l33:'9000',l34:'500',l37:'0'}
