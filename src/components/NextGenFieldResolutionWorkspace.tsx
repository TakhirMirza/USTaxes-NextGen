import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ReturnIssue } from '../nextgen/taxYears/returnValidationCenter'
import { draftCsv, locateIssue, runFieldResolutionFixtures, validateDraft } from '../nextgen/taxYears/fieldResolution'
import type { DraftValue } from '../nextgen/taxYears/fieldResolution'
import { emptyBook, parseBook, runPersistenceFixtures, serializeBook, storageKey } from '../nextgen/taxYears/fictionalDraftStore'
import './NextGenFieldResolutionWorkspace.css'
import './NextGenFictionalDraftPersistence.css'
import NextGenUnifiedReturnWorkspace from './NextGenUnifiedReturnWorkspace'

function download(content: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], {type:mime}))
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function load(year:string): {entries:DraftValue[];message:string} {
  try {
    const raw=window.localStorage.getItem(storageKey(year))
    if (!raw) return {entries:[],message:'No locally saved fictional drafts for this year.'}
    const result=parseBook(raw,year)
    return {entries:result.book.entries,message:result.error ?? `Loaded ${result.book.entries.length} fictional drafts from this browser.`}
  } catch { return {entries:[],message:'Browser storage is unavailable. Session-only drafts remain possible.'} }
}
export default function NextGenFieldResolutionWorkspace({year,issues}:{year:string;issues:ReturnIssue[]}) {
  const [selected,setSelected]=useState('')
  const [drafts,setDrafts]=useState<DraftValue[]>([])
  const [amount,setAmount]=useState('')
  const [note,setNote]=useState('')
  const [filter,setFilter]=useState('all')
  const [message,setMessage]=useState('')
  const [loadedYear,setLoadedYear]=useState('')
  const fileRef=useRef<HTMLInputElement>(null)
  const active=issues.find(i=>i.id===selected)
  const target=active?locateIssue(active):null
  const fixtures=[...runFieldResolutionFixtures(),...runPersistenceFixtures()]
  const visible=issues.filter(i=>filter==='all'||locateIssue(i).section===filter)
  const sections=[...new Set(issues.map(i=>locateIssue(i).section))]
  useEffect(()=>{
    const result=load(year);setDrafts(result.entries);setMessage(result.message);setLoadedYear(year)
    setSelected('');setAmount('');setNote('')
  },[year])
  useEffect(()=>{
    const onStorage=(e:StorageEvent)=>{
      if(e.key!==storageKey(year))return
      setMessage('Drafts changed in another tab. Select Reload to review the latest saved version.')
    }
    window.addEventListener('storage',onStorage)
    return ()=>window.removeEventListener('storage',onStorage)
  },[year])
  const selectIssue=(issue:ReturnIssue)=>{
    setSelected(issue.id)
    const d=drafts.find(d=>d.issueId===issue.id)
    setAmount(d?.value??'');setNote(d?.note??'');setMessage('')
  }
  const stage=()=>{
    if(!active||!target?.editable)return
    const error=validateDraft(amount)
    if(error){setMessage(error);return}
    if(note.length>1000){setMessage('Review note must be 1000 characters or fewer.');return}
    setDrafts(current=>[...current.filter(d=>d.issueId!==active.id),{issueId:active.id,sourceKey:active.sourceKey,value:amount.trim(),note:note.trim()}])
    setMessage('Fictional correction staged in memory. Select Save to browser to persist it. No tax forms or calculations were changed.')
  }
  const save=()=>{
    if(loadedYear!==year){setMessage('Year is still loading.');return}
    try{window.localStorage.setItem(storageKey(year),serializeBook(year,drafts));setMessage(`Saved ${drafts.length} fictional drafts locally for ${year}. Not posted to tax forms.`)}
    catch{setMessage('Local save failed (storage unavailable or full). Export JSON to preserve fictional drafts.')}
  }
  const reload=()=>{const result=load(year);setDrafts(result.entries);setSelected('');setAmount('');setNote('');setMessage(result.message)}
  const clearSaved=()=>{
    if(!window.confirm(`Delete locally saved fictional drafts for ${year}? This does not alter tax forms.`))return
    try{window.localStorage.removeItem(storageKey(year));setDrafts([]);setSelected('');setAmount('');setNote('');setMessage('Saved fictional drafts for this year deleted. Tax forms unchanged.')}
    catch{setMessage('Browser storage could not be cleared.')}
  }
  const importJson=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value=''
    if(!file)return
    if(file.size>150000){setMessage('Import rejected: file exceeds 150 KB.');return}
    try{
      const result=parseBook(await file.text(),year)
      if(result.error){setMessage(result.error);return}
      setDrafts(result.book.entries);setSelected('');setAmount('');setNote('')
      setMessage(`Imported ${result.book.entries.length} fictional drafts into memory. Select Save to browser to persist. Existing tax forms are unchanged.`)
    }catch{setMessage('Could not read the import file.')}
  }
  const currentDrafts=drafts.filter(d=>issues.some(i=>i.id===d.issueId))
  return <section className="ng-field-workspace" aria-label="Fictional field review and draft persistence">
    <span className="v2-eyebrow">PHASE 50 / FICTIONAL DRAFT PERSISTENCE</span>
    <h4>Field review, local persistence &amp; portable drafts</h4>
    <p><strong>Development preview — fictional data only.</strong> Browser storage is not encrypted and is not appropriate for real taxpayer information. This workspace does not edit W-2, 1099, Form 1040, or calculations. Filing remains disabled.</p>
    <div className="ng-field-stats"><span>{issues.length} findings</span><span>{currentDrafts.length} staged for current findings</span><span>{drafts.length-currentDrafts.length} historical/unmatched drafts</span><span>{fixtures.filter(f=>f.passed).length}/{fixtures.length} checks</span></div>
    <div className="ng-field-layout">
      <div><label>Issue area<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All areas</option>{sections.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <div className="ng-field-issues">{visible.map(i=><button type="button" key={i.id} aria-pressed={selected===i.id} className={selected===i.id?'selected':''} onClick={()=>selectIssue(i)}><strong>{i.title}</strong><small>{locateIssue(i).section} · {i.severity}{drafts.some(d=>d.issueId===i.id)?' · staged':''}</small></button>)}</div>
      </div>
      <div className="ng-field-editor">{active&&target?<><h5>{target.section}</h5><p><strong>Target:</strong> {target.field}</p><p><strong>Source:</strong> {target.sourceKey}</p><p>{target.reason}</p><p><strong>Next step:</strong> {active.nextStep}</p>
        {target.editable?<><label>Fictional amount (USD)<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="1250.00" /></label><label>Fictional review note<textarea rows={3} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} /></label><button type="button" onClick={stage}>Stage fictional draft</button></>:<p className="ng-field-locked">Read-only dependency. Fix upstream source; manual overrides are disabled.</p>}
      </>:<p>Select a finding to inspect its source and stage a fictional review draft.</p>}</div>
    </div>
    <div className="ng-persist-controls"><h5>Local fictional draft management — tax year {year}</h5><p>Drafts are separated by tax year and saved only when you select Save. Import replaces the in-memory draft list, not the source forms.</p>
      <div className="ng-field-actions"><button type="button" onClick={save}>Save to browser</button><button type="button" onClick={reload}>Reload saved</button><button type="button" onClick={()=>download(serializeBook(year,drafts),`nextgen-fictional-drafts-${year}.json`,'application/json')}>Export JSON</button><button type="button" onClick={()=>fileRef.current?.click()}>Import JSON</button><button type="button" onClick={()=>download(draftCsv(year,drafts,issues),`nextgen-draft-review-${year}.csv`,'text/csv;charset=utf-8')}>Export CSV</button><button type="button" onClick={clearSaved}>Delete saved drafts</button></div>
      <input ref={fileRef} type="file" accept=".json,application/json" onChange={importJson} className="ng-persist-file" aria-label="Import fictional draft JSON" />
    </div>
    {message&&<p role="status" className="ng-persist-status">{message}</p>}
    <NextGenUnifiedReturnWorkspace year={year} />
    <details><summary>Regression checks ({fixtures.filter(f=>f.passed).length}/{fixtures.length})</summary><ul>{fixtures.map(f=><li key={f.name}>{f.passed?'PASS':'FAIL'} — {f.name}</li>)}</ul></details>
  </section>
}
