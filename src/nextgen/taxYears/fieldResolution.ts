import type { ReturnIssue } from './returnValidationCenter'

export type FieldTarget = { section: string; field: string; sourceKey: string; editable: boolean; reason: string }
export type DraftValue = { issueId: string; sourceKey: string; value: string; note: string }

export function locateIssue(issue: ReturnIssue): FieldTarget {
  const key = issue.sourceKey.toLowerCase()
  const text = `${issue.title} ${issue.location}`.toLowerCase()
  if (issue.category === 'tax-year') return { section: 'Tax year', field: 'Tax year selection', sourceKey: key, editable: false, reason: 'Annual tax rules must be verified before editing calculations.' }
  if (key.includes('w2') || /w-?2|wages|line 1a/.test(text)) return { section: 'Income documents', field: 'W-2 wages / Form 1040 line 1a', sourceKey: key, editable: true, reason: 'Compare against the original W-2; this workspace does not update the W-2.' }
  if (key.includes('1099') || /1099-int|interest|line 2b/.test(text)) return { section: 'Income documents', field: '1099-INT interest / Form 1040 line 2b', sourceKey: key, editable: true, reason: 'Compare against the original 1099-INT; this workspace does not update the document.' }
  if (issue.category === 'cross-form') return { section: 'Schedules', field: issue.location, sourceKey: key, editable: false, reason: 'Fix the upstream schedule first; a transfer cannot be overridden here.' }
  if (issue.category === 'mapping') return { section: 'Form 1040 mapping', field: issue.location, sourceKey: key, editable: false, reason: 'Mapping values must originate from verified upstream inputs and rules.' }
  return { section: 'Return review', field: issue.location, sourceKey: key, editable: false, reason: 'This is a review or filing restriction, not an editable tax amount.' }
}

export function validateDraft(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter a fictional amount to stage a review note.'
  if (!/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(trimmed)) return 'Use a decimal amount with up to two digits after the decimal point.'
  const cents = Math.round(Number(trimmed) * 100)
  if (!Number.isSafeInteger(cents)) return 'Amount is outside the safe numeric range.'
  return null
}

const csvQuote = (s: string) => `"${s.replace(/"/g, '""')}"`
export function draftCsv(year: string, drafts: readonly DraftValue[], issues: readonly ReturnIssue[]): string {
  const byId = new Map(issues.map(issue => [issue.id, issue]))
  const rows = [['tax_year','issue_id','section','field','draft_amount','review_note','status'], ...drafts.filter(d => byId.has(d.issueId)).map(d => {
    const issue = byId.get(d.issueId)!
    const target = locateIssue(issue)
    return [year,d.issueId,target.section,target.field,d.value,d.note,'DRAFT_ONLY_NOT_POSTED']
  })]
  return rows.map(row => row.map(csvQuote).join(',')).join('\r\n')+'\r\n'
}

export function runFieldResolutionFixtures(): {name:string;passed:boolean}[] {
  const base: ReturnIssue = {id:'w2-missing',category:'source',severity:'blocker',status:'open',title:'W-2 missing',description:'',location:'W-2',nextStep:'',sourceKey:'w2'}
  const schedule: ReturnIssue = {...base,id:'schedule',category:'cross-form',sourceKey:'edge:schedule-c',title:'Schedule C transfer'}
  return [
    {name:'W-2 source routes to income documents',passed:locateIssue(base).section==='Income documents'},
    {name:'Schedule transfers cannot be manually overridden',passed:!locateIssue(schedule).editable},
    {name:'Decimal amount with two digits accepted',passed:validateDraft('1200.25')===null},
    {name:'Invalid decimals rejected',passed:validateDraft('12.345')!==null},
    {name:'Empty amounts rejected',passed:validateDraft('')!==null},
    {name:'CSV explicitly labels drafts as not posted',passed:draftCsv('2025',[{issueId:base.id,sourceKey:'w2',value:'100.00',note:'fictional'}],[base]).includes('DRAFT_ONLY_NOT_POSTED')},
    {name:'Unknown issues cannot be exported',passed:draftCsv('2025',[{issueId:'unknown',sourceKey:'x',value:'1',note:''}],[base]).split('\r\n').length===3},
  ]
}
