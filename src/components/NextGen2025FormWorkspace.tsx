import { ReactElement, useState } from 'react'
import './NextGen2025FormWorkspace.css'

type Source = { selected: boolean; valid: boolean; cents: number }
type Line = { number: string; label: string; section: string; source?: 'wages' | 'interest' | 'withholding'; note?: string }
const lines: Line[] = [
  {number:'1a',label:'Wages, salaries, tips',section:'Income',source:'wages'},
  {number:'1z',label:'Total wages',section:'Income',note:'Other wage categories have not been assessed'},
  {number:'2a',label:'Tax-exempt interest',section:'Income'},
  {number:'2b',label:'Taxable interest',section:'Income',source:'interest'},
  {number:'3a',label:'Qualified dividends',section:'Income'},
  {number:'3b',label:'Ordinary dividends',section:'Income'},
  {number:'4a',label:'IRA distributions',section:'Income'},
  {number:'4b',label:'Taxable IRA distributions',section:'Income'},
  {number:'5a',label:'Pensions and annuities',section:'Income'},
  {number:'5b',label:'Taxable pensions and annuities',section:'Income'},
  {number:'6a',label:'Social security benefits',section:'Income'},
  {number:'6b',label:'Taxable social security benefits',section:'Income'},
  {number:'7a',label:'Capital gain or loss',section:'Income'},
  {number:'8',label:'Additional income from Schedule 1',section:'Income'},
  {number:'9',label:'Total income',section:'Income'},
  {number:'10',label:'Adjustments from Schedule 1',section:'Income'},
  {number:'11a',label:'Adjusted gross income',section:'Income'},
  {number:'12e',label:'Standard or itemized deductions',section:'Deductions'},
  {number:'13a',label:'Qualified business income deduction',section:'Deductions'},
  {number:'13b',label:'Additional deductions',section:'Deductions'},
  {number:'14',label:'Total deductions',section:'Deductions'},
  {number:'15',label:'Taxable income',section:'Deductions'},
  {number:'16',label:'Income tax',section:'Tax and credits'},
  {number:'17',label:'Schedule 2 tax',section:'Tax and credits'},
  {number:'18',label:'Tax before credits',section:'Tax and credits'},
  {number:'19',label:'Child tax credit and other dependent credit',section:'Tax and credits'},
  {number:'20',label:'Schedule 3 credits',section:'Tax and credits'},
  {number:'21',label:'Total nonrefundable credits',section:'Tax and credits'},
  {number:'22',label:'Tax after credits',section:'Tax and credits'},
  {number:'23',label:'Other taxes',section:'Tax and credits'},
  {number:'24',label:'Total tax',section:'Tax and credits'},
  {number:'25a',label:'Federal income tax withheld from W-2',section:'Payments',source:'withholding'},
  {number:'25b',label:'Federal withholding from 1099',section:'Payments'},
  {number:'25c',label:'Other federal withholding',section:'Payments'},
  {number:'25d',label:'Total federal withholding',section:'Payments'},
  {number:'26',label:'Estimated tax payments',section:'Payments'},
  {number:'27a',label:'Earned income credit',section:'Payments'},
  {number:'28',label:'Additional child tax credit',section:'Payments'},
  {number:'29',label:'Education credit',section:'Payments'},
  {number:'31',label:'Other refundable credits',section:'Payments'},
  {number:'32',label:'Total other payments and refundable credits',section:'Payments'},
  {number:'33',label:'Total payments',section:'Payments'},
  {number:'34',label:'Overpayment',section:'Refund / amount owed'},
  {number:'35a',label:'Refund requested',section:'Refund / amount owed'},
  {number:'37',label:'Amount owed',section:'Refund / amount owed'}
]
const groups = ['Income','Deductions','Tax and credits','Payments','Refund / amount owed']
const format = (cents: number) => (cents / 100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function NextGen2025FormWorkspace({year,filingStatus,wages,interest,withholding,onNavigate}: {
  year: string; filingStatus: string; wages: Source; interest: Source; withholding: Source;
  onNavigate: (step: 'income' | 'deductions' | 'profile' | 'review') => void
}): ReactElement {
  const [section,setSection] = useState('All sections')
  const [onlyUnresolved,setOnlyUnresolved] = useState(false)
  const [query,setQuery] = useState('')
  const sources = {wages,interest,withholding}
  const visible = lines.filter(line => {
    const source = line.source ? sources[line.source] : null
    const verified = Boolean(source?.selected && source.valid)
    return (section === 'All sections' || line.section === section) &&
      (!onlyUnresolved || !verified) &&
      (`${line.number} ${line.label}`.toLowerCase().includes(query.trim().toLowerCase()))
  })
  const verifiedCount = lines.filter(l=>l.source && sources[l.source].selected && sources[l.source].valid).length
  return <section className="v2-card ng37-workspace" aria-label="2025 Form 1040 interactive draft workspace">
    <div className="ng37-header">
      <div><span className="v2-eyebrow">PHASE 37 / FORM WORKSPACE</span><h2>Form 1040 — line-by-line draft</h2>
        <p>2025 federal form structure with source traceability. Values are shown only for validated fictional source entries; unsupported or unverified lines stay unresolved.</p></div>
      <span className="ng37-stamp">{year} · TEST DRAFT<br/>NOT FOR FILING</span>
    </div>
    <div className="ng37-kpis"><div><small>Filing status</small><strong>{filingStatus.replace(/_/g,' ')}</strong></div><div><small>Verified source lines</small><strong>{verifiedCount} / {lines.length}</strong></div><div><small>Unresolved lines</small><strong>{lines.length-verifiedCount}</strong></div><div><small>Filing</small><strong>Disabled</strong></div></div>
    <div className="ng37-toolbar"><label>Form section<select value={section} onChange={e=>setSection(e.target.value)}><option>All sections</option>{groups.map(g=><option key={g}>{g}</option>)}</select></label>
      <label>Find a line<input aria-label="Search Form 1040 lines" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Line number or description" /></label>
      <label className="ng37-check"><input type="checkbox" checked={onlyUnresolved} onChange={e=>setOnlyUnresolved(e.target.checked)}/>Unresolved only</label>
    </div>
    <div className="ng37-form" role="table" aria-label="Form 1040 draft lines"><div className="ng37-row ng37-heading" role="row"><span>Line</span><span>Form 1040 description</span><span>Source / status</span><span>Draft amount</span><span>Action</span></div>
      {visible.map(l=>{const s=l.source ? sources[l.source] : null;const verified=Boolean(s?.selected && s.valid);const status=verified?'Source validated':s?.selected?'Source incomplete':s?'Not selected':'Not established';const target=l.section==='Deductions'?'deductions':l.section==='Income'||l.section==='Payments'?'income':'review';return <div className="ng37-row" role="row" key={l.number}>
        <strong>{l.number}</strong><span>{l.label}<small>{l.note || (l.source==='wages'?'W-2 Box 1':l.source==='interest'?'1099-INT Box 1':l.source==='withholding'?'W-2 Box 2':'No verified authoritative value')}</small></span>
        <span className={verified?'ng37-status ok':'ng37-status pending'}>{status}</span><strong className="ng37-amount">{verified&&s?format(s.cents):'—'}</strong>
        <button type="button" className="ng37-action" onClick={()=>onNavigate(target)}>{target==='review'?'Review':'Edit source'} →</button></div>})}
      {visible.length===0 && <p className="ng37-empty">No lines match these filters.</p>}
    </div>
    <div className="ng37-footer"><strong>Important:</strong> Validated source entries are not equivalent to IRS-certified tax calculations. No tax, refund, amount owed, PDF, or e-file is generated. Missing amounts are never replaced with zero.</div>
  </section>
}
