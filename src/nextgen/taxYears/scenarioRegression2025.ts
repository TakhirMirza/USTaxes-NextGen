import { BALANCE_FIELDS_2025, BALANCE_FIXTURE_2025, cents2025, validateFederalBalance2025, type BalanceInputs2025, type BalanceKey2025 } from './federalBalanceValidation2025'

/** Diagnostic comparisons only. No IRS tax computations or return posting. */
export type Scenario2025 = { id:string; name:string; values:BalanceInputs2025 }
export type ScenarioDelta2025 = {key:BalanceKey2025;label:string;baseline:number|null;candidate:number|null;delta:number|null}
export type ScenarioComparison2025 = { baseline:{name:string;passed:number;blockers:number;missing:number}; candidate:{name:string;passed:number;blockers:number;missing:number}; changes:ScenarioDelta2025[];regressions:string[];improvements:string[];status:'blocked' }
export function compareScenarios2025(base:Scenario2025, candidate:Scenario2025):ScenarioComparison2025 {
 const b=validateFederalBalance2025(base.values), c=validateFederalBalance2025(candidate.values)
 const blockers=(r:ReturnType<typeof validateFederalBalance2025>)=>r.findings.filter(f=>f.severity==='blocker')
 const bcodes=new Set(blockers(b).map(f=>f.code)), ccodes=new Set(blockers(c).map(f=>f.code))
 return {baseline:{name:base.name,passed:b.passed,blockers:blockers(b).length,missing:b.missing},candidate:{name:candidate.name,passed:c.passed,blockers:blockers(c).length,missing:c.missing},changes:BALANCE_FIELDS_2025.map(([key,label])=>{const x=cents2025(base.values[key]),y=cents2025(candidate.values[key]);return {key,label,baseline:x,candidate:y,delta:x===null||y===null?null:y-x}}).filter(d=>d.baseline!==d.candidate),regressions:[...ccodes].filter(k=>!bcodes.has(k)).sort(),improvements:[...bcodes].filter(k=>!ccodes.has(k)).sort(),status:'blocked'}
}
export const REGRESSION_SCENARIOS_2025:Scenario2025[]=[
 {id:'balanced',name:'Balanced fictional example',values:{...BALANCE_FIXTURE_2025}},
 {id:'mismatch',name:'Broken total tax + refund',values:{...BALANCE_FIXTURE_2025,l24:'8600',l34:'500',l37:'100'}},
 {id:'withholding',name:'Withholding mismatch',values:{...BALANCE_FIXTURE_2025,l25a:'9500'}},
 {id:'missing',name:'Missing income and withholding',values:{...BALANCE_FIXTURE_2025,l9:'',l25d:''}},
 {id:'zero',name:'All-zero arithmetic',values:Object.fromEntries(BALANCE_FIELDS_2025.map(([k])=>[k,'0'])) as BalanceInputs2025}
]
export function scenarioRegressionCsv2025(comparison:ScenarioComparison2025):string {
 const cell=(v:string)=>'"'+(/^[=+@\-\t\r]/.test(v)?"'":'')+v.replace(/"/g,'""')+'"'
 const rows=[['Field','Baseline cents','Candidate cents','Delta cents'],...comparison.changes.map(d=>[d.key,d.baseline===null?'missing':String(d.baseline),d.candidate===null?'missing':String(d.candidate),d.delta===null?'n/a':String(d.delta)]),['New blockers',comparison.regressions.join('; '),'',''],['Resolved blockers',comparison.improvements.join('; '),'','']]
 return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n'
}
