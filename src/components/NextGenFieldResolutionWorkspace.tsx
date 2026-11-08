import { useState } from 'react'
import type { ReturnIssue } from '../nextgen/taxYears/returnValidationCenter'
import { draftCsv, locateIssue, runFieldResolutionFixtures, validateDraft } from '../nextgen/taxYears/fieldResolution'
import type { DraftValue } from '../nextgen/taxYears/fieldResolution'
import './NextGenFieldResolutionWorkspace.css'

function saveCsv(csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'nextgen-phase49-field-review-drafts.csv'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function NextGenFieldResolutionWorkspace({ year, issues }: {year:string;issues:ReturnIssue[]}) {
  const [selected, setSelected] = useState('')
  const [drafts, setDrafts] = useState<DraftValue[]>([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('')
  const active = issues.find(issue => issue.id === selected)
  const target = active ? locateIssue(active) : null
  const fixtures = runFieldResolutionFixtures()
  const visible = issues.filter(issue => filter === 'all' || locateIssue(issue).section === filter)
  const sections = [...new Set(issues.map(issue => locateIssue(issue).section))]
  const selectIssue = (issue: ReturnIssue) => {
    setSelected(issue.id)
    const existing = drafts.find(d => d.issueId === issue.id)
    setAmount(existing?.value ?? '')
    setNote(existing?.note ?? '')
    setMessage('')
  }
  const stage = () => {
    if (!active || !target?.editable) return
    const error = validateDraft(amount)
    if (error) { setMessage(error); return }
    setDrafts(current => [...current.filter(d => d.issueId !== active.id), { issueId: active.id, sourceKey: active.sourceKey, value: amount.trim(), note: note.trim() }])
    setMessage('Fictional review draft saved in this browser session only. The source document, calculation, validation finding and filing status are unchanged.')
  }
  return <section className="ng-field-workspace" aria-label="Field review workspace">
    <span className="v2-eyebrow">PHASE 49 / FIELD RESOLUTION</span>
    <h4>Form field review &amp; source correction planning</h4>
    <p>Find the source area for a validation issue and stage fictional correction notes. <strong>No draft edits the return, updates a form, or clears a blocker.</strong></p>
    <div className="ng-field-stats"><span>{issues.length} open findings</span><span>{drafts.filter(d => issues.some(i => i.id === d.issueId)).length} local drafts</span><span>{fixtures.filter(f => f.passed).length}/{fixtures.length} checks passed</span></div>
    <div className="ng-field-layout">
      <div><label>Issue area <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All areas</option>{sections.map(section => <option key={section} value={section}>{section}</option>)}</select></label>
        <div className="ng-field-issues">{visible.map(issue => <button type="button" key={issue.id} aria-pressed={selected === issue.id} className={selected === issue.id ? 'selected' : ''} onClick={() => selectIssue(issue)}><strong>{issue.title}</strong><small>{locateIssue(issue).section} · {issue.severity}{drafts.some(d=>d.issueId===issue.id)?' · draft staged':''}</small></button>)}</div>
      </div>
      <div className="ng-field-editor">{active && target ? <>
        <h5>{target.section}</h5><p><strong>Target:</strong> {target.field}</p><p><strong>Source key:</strong> {target.sourceKey}</p><p>{target.reason}</p><p><strong>Required action:</strong> {active.nextStep}</p>
        {target.editable ? <><label>Fictional draft amount (USD)<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 1250.00" /></label><label>Review note<textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe the source document to verify" /></label><button type="button" onClick={stage}>Stage local draft</button></> : <p className="ng-field-locked">Read-only dependency. Correct the source in the appropriate form; manual overrides are not supported.</p>}
        {message && <p role="status">{message}</p>}
      </> : <p>Select an issue to see its target field and next step.</p>}</div>
    </div>
    <div className="ng-field-actions"><button type="button" disabled={drafts.length===0} onClick={()=>saveCsv(draftCsv(year,drafts,issues))}>Export draft review CSV</button><button type="button" disabled={drafts.length===0} onClick={()=>{setDrafts([]);setAmount('');setNote('');setMessage('All local drafts cleared.')}}>Clear all local drafts</button></div>
    <details><summary>Phase 49 regression checks ({fixtures.filter(f=>f.passed).length}/{fixtures.length})</summary><ul>{fixtures.map(f=><li key={f.name}>{f.passed?'PASS':'FAIL'} — {f.name}</li>)}</ul></details>
  </section>
}
