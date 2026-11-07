import { ReactElement, useEffect, useMemo, useState } from 'react'
import { Schedule1040Candidates2025 } from '../nextgen/taxYears/schedules1040Bridge2025'
import { create2025Schedule1Worksheet, Schedule1Entry2025 } from '../nextgen/taxYears/schedule1Worksheet2025'
import { review2025Schedules2And3, ReviewedAmount2025 } from '../nextgen/taxYears/schedule2And3Review2025'

type Section = 's1income' | 's1adjustments' | 's2additional' | 's2other' | 's3credits' | 's3payments'
type Entry = { id: number; section: Section; line: string; description: string; amount: string; source: string; reviewed: boolean }
const sections: { id: Section; title: string; lines: string[]; form1040: string }[] = [
  { id: 's1income', title: 'Schedule 1 — Additional income', lines: ['1','2a','3','4','5','6','7','8a','8b','8c','8d','8e','8f','8g','8h','8i','8j','8k','8l','8m','8n','8o','8p','8q','8r','8s','8t','8u','8z'], form1040: '8' },
  { id: 's1adjustments', title: 'Schedule 1 — Adjustments to income', lines: ['11','12','13','14','15','16','17','18','19a','20','21','23','24a','24b','24c','24d','24e','24f','24g','24h','24i','24j','24k','24z'], form1040: '10' },
  { id: 's2additional', title: 'Schedule 2 — Part I: Additional taxes', lines: ['1a','1b','1c','1d','1e','1f','1g','1h','1i','1j','1k','1l','1m','1n','1o','1p','1q','1r','1s','1t','1u','1v','1w','1x','1y','1z','2'], form1040: '17' },
  { id: 's2other', title: 'Schedule 2 — Part II: Other taxes', lines: ['4','5','6','7','8','9','10','11','12','13','14','15','16','17a','17b','17c','17d','17e','17f','17g','17h','17i','17j','17k','17l','17m','17n','17o','17p','17q','17z','18','19','20'], form1040: '23' },
  { id: 's3credits', title: 'Schedule 3 — Part I: Nonrefundable credits', lines: ['1','2','3','4','5a','5b','6a','6b','6c','6d','6e','6f','6g','6h','6i','6j','6k','6l','6m','6z'], form1040: '20' },
  { id: 's3payments', title: 'Schedule 3 — Part II: Other payments and refundable credits', lines: ['9','10','11','12','13a','13b','13c','13d','13z'], form1040: '31' }
]
const parseCents = (raw: string): number | null => {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(raw.trim())) return null
  const [whole, fraction = ''] = raw.trim().split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(result) ? result : null
}
const currency = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export default function NextGen2025Schedules({ onReconcile }: { onReconcile?: (value: Schedule1040Candidates2025) => void }): ReactElement {
  // Deliberately in-memory: the current static frontend has no secure taxpayer database.
  const [entries, setEntries] = useState<Entry[]>([])
  const [nextId, setNextId] = useState(1)
  const [duplicatePaymentsConfirmed, setDuplicatePaymentsConfirmed] = useState(false)
  const [creditOrderingConfirmed, setCreditOrderingConfirmed] = useState(false)
  const add = (section: Section) => {
    setEntries(old => [...old, { id: nextId, section, line: sections.find(s => s.id === section)!.lines[0], description: '', amount: '', source: '', reviewed: false }])
    setNextId(n => n + 1)
  }
  const update = (id: number, changes: Partial<Entry>) => setEntries(old => old.map(e => e.id === id ? { ...e, ...changes, reviewed: false } : e))
  const summaries = useMemo(() => sections.map(s => {
    const selected = entries.filter(e => e.section === s.id)
    const invalid = selected.filter(e => parseCents(e.amount) === null || !e.description.trim() || !e.source.trim() || !e.reviewed)
    const cents = selected.reduce((sum, e) => sum + (parseCents(e.amount) || 0), 0)
    return { ...s, selected, invalid, cents }
  }), [entries])
  const allValid = summaries.every(s => s.invalid.length === 0)
  const schedule1 = useMemo(() => {
    if (!allValid) return null
    const selected = entries.filter(e => e.section === 's1income' || e.section === 's1adjustments')
    return create2025Schedule1Worksheet(selected.map(e => ({ line: e.line, amount: (parseCents(e.amount) || 0) / 100, description: e.description } as Schedule1Entry2025)))
  }, [entries, allValid])
  const reviewed = (section: Section): ReviewedAmount2025 => {
    const s = summaries.find(x => x.id === section)!
    return { amount: s.invalid.length ? null : s.cents / 100, reviewed: !s.invalid.length, sourceReference: s.invalid.length ? null : (s.selected.length ? s.selected.map(e => e.source).join('; ') : 'No entries — zero reviewed') }
  }
  const review = review2025Schedules2And3({
    schedule2PartIAdditionalTax: reviewed('s2additional'), schedule2PartIIOtherTaxes: reviewed('s2other'),
    schedule3PartINonrefundableCredits: reviewed('s3credits'), schedule3PartIIRefundableCreditsAndPayments: reviewed('s3payments'),
    noDuplicatePaymentsConfirmed: duplicatePaymentsConfirmed, creditOrderingConfirmed
  })
  const candidateSnapshot = useMemo((): Schedule1040Candidates2025 => ({
    line8: schedule1 ? schedule1.otherIncome : null,
    line10: schedule1 ? schedule1.adjustments : null,
    line17: review.candidates.form1040Line17,
    line20: review.candidates.form1040Line20,
    line23: review.candidates.form1040Line23,
    line31: review.candidates.form1040Line31,
    blocked: !allValid || review.blockers.length > 0,
    entryCount: entries.length
  }), [schedule1, review.candidates.form1040Line17, review.candidates.form1040Line20, review.candidates.form1040Line23, review.candidates.form1040Line31, review.blockers.length, allValid, entries.length])
  useEffect(() => { if (onReconcile) onReconcile(candidateSnapshot) }, [onReconcile, candidateSnapshot])
  return <section className="v2-card" aria-label="2025 IRS Schedules 1 2 and 3">
    <span className="v2-eyebrow">IRS TAX YEAR 2025</span><h2>Schedules 1, 2 and 3</h2>
    <p>Enter source-supported amounts on their official IRS lines. Multiple records may be entered for a line. A source reference and explicit review are required for every record. This module does not determine eligibility or automatically post amounts to Form 1040.</p>
    {summaries.map(section => <div className="v2-income-block" key={section.id}>
      <h3>{section.title}</h3><p>Candidate destination: Form 1040 line {section.form1040}. {section.invalid.length ? `${section.invalid.length} record(s) need review.` : 'All entered records reviewed.'}</p>
      {section.selected.map(entry => <div className="v2-wage" key={entry.id}>
        <div className="v2-wage-title"><strong>Source #{entry.id}</strong><button type="button" className="v2-text-button" onClick={() => setEntries(old => old.filter(e => e.id !== entry.id))}>Remove</button></div>
        <div className="v2-form-grid">
          <label>IRS line<select value={entry.line} onChange={e => update(entry.id, { line: e.target.value })}>{section.lines.map(line => <option key={line} value={line}>{line}</option>)}</select></label>
          <label>Amount ($)<input inputMode="decimal" value={entry.amount} onChange={e => update(entry.id, { amount: e.target.value })} placeholder="0.00" /></label>
          <label>Income, tax or credit description<input value={entry.description} onChange={e => update(entry.id, { description: e.target.value })} /></label>
          <label>Supporting form / source reference<input value={entry.source} onChange={e => update(entry.id, { source: e.target.value })} placeholder="e.g. 1099-G / Schedule C" /></label>
        </div>
        <label className="v2-check"><input type="checkbox" checked={entry.reviewed} onChange={e => setEntries(old => old.map(item => item.id === entry.id ? { ...item, reviewed: e.target.checked } : item))} />I verified this amount, classification and supporting document.</label>
      </div>)}
      <button type="button" className="v2-secondary" onClick={() => add(section.id)} disabled={entries.length >= 250}>+ Add source</button>
      <p><strong>Reviewed candidate total: {section.invalid.length ? 'Pending validation' : currency(section.cents)}</strong></p>
    </div>)}
    <label className="v2-check"><input type="checkbox" checked={duplicatePaymentsConfirmed} onChange={e => setDuplicatePaymentsConfirmed(e.target.checked)} />I checked Schedule 3 payments for duplication with withholding and refundable child tax credits.</label>
    <label className="v2-check"><input type="checkbox" checked={creditOrderingConfirmed} onChange={e => setCreditOrderingConfirmed(e.target.checked)} />I checked the order and limits of nonrefundable credits, including Schedule 8812.</label>
    <h3>Form 1040 reconciliation candidates</h3>
    <div className="v2-review-grid">
      <div><span>Line 8 — Schedule 1 additional income</span><strong>{schedule1 ? currency(Math.round(schedule1.otherIncome * 100)) : 'Pending review'}</strong></div>
      <div><span>Line 10 — Schedule 1 adjustments</span><strong>{schedule1 ? currency(Math.round(schedule1.adjustments * 100)) : 'Pending review'}</strong></div>
      {Object.entries(review.candidates).filter(([key]) => key.startsWith('form1040')).map(([key, value]) => <div key={key}><span>Form 1040 line {key.replace('form1040Line', '')}</span><strong>{value === null ? 'Pending review' : currency(Math.round(value * 100))}</strong></div>)}
    </div>
    <div className="v2-note"><strong>Posting and filing remain blocked.</strong> IRS line-specific eligibility, cross-form interactions, and complete Form 1040 reconciliation must be implemented and verified before these amounts can affect a filed return. {review.blockers.join(' ')}</div>
  </section>
}
