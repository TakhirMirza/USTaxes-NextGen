import { ReactElement, useState } from 'react'
import './NextGenV2Foundation.css'

type Step = 'overview' | 'profile' | 'income' | 'deductions' | 'review'
type Wage = { id: number; employer: string; wages: string; withholding: string }
const steps: { id: Step; title: string; detail: string }[] = [
  { id: 'overview', title: 'Overview', detail: 'Your return' },
  { id: 'profile', title: 'About you', detail: 'Filing details' },
  { id: 'income', title: 'Income', detail: 'W-2 and other income' },
  { id: 'deductions', title: 'Deductions', detail: 'Your tax situation' },
  { id: 'review', title: 'Review', detail: 'Coverage and next steps' }
]
const money = (value: string): number | null => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  const cents = Math.round(Number(value) * 100)
  return Number.isSafeInteger(cents) ? cents : null
}
const usd = (cents: number): string => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function NextGenV2Foundation(): ReactElement {
  const [step, setStep] = useState<Step>('overview')
  const [year, setYear] = useState('2025')
  const [filingStatus, setFilingStatus] = useState('single')
  const [hasDependents, setHasDependents] = useState('unknown')
  const [deduction, setDeduction] = useState('unknown')
  const [incomeKinds, setIncomeKinds] = useState<string[]>(['W-2 wages'])
  const [wages, setWages] = useState<Wage[]>([{ id: 1, employer: '', wages: '', withholding: '' }])
  const [interest, setInterest] = useState('')
  const [notice, setNotice] = useState('')
  const current = steps.findIndex((item) => item.id === step)
  const updateWage = (id: number, key: 'employer' | 'wages' | 'withholding', value: string): void => {
    setWages((previous) => previous.map((item) => item.id === id ? { ...item, [key]: value } : item))
  }
  const selectedWages = incomeKinds.includes('W-2 wages')
  const selectedInterest = incomeKinds.includes('1099-INT interest')
  const wageEntriesValid = !selectedWages || (wages.length > 0 && wages.every((w) => w.employer.trim() && money(w.wages) !== null && money(w.withholding) !== null))
  const interestValid = !selectedInterest || money(interest) !== null
  const wageCents = selectedWages && wageEntriesValid ? wages.reduce((total, w) => total + (money(w.wages) || 0), 0) : 0
  const withholdingCents = selectedWages && wageEntriesValid ? wages.reduce((total, w) => total + (money(w.withholding) || 0), 0) : 0
  const interestCents = selectedInterest && interestValid ? money(interest) || 0 : 0
  const unsupportedIncome = incomeKinds.filter((kind) => kind !== 'W-2 wages' && kind !== '1099-INT interest')
  const blocking = [
    ...(year !== '2025' ? [`Tax year ${year} is not implemented`] : []),
    ...(hasDependents === 'unknown' ? ['Dependent status not reviewed'] : []),
    ...(hasDependents === 'yes' ? ['Dependent eligibility and credits require further implementation'] : []),
    ...(deduction === 'unknown' ? ['Deduction choice not reviewed'] : []),
    ...(deduction === 'itemized' ? ['Schedule A itemized deduction validation is not implemented'] : []),
    ...(!wageEntriesValid ? ['W-2 entries need valid employer names and amounts'] : []),
    ...(!interestValid ? ['1099-INT interest needs a valid amount'] : []),
    ...unsupportedIncome.map((kind) => `${kind} requires additional tax logic`),
    'Complete IRS tax calculation and form-generation validation are not yet available',
    'Production identity, secure storage, and filing infrastructure are not configured'
  ]
  const go = (id: Step): void => { setNotice(''); setStep(id); window.scrollTo(0, 0) }
  const next = (): void => go(steps[Math.min(current + 1, steps.length - 1)].id)
  const toggleKind = (kind: string): void => setIncomeKinds((previous) => previous.includes(kind) ? previous.filter((item) => item !== kind) : [...previous, kind])

  return <div className="v2-app">
    <aside className="v2-side" aria-label="Tax preparation navigation">
      <div className="v2-logo"><span className="v2-mark">U</span><span>USTaxes <strong>NextGen</strong><small>Federal tax preparation</small></span></div>
      <div className="v2-side-label">2025 TAX RETURN</div>
      <nav>{steps.map((item, i) => <button key={item.id} type="button" className={`v2-nav ${step === item.id ? 'active' : ''}`} onClick={() => go(item.id)}><span className="v2-num">{i + 1}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>)}</nav>
      <div className="v2-side-bottom"><span className="v2-status-dot"/> Development foundation<br/><small>Not approved for real taxpayer data or filing</small><a href="#/info">Legacy editor (archive)</a><a href="#/nextgen/2025/review">2025 diagnostic workspace</a></div>
    </aside>
    <main className="v2-main">
      <header className="v2-top"><div><span className="v2-eyebrow">USTAXES NEXTGEN 2.0</span><h1>{step === 'overview' ? 'Your tax return, simplified.' : steps[current].title}</h1><p>{step === 'overview' ? 'A new preparation experience, built around clarity and accuracy.' : steps[current].detail}</p></div><span className="v2-preview-tag">FOUNDATION PREVIEW</span></header>
      <div className="v2-warning"><strong>Development environment — fictional data only.</strong> This version is not authorized for real tax preparation, PDF filing, or e-file. Do not enter names, SSNs, addresses, or actual financial information.</div>
      <div className="v2-progress" aria-label={`Step ${current + 1} of ${steps.length}`}><div style={{ width: `${((current + 1) / steps.length) * 100}%` }}/></div>
      {step === 'overview' && <>
        <section className="v2-card v2-hero"><div><span className="v2-eyebrow">START HERE</span><h2>Build your 2025 federal return</h2><p>Follow a guided process: filing status, income, deductions, and a coverage review. Existing research and diagnostic tools remain available separately.</p><button className="v2-primary" onClick={() => go('profile')}>Start a fictional return <span>→</span></button></div><div className="v2-hero-visual"><div className="v2-visual-sheet"><div>FORM 1040</div><span>2025</span><i/><i/><i/><i/></div></div></section>
        <div className="v2-stat-grid"><div className="v2-stat"><span>Tax year</span><strong>2025</strong><small>Initial development target</small></div><div className="v2-stat"><span>Workflow</span><strong>5 steps</strong><small>Clear guided navigation</small></div><div className="v2-stat"><span>Current status</span><strong>In development</strong><small>Filing not enabled</small></div></div>
        <section className="v2-card"><h3>What's changing</h3><div className="v2-feature-grid"><div><strong>01 / Guided experience</strong><p>No more legacy editor mixed with developer diagnostics.</p></div><div><strong>02 / Source-first income</strong><p>Document entries are reviewed before any tax mapping.</p></div><div><strong>03 / Transparent coverage</strong><p>Unsupported situations are identified rather than silently estimated.</p></div></div></section>
      </>}
      {step === 'profile' && <section className="v2-card"><div className="v2-section-head"><div><span className="v2-eyebrow">STEP 01</span><h2>Tell us about your filing situation</h2><p>For this preview, choose only fictional tax characteristics. Personal identifiers are intentionally not collected.</p></div></div><div className="v2-form-grid"><label>Tax year<select value={year} onChange={(e) => setYear(e.target.value)}><option value="2025">2025 — development target</option><option value="2026">2026 — not supported</option><option value="2027">2027 — not supported</option><option value="2028">2028 — not supported</option></select></label><label>Filing status<select value={filingStatus} onChange={(e) => setFilingStatus(e.target.value)}><option value="single">Single</option><option value="joint">Married filing jointly</option><option value="separate">Married filing separately</option><option value="head">Head of household</option><option value="survivor">Qualifying surviving spouse</option></select></label><label>Dependents<select value={hasDependents} onChange={(e) => setHasDependents(e.target.value)}><option value="unknown">Not reviewed yet</option><option value="no">No dependents in fictional example</option><option value="yes">Dependents — requires additional review</option></select></label></div><div className="v2-note">Identity verification, residency, dependent eligibility, and other filing-status rules will be added before real returns are supported.</div></section>}
      {step === 'income' && <section className="v2-card"><span className="v2-eyebrow">STEP 02</span><h2>Income sources</h2><p>Choose the income categories in your fictional scenario. Unsupported categories will be flagged in Review.</p><div className="v2-check-grid">{['W-2 wages','1099-INT interest','1099-DIV dividends','1099-NEC / self-employment','Capital gains','Retirement income','Rental income','Other income'].map((kind) => <label className="v2-check" key={kind}><input type="checkbox" checked={incomeKinds.includes(kind)} onChange={() => toggleKind(kind)}/>{kind}</label>)}</div>{selectedWages && <div className="v2-income-block"><h3>W-2 documents</h3>{wages.map((w, index) => <div key={w.id} className="v2-wage"><div className="v2-wage-title"><strong>W-2 #{index + 1}</strong>{wages.length > 1 && <button className="v2-text-button" onClick={() => setWages((old) => old.filter((item) => item.id !== w.id))}>Remove</button>}</div><div className="v2-form-grid"><label>Fictional employer label<input value={w.employer} onChange={(e) => updateWage(w.id, 'employer', e.target.value)} placeholder="Example employer"/></label><label>Box 1 — wages ($)<input inputMode="decimal" value={w.wages} onChange={(e) => updateWage(w.id, 'wages', e.target.value)} placeholder="75000.00"/></label><label>Box 2 — federal withholding ($)<input inputMode="decimal" value={w.withholding} onChange={(e) => updateWage(w.id, 'withholding', e.target.value)} placeholder="9000.00"/></label></div></div>)}<button className="v2-secondary" onClick={() => setWages((old) => [...old, { id: Math.max(0, ...old.map((w) => w.id)) + 1, employer: '', wages: '', withholding: '' }])} disabled={wages.length >= 100}>+ Add another W-2</button>{!wageEntriesValid && <p className="v2-inline-warning">Each W-2 needs an employer label and valid dollar amounts (up to two decimal places).</p>}</div>}{selectedInterest && <div className="v2-income-block"><h3>1099-INT</h3><label className="v2-narrow-label">Box 1 — taxable interest ($)<input inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="250.00"/></label></div>}</section>}
      {step === 'deductions' && <section className="v2-card"><span className="v2-eyebrow">STEP 03</span><h2>Deductions and adjustments</h2><p>Choose a review path. A selection here does not establish tax eligibility.</p><div className="v2-choice-grid">{[{id:'standard',title:'Standard deduction',detail:'Eligibility and the applicable amount must be verified.'},{id:'itemized',title:'Itemized deductions',detail:'Schedule A substantiation and limitations are required.'},{id:'unknown',title:'Not sure yet',detail:'Leave this unresolved until more information is available.'}].map((option) => <button key={option.id} className={`v2-choice ${deduction === option.id ? 'selected' : ''}`} onClick={() => setDeduction(option.id)}><strong>{option.title}</strong><small>{option.detail}</small></button>)}</div><div className="v2-note">Qualified tips, overtime, senior and vehicle-loan-interest deductions require their own eligibility reviews under 2025 law. No deductions are automatically claimed in this foundation.</div></section>}
      {step === 'review' && <><section className="v2-card"><span className="v2-eyebrow">STEP 04</span><h2>Return coverage review</h2><p>This is a source summary, <strong>not a tax calculation or a completed Form 1040</strong>.</p><div className="v2-review-grid"><div><span>Filing status</span><strong>{filingStatus.replace(/^(.)/, (letter) => letter.toUpperCase())}</strong></div><div><span>W-2 wages (fictional)</span><strong>{wageEntriesValid ? usd(wageCents) : 'Needs review'}</strong></div><div><span>W-2 withholding (fictional)</span><strong>{wageEntriesValid ? usd(withholdingCents) : 'Needs review'}</strong></div><div><span>1099-INT interest (fictional)</span><strong>{interestValid ? usd(interestCents) : 'Needs review'}</strong></div></div></section><section className="v2-card"><h3>Why filing is not enabled</h3><p>All blocking items must be resolved and independently validated before production use.</p><ul className="v2-blockers">{blocking.map((item) => <li key={item}>{item}</li>)}</ul><div className="v2-note">No tax due, refund, IRS PDF, or e-file output is generated from this foundation preview.</div></section></>}
      <div className="v2-footer-actions"><button className="v2-secondary" onClick={() => current > 0 ? go(steps[current - 1].id) : setNotice('You are already at the beginning.')}>← Back</button><div className="v2-footer-right"><span>Step {current + 1} of {steps.length}</span>{current < steps.length - 1 ? <button className="v2-primary" onClick={next}>Continue →</button> : <button className="v2-primary" onClick={() => go('overview')}>Return to overview</button>}</div></div>{notice && <p role="status">{notice}</p>}
      <footer className="v2-legal">USTaxes NextGen 2.0 Foundation · Development preview only · No real taxpayer information · <a href="https://www.irs.gov/forms-pubs/about-form-1040" target="_blank" rel="noopener noreferrer">Official IRS Form 1040 resources</a></footer>
    </main>
  </div>
}
