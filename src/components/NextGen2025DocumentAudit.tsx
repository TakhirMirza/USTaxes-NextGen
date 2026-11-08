import { ReactElement, useMemo, useState } from 'react'
import './NextGen2025DocumentAudit.css'

type WageDocument = { id: number; employer: string; wages: string; withholding: string }
type Finding = { id: string; source: string; level: 'blocker' | 'review' | 'ok'; message: string; destination: 'income' | 'profile' | 'deductions' }
type Props = {
  year: string
  wages: WageDocument[]
  interest: string
  payer: string
  incomeKinds: string[]
  onNavigate: (step: 'income' | 'profile' | 'deductions') => void
}
const cents = (input: string): number | null => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.trim())) return null
  const result = Math.round(Number(input) * 100)
  return Number.isSafeInteger(result) ? result : null
}
export function inspectIncomeDocuments2025(props: Omit<Props, 'onNavigate'>): Finding[] {
  const findings: Finding[] = []
  if (props.year !== '2025') findings.push({ id: 'year', source: 'Tax year', level: 'blocker', message: 'This document control is implemented for tax year 2025 only.', destination: 'profile' })
  if (props.incomeKinds.includes('W-2 wages')) {
    if (!props.wages.length) findings.push({ id: 'w2-none', source: 'W-2', level: 'blocker', message: 'W-2 selected but no documents were entered.', destination: 'income' })
    props.wages.forEach((w, index) => {
      const wage = cents(w.wages), withheld = cents(w.withholding)
      const source = `W-2 #${index + 1}`
      if (!w.employer.trim()) findings.push({ id: `w2-label-${w.id}`, source, level: 'blocker', message: 'Employer label is missing.', destination: 'income' })
      if (wage === null) findings.push({ id: `w2-wages-${w.id}`, source, level: 'blocker', message: 'Box 1 requires a valid nonnegative dollar amount (up to two decimals).', destination: 'income' })
      if (withheld === null) findings.push({ id: `w2-withheld-${w.id}`, source, level: 'blocker', message: 'Box 2 requires a valid nonnegative dollar amount (up to two decimals).', destination: 'income' })
      if (wage !== null && withheld !== null && withheld > wage) findings.push({ id: `w2-unusual-${w.id}`, source, level: 'review', message: 'Box 2 exceeds Box 1. Check the source document; this is not automatically an error.', destination: 'income' })
      if (wage !== null && withheld !== null && w.employer.trim()) findings.push({ id: `w2-entered-${w.id}`, source, level: 'ok', message: 'Required simplified fields entered; tax treatment is not verified.', destination: 'income' })
    })
    const labels = new Map<string, number>()
    props.wages.forEach(w => { const key = w.employer.trim().toLowerCase(); if (key) labels.set(key, (labels.get(key) || 0) + 1) })
    labels.forEach((count, label) => { if (count > 1) findings.push({ id: `w2-repeat-${label}`, source: 'W-2 register', level: 'review', message: 'Multiple W-2 entries share an employer label. Confirm they are distinct documents, not duplicates.', destination: 'income' }) })
  }
  if (props.incomeKinds.includes('1099-INT interest')) {
    if (!props.payer.trim()) findings.push({ id: 'int-payer', source: '1099-INT', level: 'blocker', message: 'Payer label is missing.', destination: 'income' })
    if (cents(props.interest) === null) findings.push({ id: 'int-box1', source: '1099-INT', level: 'blocker', message: 'Box 1 taxable interest requires a valid nonnegative dollar amount.', destination: 'income' })
    if (props.payer.trim() && cents(props.interest) !== null) findings.push({ id: 'int-entered', source: '1099-INT', level: 'ok', message: 'Simplified Box 1 fields entered; other 1099-INT boxes are not supported.', destination: 'income' })
  }
  props.incomeKinds.filter(k => k !== 'W-2 wages' && k !== '1099-INT interest').forEach(kind => findings.push({ id: `unsupported-${kind}`, source: kind, level: 'blocker', message: 'Selected source requires a dedicated tax mapping before it can be included in Form 1040.', destination: 'income' }))
  if (!props.incomeKinds.length) findings.push({ id: 'income-empty', source: 'Income', level: 'review', message: 'No income source is selected. Confirm whether the return has no reportable income.', destination: 'income' })
  return findings
}
const escapeCsv = (s: string): string => `"${s.replace(/"/g, '""')}"`
export default function NextGen2025DocumentAudit(props: Props): ReactElement {
  const [filter, setFilter] = useState<'all' | 'blocker' | 'review' | 'ok'>('all')
  const findings = useMemo(() => inspectIncomeDocuments2025(props), [props.year, props.wages, props.interest, props.payer, props.incomeKinds])
  const visible = findings.filter(f => filter === 'all' || f.level === filter)
  const blocked = findings.filter(f => f.level === 'blocker').length
  const warnings = findings.filter(f => f.level === 'review').length
  const exportCsv = (): void => {
    const rows = [['ID', 'Source type', 'Status', 'Finding'], ...findings.map(f => [f.id, f.source, f.level, f.message])]
    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'nextgen-2025-document-audit.csv'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="v2-card doc-audit" aria-label="Income document audit">
    <div className="doc-audit-heading"><div><span className="v2-eyebrow">SOURCE DOCUMENT CONTROL / 2025</span><h2>Document completeness &amp; exceptions</h2><p>Review W-2, 1099-INT and unsupported sources before Form 1040 reconciliation. No source labels or financial amounts appear in the audit export.</p></div><button type="button" className="v2-secondary" onClick={exportCsv}>Export audit CSV</button></div>
    <div className="doc-audit-stats"><div><span>Blocking fields</span><strong>{blocked}</strong></div><div><span>Review notices</span><strong>{warnings}</strong></div><div><span>Document checks</span><strong>{findings.length}</strong></div></div>
    <div className="doc-audit-filters" role="group" aria-label="Filter document findings">{(['all', 'blocker', 'review', 'ok'] as const).map(item => <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item === 'blocker' ? 'Blocking' : item === 'review' ? 'Review' : 'Entered'}</button>)}</div>
    <div className="doc-audit-findings">{visible.length ? visible.map(f => <div className="doc-audit-finding" key={f.id}><span className={`doc-audit-level ${f.level}`}>{f.level === 'ok' ? 'Entered' : f.level === 'review' ? 'Review' : 'Blocked'}</span><div><strong>{f.source}</strong><p>{f.message}</p></div><button type="button" onClick={() => props.onNavigate(f.destination)}>Open →</button></div>) : <p className="doc-audit-empty">No findings match this filter.</p>}</div>
    <p className="legacy-register-footnote">Completeness is not tax-law verification. Secure persistence, complete tax rules, PDF filing and e-file are not enabled.</p>
  </section>
}
