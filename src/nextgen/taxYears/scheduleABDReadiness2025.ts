/** 2025 Schedule A/B/D coverage audit; never computes tax or assumes absent facts. */
export type CoverageStatus = 'ready-for-review' | 'blocked' | 'not-selected'
export type ScheduleAudit = { id:'A'|'B'|'D'; title:string; status:CoverageStatus; notes:string[]; route:'income'|'deductions' }
export type ScheduleAuditInput = {year:string; deduction:string; deductionReviewed:boolean; interestSelected:boolean; interest:string; payer:string; dividendSelected:boolean; capitalGainsSelected:boolean; sourceMapped:boolean}
const money = (s:string):number|null => {const t=s.trim().replace(/[$,]/g,'');if(!/^\d+(?:\.\d{1,2})?$/.test(t))return null;const cents=Math.round(Number(t)*100);return Number.isSafeInteger(cents)?cents:null}
export function assessScheduleABD2025(x:ScheduleAuditInput):ScheduleAudit[]{
 const not2025=x.year!=='2025'
 const a:ScheduleAudit={id:'A',title:'Itemized deductions — Schedule A',route:'deductions',status:'blocked',notes:[]}
 if(x.deduction==='standard'){a.status='not-selected';a.notes.push('Standard deduction selected. Schedule A not posted.')}
 else if(x.deduction==='unknown')a.notes.push('Deduction method not selected.')
 else {a.notes.push('Itemized expense categories, limitations and eligibility have not been collected or verified.');if(!x.deductionReviewed)a.notes.push('Deduction eligibility review is incomplete.')}
 const b:ScheduleAudit={id:'B',title:'Interest and dividends — Schedule B',route:'income',status:'blocked',notes:[]}
 if(!x.interestSelected&&!x.dividendSelected){b.status='not-selected';b.notes.push('No interest or dividend category selected; completeness of income still requires review.')}
 else {if(x.dividendSelected)b.notes.push('Dividend source details and Schedule B reporting rules are not implemented.');if(x.interestSelected){if(money(x.interest)===null)b.notes.push('1099-INT interest is missing or invalid.');if(!x.payer.trim())b.notes.push('1099-INT payer label is missing.');if(!x.sourceMapped)b.notes.push('Interest source mapping is not reconciled.')}if(b.notes.length===0){b.status='ready-for-review';b.notes.push('Interest source present; Schedule B filing requirements and all other interest/dividend sources still require independent determination.')}}
 const d:ScheduleAudit={id:'D',title:'Capital gains and losses — Schedule D',route:'income',status:'blocked',notes:[]}
 if(!x.capitalGainsSelected){d.status='not-selected';d.notes.push('Capital gains category not selected; other capital transaction disclosures still require review.')}
 else d.notes.push('Form 8949 transactions, basis, holding periods, adjustments, carryovers and special rates are not implemented.')
 const rows=[a,b,d]
 if(not2025)rows.forEach(r=>{r.status='blocked';r.notes=['Only tax year 2025 is supported by this audit.']})
 return rows
}
export function scheduleABDAuditCsv(rows:ScheduleAudit[]):string{
 const q=(s:string)=>'"'+s.replace(/"/g,'""')+'"'
 return ['schedule,status,reason',...rows.map(r=>[r.id,r.status,r.notes.join(' | ')].map(q).join(','))].join('\r\n')
}
export function scheduleABDFixtures(){
 const base:ScheduleAuditInput={year:'2025',deduction:'standard',deductionReviewed:false,interestSelected:true,interest:'120.00',payer:'Fictional Bank',dividendSelected:false,capitalGainsSelected:false,sourceMapped:true}
 const check=(name:string,changes:Partial<ScheduleAuditInput>,ok:(r:ScheduleAudit[])=>boolean)=>({name,pass:ok(assessScheduleABD2025({...base,...changes}))})
 return [check('Standard deduction excludes A',{},r=>r[0].status==='not-selected'),check('Itemized A blocked',{deduction:'itemized'},r=>r[0].status==='blocked'),check('Interest ready for review',{},r=>r[1].status==='ready-for-review'),check('Missing payer blocks B',{payer:''},r=>r[1].status==='blocked'),check('Dividends block B',{dividendSelected:true},r=>r[1].status==='blocked'),check('Capital gains block D',{capitalGainsSelected:true},r=>r[2].status==='blocked'),check('2026 blocked',{year:'2026'},r=>r.every(x=>x.status==='blocked')),check('Malformed interest blocked',{interest:'invalid'},r=>r[1].status==='blocked')]
}
