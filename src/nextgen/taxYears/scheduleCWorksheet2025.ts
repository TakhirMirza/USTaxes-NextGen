/** Schedule C draft worksheet only. No federal tax or Schedule SE calculation. */
export type ScheduleCField = 'grossReceipts'|'returnsAllowances'|'costOfGoodsSold'|'otherIncome'|'advertising'|'carTruck'|'contractLabor'|'insurance'|'legalProfessional'|'office'|'rent'|'repairs'|'supplies'|'taxesLicenses'|'travel'|'meals'|'utilities'|'wages'|'otherExpenses'
export type ScheduleCDraft = { businessLabel: string; fields: Record<ScheduleCField,string>; reviewed: boolean }
export const scheduleCFields: {key:ScheduleCField; label:string; group:'income'|'expense'; note?:string}[] = [
 {key:'grossReceipts',label:'Gross receipts or sales',group:'income'},
 {key:'returnsAllowances',label:'Returns and allowances',group:'income'},
 {key:'costOfGoodsSold',label:'Cost of goods sold',group:'income',note:'Enter only if separately substantiated'},
 {key:'otherIncome',label:'Other business income',group:'income'},
 {key:'advertising',label:'Advertising',group:'expense'},
 {key:'carTruck',label:'Car and truck expenses',group:'expense',note:'Requires mileage / actual-cost eligibility review'},
 {key:'contractLabor',label:'Contract labor',group:'expense'},
 {key:'insurance',label:'Business insurance',group:'expense'},
 {key:'legalProfessional',label:'Legal and professional services',group:'expense'},
 {key:'office',label:'Office expense',group:'expense'},
 {key:'rent',label:'Rent or lease',group:'expense'},
 {key:'repairs',label:'Repairs and maintenance',group:'expense'},
 {key:'supplies',label:'Supplies',group:'expense'},
 {key:'taxesLicenses',label:'Taxes and licenses',group:'expense'},
 {key:'travel',label:'Travel',group:'expense'},
 {key:'meals',label:'Meals (gross amount)',group:'expense',note:'Deductible percentage is not determined here'},
 {key:'utilities',label:'Utilities',group:'expense'},
 {key:'wages',label:'Employee wages',group:'expense'},
 {key:'otherExpenses',label:'Other business expenses',group:'expense'}
]
export const emptyScheduleCDraft2025 = (): ScheduleCDraft => ({businessLabel:'',fields:Object.fromEntries(scheduleCFields.map(f=>[f.key,''])) as Record<ScheduleCField,string>,reviewed:false})
export function parseScheduleCAmount(value:string):number|null { const v=value.trim().replace(/,/g,''); if(!v) return 0; if(!/^\d+(?:\.\d{1,2})?$/.test(v))return null; const [whole,dec='']=v.split('.'); const cents=Number(whole)*100+Number(dec.padEnd(2,'0'));return Number.isSafeInteger(cents)?cents:null }
export function assessScheduleC2025(draft:ScheduleCDraft) {
 const errors:string[]=[];const cents={} as Record<ScheduleCField,number>;
 for(const field of scheduleCFields){const parsed=parseScheduleCAmount(draft.fields[field.key]||'');if(parsed===null){errors.push(`${field.label}: enter a nonnegative amount with up to two decimal places.`);cents[field.key]=0}else cents[field.key]=parsed}
 const grossProfit=cents.grossReceipts-cents.returnsAllowances-cents.costOfGoodsSold+cents.otherIncome;
 if(cents.returnsAllowances>cents.grossReceipts)errors.push('Returns and allowances exceed gross receipts; review source documents.');
 const expenseKeys=scheduleCFields.filter(f=>f.group==='expense'&&f.key!=='meals').map(f=>f.key);
 const expenses=expenseKeys.reduce((sum,key)=>sum+cents[key],0);
 const mealsEntered=cents.meals>0;
 const netBeforeMeals=grossProfit-expenses;
 const incomplete=mealsEntered||errors.length>0||!draft.reviewed||!draft.businessLabel.trim();
 return {errors,grossProfitCents:grossProfit,otherExpensesCents:expenses,netBeforeMealsCents:netBeforeMeals,mealsEntered,complete:!incomplete,requiresTaxReview:true as const};
}
export function scheduleCExportCsv2025(draft:ScheduleCDraft):string {
 const safe=(s:string)=>'"'+( /^[=+\-@\t\r]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';
 return ['Field,Amount',...scheduleCFields.map(f=>`${safe(f.label)},${safe(draft.fields[f.key]||'')}`)].join('\r\n')+'\r\n';
}
