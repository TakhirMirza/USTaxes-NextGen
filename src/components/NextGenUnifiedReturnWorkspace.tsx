import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { KINDS, LABELS, diagnostics, emptyReturn, exportCsv, fixtures, money, previewLines, storeKey, validateReturn } from '../nextgen/taxYears/unifiedReturnStore'
import type { DocKind, FieldKey, UnifiedReturn } from '../nextgen/taxYears/unifiedReturnStore'
import './NextGenUnifiedReturnWorkspace.css'
import NextGenUnifiedCalculationBridge from './NextGenUnifiedCalculationBridge'
import NextGenReturnWorkflow from './NextGenReturnWorkflow'
function download(text:string,name:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function read(year:string):{book:UnifiedReturn;message:string}{
  try{const raw=localStorage.getItem(storeKey(year));if(!raw)return {book:emptyReturn(year),message:'No fictional return saved for this tax year.'};const result=validateReturn(JSON.parse(raw),year);return result.value?{book:result.value,message:'Fictional return loaded from this browser.'}:{book:emptyReturn(year),message:`Saved data rejected: ${result.error}`}}
  catch{return {book:emptyReturn(year),message:'Browser storage unavailable or saved JSON is invalid.'}}
}
export default function NextGenUnifiedReturnWorkspace({year}:{year:string}){
  const [book,setBook]=useState<UnifiedReturn>(()=>emptyReturn(year))
  const [loadedYear,setLoadedYear]=useState('')
  const [kind,setKind]=useState<DocKind>('W2')
  const [selected,setSelected]=useState('')
  const [message,setMessage]=useState('')
  const [dirty,setDirty]=useState(false)
  const [baseRevision,setBaseRevision]=useState(0)
  useEffect(()=>{const result=read(year);setBook(result.book);setMessage(result.message);setLoadedYear(year);setSelected('');setDirty(false);setBaseRevision(result.book.revision)},[year])
  useEffect(()=>{const listener=(e:StorageEvent)=>{if(e.key===storeKey(year))setMessage('Another tab changed the saved fictional return. Reload before saving to avoid a conflict.')};window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener)},[year])
  const selectedDoc=book.documents.find(d=>d.id===selected)
  const checks=fixtures();const issues=diagnostics(book);const lines=previewLines(book)
  const mutate=(next:UnifiedReturn)=>{setBook({...next,revision:next.revision+1,updatedAt:new Date().toISOString()});setDirty(true);setMessage('Unsaved fictional edits. Review the preview and save explicitly.')}
  const add=()=>{
    const id=`doc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    const next={...book,documents:[...book.documents,{id,kind,label:`Fictional ${kind} ${book.documents.filter(d=>d.kind===kind).length+1}`,fields:{}}]}
    mutate(next);setSelected(id)
  }
  const update=(field:FieldKey,value:string)=>{if(!selectedDoc)return;mutate({...book,documents:book.documents.map(d=>d.id===selected?{...d,fields:{...d.fields,[field]:value}}:d)})}
  const rename=(label:string)=>{if(!selectedDoc)return;mutate({...book,documents:book.documents.map(d=>d.id===selected?{...d,label}:d)})}
  const remove=()=>{if(!selectedDoc||!confirm(`Delete fictional source ${selectedDoc.label}?`))return;mutate({...book,documents:book.documents.filter(d=>d.id!==selected)});setSelected('')}
  const save=()=>{
    if(loadedYear!==year){setMessage('Tax year is loading.');return}
    const validated=validateReturn(book,year)
    if(!validated.value){setMessage(`Cannot save: ${validated.error}`);return}
    try{
      const previous=localStorage.getItem(storeKey(year))
      if(previous){const parsed=validateReturn(JSON.parse(previous),year);if(!parsed.value){setMessage('Saved copy is invalid. Export a backup before changing it.');return}if(parsed.value.revision!==baseRevision){setMessage('Save blocked: another tab has a newer revision. Export this draft and reload.');return}}
      localStorage.setItem(storeKey(year),JSON.stringify(book));setDirty(false);setBaseRevision(book.revision);setMessage(`Saved fictional return revision ${book.revision} for ${year}. No official tax forms changed.`)
    }catch{setMessage('Save failed. Browser storage unavailable; export JSON as backup.')}
  }
  const reload=()=>{if(dirty&&!confirm('Discard unsaved fictional changes and reload?'))return;const result=read(year);setBook(result.book);setSelected('');setDirty(false);setBaseRevision(result.book.revision);setMessage(result.message)}
  const importFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return
    if(file.size>150000){setMessage('File exceeds 150 KB.');return}
    try{const parsed=validateReturn(JSON.parse(await file.text()),year);if(!parsed.value){setMessage(`Import rejected: ${parsed.error}`);return}setBook({...parsed.value,revision:book.revision+1,updatedAt:new Date().toISOString()});setSelected('');setDirty(true);setMessage('Imported fictional return into memory. Select Save to persist it.')}
    catch{setMessage('Invalid JSON import; existing return unchanged.')}
  }
  const reset=()=>{if(!confirm(`Delete locally saved fictional return for ${year}?`))return;try{localStorage.removeItem(storeKey(year));setBook(emptyReturn(year));setSelected('');setDirty(false);setBaseRevision(0);setMessage('Fictional return deleted from browser storage.')}catch{setMessage('Browser storage unavailable.')}}
  return <section className="ng-unified" aria-label="Phase 51 fictional unified return workspace">
    <span className="v2-eyebrow">PHASE 51 / UNIFIED FICTIONAL RETURN</span>
    <h4>Editable source documents &amp; cross-form preview</h4>
    <p><strong>Fictional data only.</strong> This is a separate development store. It does not post edits to existing W-2 / 1099 forms, tax engines, official Form 1040, or filing. Browser storage is unencrypted; never enter real taxpayer information.</p>
    <div className="ng-unified-metrics"><span>{book.documents.length} source documents</span><span>{issues.filter(i=>i.severity==='blocker').length} blockers</span><span>Revision {book.revision}</span><span>{dirty?'Unsaved changes':'Saved / unchanged'}</span><span>{checks.filter(x=>x.passed).length}/{checks.length} checks</span></div>
    <div className="ng-unified-grid"><div className="ng-unified-pane"><h5>Fictional documents — {year}</h5><div className="ng-unified-actions"><select aria-label="New document type" value={kind} onChange={e=>setKind(e.target.value as DocKind)}>{(Object.keys(KINDS) as DocKind[]).map(k=><option key={k}>{k}</option>)}</select><button type="button" onClick={add}>Add source</button></div><div className="ng-unified-list">{book.documents.map(d=><button type="button" key={d.id} aria-pressed={selected===d.id} onClick={()=>setSelected(d.id)}><strong>{d.label}</strong><small>{d.kind} · {d.id}</small></button>)}</div></div>
    <div className="ng-unified-pane"><h5>Source editor</h5>{selectedDoc?<><label>Fictional document label<input value={selectedDoc.label} maxLength={80} onChange={e=>rename(e.target.value)}/></label>{KINDS[selectedDoc.kind].map(key=><label key={key}>{LABELS[key]} (USD)<input inputMode="decimal" placeholder="0.00" value={selectedDoc.fields[key]??''} onChange={e=>update(key,e.target.value)}/></label>)}<button type="button" onClick={remove}>Delete selected source</button></>:<p>Select a source to edit fictional amounts. Empty or invalid values block the preview.</p>}</div></div>
    <h5>Cross-form calculation preview (not a tax return)</h5><div className="ng-unified-scroll"><table><thead><tr><th>Form / line</th><th>Derived amount</th><th>Status</th><th>Source lineage</th></tr></thead><tbody>{lines.map(l=><tr key={l.line}><td>{l.line}: {l.label}</td><td>{money(l.cents)}</td><td>{l.status}</td><td>{l.sources.join(', ')||'No source'}</td></tr>)}</tbody></table></div><p>Only source aggregation and a basic Schedule C arithmetic preview are shown. Self-employment tax, deductions, credits, AGI, taxable income, total tax, refund and e-file are deliberately unavailable.</p>
    <NextGenReturnWorkflow book={book} dirty={dirty} selectedId={selected} onSelectDocument={setSelected} />
    <NextGenUnifiedCalculationBridge book={book} dirty={dirty} />
    <details open={issues.length>0}><summary>Validation findings ({issues.length})</summary><ul>{issues.map((i,index)=><li key={`${i.documentId}-${index}`}><strong>{i.severity}</strong> — {i.message}</li>)}</ul></details>
    <div className="ng-unified-actions"><button type="button" onClick={save}>Save fictional return</button><button type="button" onClick={reload}>Reload saved</button><button type="button" onClick={()=>download(JSON.stringify(book,null,2),`fictional-return-${year}.json`,'application/json')}>Export JSON</button><label className="ng-unified-import">Import JSON<input type="file" accept=".json,application/json" onChange={importFile}/></label><button type="button" onClick={()=>download(exportCsv(book),`fictional-return-${year}.csv`,'text/csv;charset=utf-8')}>Export CSV</button><button type="button" onClick={reset}>Delete saved return</button></div>
    {message&&<p role="status">{message}</p>}
    <details><summary>Phase 51 regression fixtures ({checks.filter(x=>x.passed).length}/{checks.length})</summary><ul>{checks.map(c=><li key={c.name}>{c.passed?'PASS':'FAIL'} — {c.name}</li>)}</ul></details>
  </section>
}
