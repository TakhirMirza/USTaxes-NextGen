import { useMemo, useState } from 'react'
import type { DocKind, UnifiedReturn } from '../nextgen/taxYears/unifiedReturnStore'
import { actionCsv, manageReturn, managementFixtures } from '../nextgen/taxYears/returnManagement'
import './NextGenReturnManagement.css'
type Props={book:UnifiedReturn;dirty:boolean;selectedId:string;onSelectDocument:(id:string)=>void;onAddDocument:(kind:DocKind)=>void;onSave:()=>void;onReload:()=>void}
function download(content:string,filename:string){const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export default function NextGenReturnManagement({book,dirty,selectedId,onSelectDocument,onAddDocument,onSave,onReload}:Props){
 const [filter,setFilter]=useState<'all'|'documents'|'fields'|'review'|'save'>('all')
 const [search,setSearch]=useState('')
 const [showNotices,setShowNotices]=useState(true)
 const summary=useMemo(()=>manageReturn(book,dirty),[book,dirty])
 const checks=useMemo(()=>managementFixtures(),[])
 const actions=summary.actions.filter(a=>(filter==='all'||a.group===filter)&&(showNotices||a.severity==='blocker')&&`${a.title} ${a.detail}`.toLowerCase().includes(search.toLowerCase()))
 return <section className="ng-management" aria-label="Phase 55 return management">
  <span className="v2-eyebrow">PHASE 55 / RETURN MANAGEMENT</span><h4>One return, one workflow — {book.taxYear}</h4>
  <p><strong>Fictional-data development preview.</strong> Manage source documents, review missing fields, and save this year. Tax-law calculations, final Form 1040, PDF and filing are unavailable.</p>
  <div className="ng-management-stats"><div><strong>{summary.documents}</strong><span>Documents</span></div><div><strong>{summary.completeDocuments}</strong><span>Complete sources</span></div><div><strong>{summary.blockers}</strong><span>Source blockers</span></div><div><strong>{summary.previewLines}</strong><span>Preview lines</span></div><div><strong>{summary.unavailableLines}</strong><span>Unavailable lines</span></div></div>
  <div className="ng-management-actions"><button type="button" onClick={()=>onAddDocument('W2')}>+ Fictional W-2</button><button type="button" onClick={()=>onAddDocument('1099-INT')}>+ 1099-INT</button><button type="button" onClick={()=>onAddDocument('SCHEDULE-C')}>+ Schedule C</button><button type="button" onClick={onSave} disabled={!dirty}>Save current year</button><button type="button" onClick={onReload}>Reload saved year</button></div>
  <h5>Document inventory</h5><div className="ng-management-inventory">{book.documents.length===0?<p>No fictional sources added yet.</p>:book.documents.map(d=>{const count=Object.keys(d.fields).filter(k=>d.fields[k as keyof typeof d.fields]!==''&&d.fields[k as keyof typeof d.fields]!==undefined).length;return <button type="button" key={d.id} className={selectedId===d.id?'ng-management-selected':''} onClick={()=>onSelectDocument(d.id)}><strong>{d.label}</strong><small>{d.kind} · {count} entered fields · {selectedId===d.id?'Selected':'Select to edit'}</small></button>})}</div>
  <h5>Action queue</h5><div className="ng-management-filters"><select aria-label="Filter action group" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All sections</option><option value="documents">Documents</option><option value="fields">Fields</option><option value="review">Review</option><option value="save">Save</option></select><input aria-label="Search return actions" placeholder="Search actions" value={search} onChange={e=>setSearch(e.target.value)}/><label><input type="checkbox" checked={showNotices} onChange={e=>setShowNotices(e.target.checked)}/> Include notices</label></div>
  <div className="ng-management-queue">{actions.length===0?<p>No actions match the selected filters.</p>:actions.map(a=><div key={a.id} className="ng-management-item"><div><strong>{a.severity==='blocker'?'BLOCKER':'NOTICE'} · {a.title}</strong><p>{a.detail}</p></div>{a.documentId?<button type="button" onClick={()=>onSelectDocument(a.documentId!)}>Edit source</button>:a.kind?<button type="button" onClick={()=>onAddDocument(a.kind!)}>Add source</button>:null}</div>)}</div>
  <div className="ng-management-actions"><button type="button" onClick={()=>download(actionCsv(book.taxYear,summary),`fictional-return-actions-${book.taxYear}.csv`)}>Export action CSV</button><span>{dirty?'Unsaved changes in current year':'No unsaved edits'} · Official filing disabled</span></div>
  <details><summary>Phase 55 regression checks ({checks.filter(c=>c.passed).length}/{checks.length})</summary><ul>{checks.map(c=><li key={c.name}>{c.passed?'PASS':'FAIL'} — {c.name}</li>)}</ul></details>
 </section>
}
