import { useState } from 'react'
import { Schedule1040Candidates2025 } from '../nextgen/taxYears/schedules1040Bridge2025'
import { reconcileSETo1040Workpaper2025, SE1040ReviewInput2025 } from '../nextgen/taxYears/se1040Reconciliation2025'

const entries = [
  ['scheduleCProfitCents','Schedule C line 31 — net profit'],
  ['schedule1Line3Cents','Schedule 1 line 3 — business income'],
  ['schedule1OtherIncomeCents','Schedule 1 — other income subtotal'],
  ['schedule1Line10Cents','Schedule 1 line 10 — additional income'],
  ['schedule1Line15Cents','Schedule 1 line 15 — half of SE tax'],
  ['schedule1OtherAdjustmentsCents','Schedule 1 — other adjustments subtotal'],
  ['schedule1Line26Cents','Schedule 1 line 26 — total adjustments'],
  ['scheduleSELine12Cents','Schedule SE line 12 — SE tax'],
  ['scheduleSELine13Cents','Schedule SE line 13 — half of SE tax'],
  ['schedule2Line4Cents','Schedule 2 line 4 — SE tax'],
  ['schedule2OtherTaxesCents','Schedule 2 — other taxes subtotal'],
  ['schedule2Line21Cents','Schedule 2 line 21 — total other taxes'],
  ['form1040Line8Cents','Form 1040 line 8 — additional income'],
  ['form1040Line10Cents','Form 1040 line 10 — adjustments'],
  ['form1040Line23Cents','Form 1040 line 23 — other taxes']
] as const
const reviewEntries = [
  ['scheduleCReviewed','Schedule C profit independently reviewed'],
  ['scheduleSEReviewed','Schedule SE and rounding independently reviewed'],
  ['otherSchedule1IncomeReviewed','Other Schedule 1 income explicitly reviewed (including zero)'],
  ['otherSchedule1AdjustmentsReviewed','Other Schedule 1 adjustments explicitly reviewed (including zero)'],
  ['otherSchedule2TaxesReviewed','Other Schedule 2 taxes explicitly reviewed (including zero)']
] as const

type AmountKey = typeof entries[number][0]
type ReviewKey = typeof reviewEntries[number][0]
const parse = (value: string): number | null => {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim())) return null
  const [whole, fraction=''] = value.trim().split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2,'0'))
  return Number.isSafeInteger(amount) && amount <= 100000000000 ? amount : null
}
const fmt = (amount: number): string => (amount / 100).toFixed(2)
export default function SE1040Workpaper2025({ schedules }: { schedules: Schedule1040Candidates2025 }) {
  const [amounts,setAmounts] = useState<Record<AmountKey,string>>(() => Object.fromEntries(entries.map(([id]) => [id,''])) as Record<AmountKey,string>)
  const [reviewed,setReviewed] = useState<Record<ReviewKey,boolean>>(() => Object.fromEntries(reviewEntries.map(([id]) => [id,false])) as Record<ReviewKey,boolean>)
  const input = {
    ...Object.fromEntries(entries.map(([id]) => [id,parse(amounts[id])])),
    ...reviewed
  } as SE1040ReviewInput2025
  const result = reconcileSETo1040Workpaper2025(input)
  const copyCandidates = () => {
    setAmounts(old => ({...old,
      form1040Line8Cents: schedules.line8 === null ? old.form1040Line8Cents : fmt(schedules.line8),
      form1040Line10Cents: schedules.line10 === null ? old.form1040Line10Cents : fmt(schedules.line10),
      form1040Line23Cents: schedules.line23 === null ? old.form1040Line23Cents : fmt(schedules.line23)
    }))
    setReviewed(Object.fromEntries(reviewEntries.map(([id]) => [id,false])) as Record<ReviewKey,boolean>)
  }
  const exportCsv = () => {
    const quote = (s:string) => '"'+s.replace(/"/g,'""')+'"'
    const rows = [['Source','Target','Amount USD'], ...result.trace.map(x => [x.source,x.target,fmt(x.amountCents)])]
    const content = rows.map(r => r.map(quote).join(',')).join('\r\n')+'\r\n'
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv'}))
    const a=document.createElement('a'); a.href=url; a.download='ustaxes-2025-se-1040-audit.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return <details className="v2-note" aria-label="Schedule SE to Form 1040 reconciliation">
    <summary><strong>Schedule C / SE → Schedule 1 / 2 → Form 1040: cross-form audit</strong></summary>
    <p>Separate review workpaper. Enter verified amounts in USD, including explicit 0.00 where appropriate. This does not change the return or authorize filing. Negative Schedule C profit and special Schedule SE methods are not supported here.</p>
    <button type="button" className="v2-secondary" onClick={copyCandidates}>Copy available Form 1040 candidate amounts (reset confirmations)</button>
    <div className="v2-form-grid">{entries.map(([id,title]) => <label key={id}>{title}<input type="text" inputMode="decimal" placeholder="Amount or 0.00" value={amounts[id]} onChange={e => {
      setAmounts(old => ({...old,[id]:e.target.value}))
      setReviewed(Object.fromEntries(reviewEntries.map(([key]) => [key,false])) as Record<ReviewKey,boolean>)
    }}/></label>)}</div>
    {reviewEntries.map(([id,title]) => <label className="v2-check" key={id}><input type="checkbox" checked={reviewed[id]} onChange={e=>setReviewed(old=>({...old,[id]:e.target.checked}))}/>{title}</label>)}
    <h3>{result.status==='reconciled-not-posted'?'Cross-form arithmetic reconciled — not posted':'Cross-form reconciliation blocked'}</h3>
    {result.blockers.length>0 && <ul className="v2-blockers">{result.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>}
    {result.status==='reconciled-not-posted' && <><div className="v2-review-grid">{result.trace.map(x=><div key={x.target}><span>{x.source} → {x.target}</span><strong>${fmt(x.amountCents)}</strong></div>)}</div><button type="button" className="v2-secondary" onClick={exportCsv}>Export cross-form audit CSV</button></>}
    <p><strong>Safety:</strong> No values are posted to Form 1040. This workpaper only verifies manually supplied cross-form arithmetic; it does not establish eligibility or tax correctness.</p>
  </details>
}
