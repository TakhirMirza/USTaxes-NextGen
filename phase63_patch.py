from pathlib import Path
p=Path('src/components/NextGenUnifiedReturnWorkspace.tsx')
s=p.read_text()
if 'PHASE63_CANONICAL_INCOME' in s:
 print('Phase 63 already installed');raise SystemExit(0)
changes=[
("  const selectedDoc=book.documents.find(d=>d.id===selected)","  // PHASE63_CANONICAL_INCOME: Income is the sole editor for W-2 and 1099-INT.\n  const selectedDoc=book.documents.find(d=>d.id===selected)\n  const incomeReadOnly=selectedDoc?.kind==='W2'||selectedDoc?.kind==='1099-INT'\n  const independentIncome=book.documents.filter(d=>(d.kind==='W2'||d.kind==='1099-INT')&&!d.id.startsWith('legacy_w2_')&&d.id!=='legacy_1099_int_1')"),
("  const add=()=>{\n", "  const add=()=>{\n    if(kind!=='SCHEDULE-C'){setMessage('W-2 and 1099-INT must be entered in Income. Choose Schedule C here.');return}\n"),
("  const addKind=(newKind:DocKind)=>{\n", "  const addKind=(newKind:DocKind)=>{\n    if(newKind!=='SCHEDULE-C'){setMessage('Open Income to add W-2 or 1099-INT. This workspace only edits Schedule C.');return}\n"),
("  const update=(field:FieldKey,value:string)=>{if(!selectedDoc)return;", "  const update=(field:FieldKey,value:string)=>{if(!selectedDoc||selectedDoc.kind!=='SCHEDULE-C')return;"),
("  const rename=(label:string)=>{if(!selectedDoc)return;", "  const rename=(label:string)=>{if(!selectedDoc||selectedDoc.kind!=='SCHEDULE-C')return;"),
("  const remove=()=>{if(!selectedDoc||!confirm", "  const remove=()=>{if(!selectedDoc||selectedDoc.kind!=='SCHEDULE-C'||!confirm"),
("    if(!confirm(`Import ${result.imported}", "    if(independentIncome.length){setMessage('Import blocked: independently created W-2 / 1099-INT documents exist. Export a JSON backup and reconcile them before importing; no documents were replaced.');return}\n    if(!confirm(`Import ${result.imported}"),
("    <div id=\"ng56-documents\"", "    <p><strong>One income editor:</strong> enter W-2 and 1099-INT in the Income tab. This workspace shows read-only copies and edits Schedule C only. Existing independently created income documents remain intact.</p>\n    {independentIncome.length>0&&<p role=\"alert\">{independentIncome.length} independently created income document(s) detected. Automatic synchronization is paused. Export JSON and reconcile manually before relying on the preview.</p>}\n    <div id=\"ng56-documents\""),
("{(Object.keys(KINDS) as DocKind[]).map(k=><option key={k}>{k}</option>)}", "{(Object.keys(KINDS) as DocKind[]).map(k=><option key={k} value={k} disabled={k!=='SCHEDULE-C'}>{k}</option>)}"),
("<button type=\"button\" onClick={add}>Add source</button>", "<button type=\"button\" onClick={add}>Add Schedule C</button>"),
("<input value={selectedDoc.label} maxLength={80} onChange={e=>rename(e.target.value)}/>", "<input value={selectedDoc.label} maxLength={80} readOnly={incomeReadOnly} onChange={e=>rename(e.target.value)}/>"),
("<input inputMode=\"decimal\" placeholder=\"0.00\" value={selectedDoc.fields[key]??''} onChange={e=>update(key,e.target.value)}/>", "<input inputMode=\"decimal\" placeholder=\"0.00\" readOnly={incomeReadOnly} value={selectedDoc.fields[key]??''} onChange={e=>update(key,e.target.value)}/>"),
("<button type=\"button\" onClick={remove}>Delete selected source</button>", "{incomeReadOnly?<p>Read-only Income source. Edit this document in the Income tab; do not edit its projection here.</p>:<button type=\"button\" onClick={remove}>Delete selected Schedule C</button>}"),
("onAddDocument={addKind}", "onAddDocument={addKind}"),
]
for old,new in changes:
 count=s.count(old)
 if count!=1:raise SystemExit(f'Expected one anchor, got {count}: {old[:85]}')
 s=s.replace(old,new,1)
# Default new document kind is Schedule C, since other kinds are now read-only.
s=s.replace("useState<DocKind>('W2')","useState<DocKind>('SCHEDULE-C')",1)
# Ensure JSON imports cannot quietly introduce independently editable income data without a warning.
s=s.replace("setMessage('Imported fictional return into memory. Select Save to persist it.')","setMessage('Imported fictional return into memory. Income documents are read-only here; review independent sources and Save explicitly.')")
p.write_text(s)
print('Phase 63 applied to existing workspace.')
