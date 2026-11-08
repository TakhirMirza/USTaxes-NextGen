import { useState } from 'react'
import './NextGen2025SourceLedger.css'

type Wage = { id: number; employer: string; wages: string; withholding: string }
type Props = { year: string; wages: Wage[]; interest: string; payer: string; incomeKinds: string[]; onNavigate: (step: 'income' | 'review') => void }
type LedgerRow = { id: string; source: string; destination: string; amount: number | null; issue: string | null }
const cents = (raw: string): number | null => {
  const value = raw.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, fractional = ''] = value.split('.')
  const result = Number(whole) * 100 + Number(fractional.padEnd(2, '0'))
  return Number.isSafeInteger(result) ? result : null
}
const currency = (amount: number) => (amount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`
export function create2025SourceLedger(year: string, wages: Wage[], interest: string, payer: string, incomeKinds: string[]) {
  const rows: LedgerRow[] = []
  if (incomeKinds.includes('W-2 wages')) {
    if (!wages.length) rows.push({ id: 'w2-missing', source: 'W-2', destination: '1040 1a', amount: null, issue: 'At least one W-2 is required' })
    wages.forEach((w, index) => {
      const wagesAmount = cents(w.wages), withheld = cents(w.withholding)
      rows.push({ id: `w2-${w.id}-1a`, source: `W-2 #${index + 1} Box 1`, destination: '1040 1a', amount: wagesAmount, issue: !w.employer.trim() ? 'Employer label missing' : wagesAmount === null ? 'Invalid Box 1 amount' : null })
      rows.push({ id: `w2-${w.id}-25a`, source: `W-2 #${index + 1} Box 2`, destination: '1040 25a', amount: withheld, issue: withheld === null ? 'Invalid Box 2 amount' : wagesAmount !== null && withheld > wagesAmount ? 'Withholding exceeds wages — verify source' : null })
    })
  }
  if (incomeKinds.includes('1099-INT interest')) rows.push({ id: 'int-2b', source: '1099-INT Box 1', destination: '1040 2b', amount: cents(interest), issue: !payer.trim() ? 'Payer label missing' : cents(interest) === null ? 'Invalid Box 1 amount' : null })
  const unsupported = incomeKinds.filter(k => k !== 'W-2 wages' && k !== '1099-INT interest')
  unsupported.forEach((kind, index) => rows.push({ id: `unsupported-${index}`, source: kind, destination: 'Unmapped', amount: null, issue: 'Tax treatment not implemented' }))
  const totals = ['1040 1a', '1040 2b', '1040 25a'].map(destination => {
    const subset = rows.filter(row => row.destination === destination)
    const complete = subset.every(row => row.amount !== null && !row.issue)
    const total = complete ? subset.reduce((sum, row) => sum + (row.amount || 0), 0) : null
    return { destination, total, count: subset.length }
  })
  return { year, rows, totals, blockers: rows.filter(row => row.issue).length + (year !== '2025' ? 1 : 0), unsupported: unsupported.length }
}
export function sourceLedgerDiagnosticsCsv(ledger: ReturnType<typeof create2025SourceLedger>): string {
  const lines = ['record_id,source_type,target_line,status,diagnostic']
  for (const row of ledger.rows) lines.push([row.id, row.source, row.destination, row.issue ? 'REVIEW' : 'MAPPED', row.issue || ''].map(csvEscape).join(','))
  return lines.join('\r\n') + '\r\n'
}
export default function NextGen2025SourceLedger({ year, wages, interest, payer, incomeKinds, onNavigate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const ledger = create2025SourceLedger(year, wages, interest, payer, incomeKinds)
  const exportDiagnostics = () => {
    const url = URL.createObjectURL(new Blob([sourceLedgerDiagnosticsCsv(ledger)], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `nextgen-${year}-source-ledger-diagnostics.csv`; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="v2-card nextgen-source-ledger" aria-label="Income source to Form 1040 reconciliation ledger">
    <div className="nextgen-ledger-heading"><div><span className="v2-eyebrow">2025 / SOURCE-TO-LINE TRACEABILITY</span><h2>Form 1040 source ledger</h2><p>Trace W-2 and 1099-INT draft entries to their intended federal lines. This is source reconciliation, not a completed tax return.</p></div><button type="button" className="v2-secondary" onClick={exportDiagnostics}>Export diagnostic CSV</button></div>
    <div className="nextgen-ledger-stats"><div><span>Source entries</span><strong>{ledger.rows.length}</strong></div><div><span>Review findings</span><strong>{ledger.blockers}</strong></div><div><span>Unmapped categories</span><strong>{ledger.unsupported}</strong></div></div>
    <div className="nextgen-ledger-totals">{ledger.totals.map(item => <div key={item.destination}><span>Form {item.destination}</span><strong>{item.total === null ? 'Review required' : currency(item.total)}</strong><small>{item.count} source entries</small></div>)}</div>
    <button type="button" className="v2-secondary" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? 'Hide' : 'Show'} source trace ({ledger.rows.length})</button>
    {expanded && <div className="nextgen-ledger-table-wrap"><table><thead><tr><th>Source</th><th>Target</th><th>Draft amount</th><th>Check</th></tr></thead><tbody>{ledger.rows.map(row => <tr key={row.id}><td>{row.source}</td><td>{row.destination}</td><td>{row.amount === null ? '—' : currency(row.amount)}</td><td>{row.issue || 'Mapped'}</td></tr>)}</tbody></table></div>}
    <div className="nextgen-ledger-actions"><button type="button" className="v2-secondary" onClick={() => onNavigate('income')}>Edit income sources</button><button type="button" className="v2-secondary" onClick={() => onNavigate('review')}>Open Form 1040 review</button></div>
    <p className="nextgen-ledger-disclaimer">Diagnostic CSV intentionally excludes amounts, employers and payer names. Filing, PDF generation and e-file remain disabled. W-2 Box 2 maps to Form 1040 line 25a; W-2 Box 1 to line 1a; 1099-INT Box 1 is a candidate for line 2b, subject to applicable IRS rules.</p>
  </section>
}
