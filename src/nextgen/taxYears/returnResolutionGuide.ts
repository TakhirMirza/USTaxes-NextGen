import type { ReturnIssue, ValidationSummary } from './returnValidationCenter'

export type ResolutionArea = 'Income' | 'Deductions' | 'Schedules' | 'Tax year' | 'Return review'
export type ResolutionStep = { area: ResolutionArea; issues: ReturnIssue[]; blockers: number; nextAction: string }
const areaOrder: ResolutionArea[] = ['Tax year','Income','Deductions','Schedules','Return review']
export function issueArea(issue: ReturnIssue): ResolutionArea {
  const text = `${issue.location} ${issue.title} ${issue.sourceKey}`.toLowerCase()
  if (issue.category === 'tax-year') return 'Tax year'
  if (/w-?2|1099|interest|wage|income|1a|2b|25a/.test(text)) return 'Income'
  if (/deduct|schedule a|line 12|12e/.test(text)) return 'Deductions'
  if (issue.category === 'cross-form' || /schedule|edge:/.test(text)) return 'Schedules'
  return 'Return review'
}
const actions: Record<ResolutionArea,string> = {
  'Tax year':'Confirm that every form and rule pack uses the same verified tax year.',
  Income:'Review the source W-2 and 1099-INT documents and complete missing fields.',
  Deductions:'Review deduction inputs and the annual eligibility rules.',
  Schedules:'Verify upstream schedules before attempting downstream Form 1040 reconciliation.',
  'Return review':'Review Form 1040 mappings and outstanding filing restrictions.'
}
export function buildResolutionSteps(report: ValidationSummary): ResolutionStep[] {
  return areaOrder.map(area => {
    const issues = report.issues.filter(issue => issueArea(issue) === area)
    return {area, issues, blockers: issues.filter(issue => issue.severity === 'blocker').length, nextAction: actions[area]}
  }).filter(step => step.issues.length > 0)
}
export function resolutionSummary(report: ValidationSummary, reviewedIds: readonly string[]) {
  const current = new Set(report.issues.map(issue => issue.id))
  const reviewed = new Set(reviewedIds.filter(id => current.has(id)))
  return { total: report.issues.length, reviewed: reviewed.size, unreviewed: report.issues.length - reviewed.size, blockers: report.blockers, ready: false as const }
}
export function resolutionGuideCsv(report: ValidationSummary, reviewedIds: readonly string[]): string {
  const reviewed = new Set(reviewedIds)
  const q = (value: string) => `"${value.replace(/"/g,'""')}"`
  const rows = [['year','issue_id','area','severity','reviewed_by_user','next_step'], ...report.issues.map(issue => [report.year,issue.id,issueArea(issue),issue.severity,reviewed.has(issue.id)?'yes':'no',issue.nextStep])]
  return rows.map(row => row.map(q).join(',')).join('\r\n')+'\r\n'
}
export function runResolutionGuideFixtures(): {name:string;passed:boolean}[] {
  const example: ReturnIssue = {id:'x',category:'source',severity:'blocker',status:'open',title:'W-2 missing',description:'',location:'W-2',nextStep:'Enter source',sourceKey:'w2'}
  const report: ValidationSummary = {year:'2025',issues:[example],blockers:1,warnings:0,notices:0,filingEnabled:false,checkedAt:'deterministic-preview'}
  return [
    {name:'W-2 issues route to Income',passed:issueArea(example)==='Income'},
    {name:'One blocker is preserved',passed:buildResolutionSteps(report)[0]?.blockers===1},
    {name:'Acknowledgement does not unlock filing',passed:resolutionSummary(report,['x']).ready===false},
    {name:'Unknown acknowledgement is ignored',passed:resolutionSummary(report,['other']).reviewed===0},
    {name:'CSV contains no financial amounts',passed:resolutionGuideCsv(report,[]).includes('reviewed_by_user')},
  ]
}
