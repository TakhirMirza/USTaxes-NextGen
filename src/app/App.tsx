import { ReactElement, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { computeReturn } from '../engine/compute.ts'
import type { Issue, TaxReturnResult } from '../engine/compute.ts'
import { emptyReturn, normalizeReturn } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { AboutStep, DeductionsStep, IncomeStep, PaymentsStep } from './steps'
import type { Setter } from './steps'
import { ReviewStep } from './review'
import { usd } from './fields'
import './app.css'

const STORAGE_KEY = 'ustaxes-nextgen:return-2025'

const STEPS = [
  { path: 'about', title: 'About you', blurb: 'Filing status and household' },
  { path: 'income', title: 'Income', blurb: 'W-2, 1099, retirement, business' },
  { path: 'deductions', title: 'Deductions', blurb: 'Adjustments, new 2025 deductions, Schedule A' },
  { path: 'payments', title: 'Credits & payments', blurb: 'EIC, child, care, education credits' },
  { path: 'review', title: 'Review', blurb: 'Form 1040, schedules, save' }
] as const
type StepPath = (typeof STEPS)[number]['path']
const stepForIssue: Record<Issue['step'], StepPath> = { about: 'about', income: 'income', deductions: 'deductions', credits: 'payments', review: 'review' }

function load(): TaxReturnInput {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeReturn(JSON.parse(raw)) : emptyReturn()
  } catch {
    return emptyReturn()
  }
}

function Summary({ result, open, onToggle }: { result: TaxReturnResult; open: boolean; onToggle: () => void }): ReactElement {
  const s = result.summary
  const owes = s.amountOwed > 0
  const headline = owes ? 'You owe' : s.refund > 0 ? 'Your refund' : 'Balance'
  const amount = owes ? s.amountOwed : s.refund
  const rows: [string, number][] = [
    ['Total income', s.totalIncome],
    ['Adjusted gross income', s.agi],
    ['Deductions', result.f1040['14']],
    ['Taxable income', s.taxableIncome],
    ['Total tax', s.totalTax],
    ['Payments and refundable credits', s.totalPayments]
  ]
  return (
    <aside className={`summary ${owes ? 'is-owed' : 'is-refund'} ${open ? 'is-open' : ''}`} aria-label="Return summary">
      <button type="button" className="summary-bar" onClick={onToggle} aria-expanded={open}>
        <span>{headline}</span>
        <strong>{usd(amount)}</strong>
      </button>
      <div className="summary-body">
        <p className="summary-label">{headline}</p>
        <p className="summary-amount" aria-live="polite">{usd(amount)}</p>
        <p className="summary-rates">
          {(s.effectiveRate * 100).toFixed(1)}% effective rate, {(s.marginalRate * 100).toFixed(0)}% bracket
        </p>
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{usd(value)}</dd></div>
          ))}
        </dl>
        <p className="summary-foot">Federal return, tax year 2025. Estimate only: check every number before you file.</p>
      </div>
    </aside>
  )
}

function Workspace(): ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const [ret, setRet] = useState<TaxReturnInput>(load)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const result = useMemo(() => computeReturn(ret), [ret])
  const set: Setter = (fn) => setRet((r) => fn(r))

  useEffect(() => {
    const t = window.setTimeout(() => {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ret)) } catch { /* storage unavailable: keep working in memory */ }
    }, 250)
    return () => window.clearTimeout(t)
  }, [ret])

  const current = (STEPS.find((s) => location.pathname === `/${s.path}`)?.path ?? 'about') as StepPath
  const index = STEPS.findIndex((s) => s.path === current)
  const go = (path: StepPath): void => { navigate(`/${path}`); window.scrollTo({ top: 0 }) }
  const issueCount = (path: StepPath): number => result.issues.filter((i) => i.level !== 'info' && stepForIssue[i.step] === path).length
  const props = { ret, set, result }
  const step = STEPS[index]

  return (
    <div className="app">
      <header className="masthead">
        <a className="brand" href="#/about">
          <span className="brand-mark" aria-hidden="true">1040</span>
          <span>USTaxes <em>NextGen</em></span>
        </a>
        <p className="masthead-note">2025 federal return · private, runs in your browser</p>
      </header>

      <nav className="steps" aria-label="Return steps">
        <ol>
          {STEPS.map((s, i) => {
            const n = issueCount(s.path)
            return (
              <li key={s.path}>
                <button type="button" className={`${s.path === current ? 'is-current' : ''} ${i < index ? 'is-done' : ''}`} aria-current={s.path === current ? 'step' : undefined} onClick={() => go(s.path)}>
                  <span className="step-no">{i + 1}</span>
                  <span className="step-text"><strong>{s.title}</strong><small>{s.blurb}</small></span>
                  {n > 0 && <span className="step-flag" title={`${n} item${n > 1 ? 's' : ''} to check`}>{n}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <main className="main" id="main">
        <div className="main-head">
          <p className="step-count">Step {index + 1} of {STEPS.length}</p>
          <h1>{step.title}</h1>
        </div>
        {current === 'about' && <AboutStep {...props} />}
        {current === 'income' && <IncomeStep {...props} />}
        {current === 'deductions' && <DeductionsStep {...props} />}
        {current === 'payments' && <PaymentsStep {...props} />}
        {current === 'review' && <ReviewStep {...props} onGo={(s) => go(stepForIssue[s])} />}

        <footer className="pager">
          {index > 0 ? <button type="button" className="button is-quiet" onClick={() => go(STEPS[index - 1].path)}>Back to {STEPS[index - 1].title}</button> : <span />}
          {index < STEPS.length - 1 && <button type="button" className="button" onClick={() => go(STEPS[index + 1].path)}>Continue to {STEPS[index + 1].title}</button>}
        </footer>
        <p className="disclaimer">
          USTaxes NextGen is an open-source preparation aid, not tax advice. It does not file returns, and it does not yet
          cover AMT, the saver’s credit, depreciation detail, or state returns.
        </p>
      </main>

      <Summary result={result} open={summaryOpen} onToggle={() => setSummaryOpen((o) => !o)} />
    </div>
  )
}

export default function App(): ReactElement {
  const { pathname } = useLocation()
  if (!STEPS.some((s) => pathname === `/${s.path}`)) return <Navigate to="/about" replace />
  return <Workspace />
}
