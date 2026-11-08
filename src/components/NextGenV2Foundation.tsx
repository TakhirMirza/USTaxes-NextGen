import { ReactElement, useEffect, useState } from 'react'
import { assessFederalReadiness2025, federalReadinessCsv2025 } from '../nextgen/taxYears/federalReadiness2025'
import { ProfileFacts2025, Answer2025, emptyProfileFacts2025, reviewProfileFacts2025 } from '../nextgen/taxYears/profileFacts2025'
import { useLocation, useNavigate } from 'react-router-dom'
import './NextGenV2Foundation.css'
import { map2025SourcesTo1040 } from '../nextgen/taxYears/taxEngineCore2025'
import { reviewFederalReturn2025 } from '../nextgen/taxYears/federalReview2025'
import { reconcileForm1040Arithmetic2025 } from '../nextgen/taxYears/form1040Arithmetic2025'
import { FilingStatus2025 } from '../nextgen/taxYears/preview2025'
import { computeIrsTaxWorksheet2025 } from '../nextgen/taxYears/irsTaxComputationWorksheet2025'

import { DraftWorkspace, WORKSPACE_KEY, readDraftWorkspace, parseDraftWorkspace } from '../nextgen/navigation/draftWorkspace'
import NextGen2025TaxBalance from './NextGen2025TaxBalance'
import NextGen2025FederalReturn from './NextGen2025FederalReturn'
import NextGen2025Schedules from './NextGen2025Schedules'
import NextGen2025DocumentAudit from './NextGen2025DocumentAudit'
import NextGen2025SourceLedger from './NextGen2025SourceLedger'
import NextGen2025ScheduleBridgeAudit from './NextGen2025ScheduleBridgeAudit'
import NextGen2025IncomeBridge from './NextGen2025IncomeBridge'
import NextGen2025CalculationGate from './NextGen2025CalculationGate'
import NextGen2025TaxScenario from './NextGen2025TaxScenario'
import NextGen2025DeductionCreditAudit from './NextGen2025DeductionCreditAudit'
import NextGen2025CreditBalance from './NextGen2025CreditBalance'
import NextGen2025RegressionSuite from './NextGen2025RegressionSuite'
import NextGen2025LineTrace from './NextGen2025LineTrace'
import NextGen2025Integrated1040 from './NextGen2025Integrated1040'
import NextGen2025ScheduleDependencies from './NextGen2025ScheduleDependencies'
import NextGen2025UnifiedLedger from './NextGen2025UnifiedLedger'
import NextGen2025ScheduleABD from './NextGen2025ScheduleABD'
import NextGen2025DocumentBridge from './NextGen2025DocumentBridge'
import NextGen2025CalculationIntegrity from './NextGen2025CalculationIntegrity'
import NextGen2025ExceptionRegister from './NextGen2025ExceptionRegister'
import NextGen2025QualityAssurance from './NextGen2025QualityAssurance'
import NextGen2025ReleaseReadiness from './NextGen2025ReleaseReadiness'
import NextGen2025ScheduleC from './NextGen2025ScheduleC'
import NextGen2025ScheduleCBridge from './NextGen2025ScheduleCBridge'
import NextGen2025ScheduleSE from './NextGen2025ScheduleSE'
import NextGen2025SelfEmploymentPipeline from './NextGen2025SelfEmploymentPipeline'
import NextGen2025CrossScheduleReconciliation from './NextGen2025CrossScheduleReconciliation'
import NextGen2025FederalBalanceValidation from './NextGen2025FederalBalanceValidation'
import NextGen2025UnifiedGraph from './NextGen2025UnifiedGraph'
import NextGen2025ScenarioRegression from './NextGen2025ScenarioRegression'
import NextGen2025CalculationCoverage from './NextGen2025CalculationCoverage'
import NextGen2025FormWorkspace from './NextGen2025FormWorkspace'
import NextGen2025FormsNavigator from './NextGen2025FormsNavigator'
import NextGen2025ScheduleEditors, { emptyScheduleDraft2025, ScheduleDraft2025, reviewScheduleDraft2025 } from './NextGen2025ScheduleEditors'
import { readScheduleDraft2025, parseScheduleDraft2025, SCHEDULE_DRAFT_KEY } from '../nextgen/taxYears/scheduleDraftExchange2025'
import { Schedule1040Candidates2025, emptySchedule1040Candidates2025 } from '../nextgen/taxYears/schedules1040Bridge2025'
import { reconcileFederalScheduleIncome2025 } from '../nextgen/taxYears/federalScheduleIntegration2025'
import { stepFromV2Path, v2PathForStep, V2Step } from '../nextgen/navigation/v2Routes'
import { assessScenarioQuality } from '../nextgen/navigation/scenarioQuality'
import { createScenarioAudit, scenarioAuditCsv } from '../nextgen/navigation/scenarioAudit'
import { buildFederalCoverageMatrix2025, federalCoverageCsv2025 } from '../nextgen/taxYears/federalCoverageMatrix2025'
import { reviewFederalSources2025, federalSourceIntegrityCsv2025 } from '../nextgen/taxYears/federalSourceIntegrity2025'
import { reconcile2025DraftTo1040, reconciliationCsv2025 } from '../nextgen/taxYears/federal1040SourceReconciliation2025'

type Step = V2Step
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
  const location = useLocation()
  const navigate = useNavigate()
  const step = stepFromV2Path(location.pathname)
  const [reviewTab, setReviewTab] = useState<'return' | 'validation' | 'diagnostics'>('return')
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft2025>(readScheduleDraft2025)
  const [scheduleCandidates, setScheduleCandidates] = useState<Schedule1040Candidates2025>(emptySchedule1040Candidates2025)
  const [schedulesEligibilityReviewed, setSchedulesEligibilityReviewed] = useState(false)
  const [otherIncomeReviewed, setOtherIncomeReviewed] = useState(false)
  const [deductionEligibilityReviewed, setDeductionEligibilityReviewed] = useState(false)
  const [restored] = useState(readDraftWorkspace)
  const [year, setYear] = useState(restored?.year || '2025')
  const [filingStatus, setFilingStatus] = useState(restored?.filingStatus || 'single')
  const [hasDependents, setHasDependents] = useState(restored?.hasDependents || 'unknown')
  const [deduction, setDeduction] = useState(restored?.deduction || 'unknown')
  const [incomeKinds, setIncomeKinds] = useState<string[]>(restored?.incomeKinds || ['W-2 wages'])
  const [wages, setWages] = useState<Wage[]>(restored?.wages || [{ id: 1, employer: '', wages: '', withholding: '' }])
  const [interest, setInterest] = useState(restored?.interest || '')
  const [payer, setPayer] = useState(restored?.payer || '')
  const [basicDeductionConfirmed, setBasicDeductionConfirmed] = useState(restored?.basicDeductionConfirmed || false)
  const [noOtherItemsConfirmed, setNoOtherItemsConfirmed] = useState(restored?.noOtherItemsConfirmed || false)
  const [profileFacts, setProfileFacts] = useState<ProfileFacts2025>(restored?.profileFacts || emptyProfileFacts2025())
  const profileReview = reviewProfileFacts2025(profileFacts, filingStatus)
  const [notice, setNotice] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')
  const [showSampleHelp, setShowSampleHelp] = useState(false)
  const [showAllReview, setShowAllReview] = useState(false)
  const [ordinaryTaxMethodConfirmed, setOrdinaryTaxMethodConfirmed] = useState(restored?.ordinaryTaxMethodConfirmed || false)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const workspace: DraftWorkspace = { version: 1, profileFacts, year, filingStatus, hasDependents, deduction, incomeKinds, wages, interest, payer, basicDeductionConfirmed, noOtherItemsConfirmed, ordinaryTaxMethodConfirmed }
  const scheduleReview = reviewScheduleDraft2025(scheduleDraft)
  const scenarioFindings = assessScenarioQuality(workspace)
  const federalCoverage = buildFederalCoverageMatrix2025(workspace)
  const sourceIntegrity = reviewFederalSources2025(workspace)
  const source1040 = reconcile2025DraftTo1040(workspace)
  const readiness = assessFederalReadiness2025({ year, filingStatus, hasDependents, deduction,
    profileUnresolved: profileReview.unresolved, simplifiedDeductionEligible: profileReview.simpleStandardDeductionEligible,
    incomeKinds, wageEntriesValid: !incomeKinds.includes('W-2 wages') || wages.every(w => w.employer.trim() !== '' && money(w.wages) !== null && money(w.withholding) !== null),
    interestValid: !incomeKinds.includes('1099-INT interest') || money(interest) !== null,
    basicDeductionConfirmed, noOtherItemsConfirmed,
    sourceIssueCount: sourceIntegrity.findings.filter(f => f.severity === 'error').length,
    reconciliationIssueCount: source1040.issues.length })
  const downloadReadiness = (): void => {
    const blob = new Blob([federalReadinessCsv2025(readiness)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'nextgen-2025-readiness-checklist.csv'; a.click(); URL.revokeObjectURL(url)
    setNotice('Readiness checklist exported without taxpayer labels or financial amounts. Filing remains disabled.')
  }
  const scenarioErrors = scenarioFindings.filter(f => f.severity === 'error').length
  const scenarioWarnings = scenarioFindings.filter(f => f.severity === 'warning').length
  useEffect(() => {
    try { window.sessionStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace)) } catch { /* storage may be disabled */ }
  }, [profileFacts, year, filingStatus, hasDependents, deduction, incomeKinds, wages, interest, payer, basicDeductionConfirmed, noOtherItemsConfirmed, ordinaryTaxMethodConfirmed])
  useEffect(() => {
    try { window.sessionStorage.setItem(SCHEDULE_DRAFT_KEY, JSON.stringify(scheduleDraft)) } catch { /* optional draft storage */ }
  }, [scheduleDraft])
  const applyWorkspace = (w: DraftWorkspace): void => {
    setProfileFacts(w.profileFacts || emptyProfileFacts2025()); setYear(w.year); setFilingStatus(w.filingStatus); setHasDependents(w.hasDependents)
    setDeduction(w.deduction); setIncomeKinds(w.incomeKinds); setWages(w.wages)
    setInterest(w.interest); setPayer(w.payer); setBasicDeductionConfirmed(w.basicDeductionConfirmed)
    setNoOtherItemsConfirmed(w.noOtherItemsConfirmed); setOrdinaryTaxMethodConfirmed(w.ordinaryTaxMethodConfirmed)
  }
  const exportWorkspace = (): void => {
    const blob = new Blob([JSON.stringify({ ...workspace, scheduleDraft2025: scheduleDraft }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `ustaxes-tax-return-${year}.json`; a.click()
    URL.revokeObjectURL(url)
    setNotice('Tax return data exported. Protect this file; secure storage is not yet configured.')
  }
  const downloadAudit = (format: 'json' | 'csv'): void => {
    const audit = createScenarioAudit(workspace)
    const content = format === 'json' ? JSON.stringify(audit, null, 2) : scenarioAuditCsv(audit)
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nextgen-scenario-audit-${year}.${format}`
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Development audit exported without employer labels, payer labels, or financial amounts. This is not filing authorization.')
  }
  const downloadCoverage = (): void => {
    const content = federalCoverageCsv2025(federalCoverage)
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nextgen-2025-coverage-${year}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Coverage matrix exported. No financial amounts or source labels are included.')
  }
  const importWorkspace = (): void => {
    try {
      const imported = JSON.parse(importText)
      const parsed = parseDraftWorkspace(imported)
      const importedSchedule = imported && typeof imported === 'object' && 'scheduleDraft2025' in imported ? parseScheduleDraft2025(imported.scheduleDraft2025) : emptyScheduleDraft2025()
      if (!importedSchedule) { setNotice('Import rejected: invalid Schedule A/B draft data.'); return }
      if (!parsed) { setNotice('Import rejected: invalid or unsupported tax return draft.'); return }
      setScheduleDraft(importedSchedule)
      applyWorkspace({ ...parsed, profileFacts: parsed.profileFacts || emptyProfileFacts2025(), basicDeductionConfirmed: false, noOtherItemsConfirmed: false, ordinaryTaxMethodConfirmed: false }); setSchedulesEligibilityReviewed(false); setOtherIncomeReviewed(false); setDeductionEligibilityReviewed(false); setImportText(''); setShowImport(false)
      setNotice('Tax return data imported. Review all entries and confirmations again.')
    } catch { setNotice('Import rejected: invalid JSON.') }
  }
  const clearWorkspace = (): void => {
    if (!window.confirm('Clear all tax return draft entries in this tab?')) return
    setSchedulesEligibilityReviewed(false); setOtherIncomeReviewed(false); setDeductionEligibilityReviewed(false)
    setScheduleDraft(emptyScheduleDraft2025())
    applyWorkspace({ version: 1, profileFacts: emptyProfileFacts2025(), year: '2025', filingStatus: 'single', hasDependents: 'unknown', deduction: 'unknown', incomeKinds: ['W-2 wages'], wages: [{id: 1, employer: '', wages: '', withholding: ''}], interest: '', payer: '', basicDeductionConfirmed: false, noOtherItemsConfirmed: false, ordinaryTaxMethodConfirmed: false })
    try { window.sessionStorage.removeItem(SCHEDULE_DRAFT_KEY) } catch { /* ignore */ }
    try { window.sessionStorage.removeItem(WORKSPACE_KEY) } catch { /* ignore */ }
    setNotice('Draft workspace reset.')
  }
  const current = steps.findIndex((item) => item.id === step)
  const updateWage = (id: number, key: 'employer' | 'wages' | 'withholding', value: string): void => {
    setWages((previous) => previous.map((item) => item.id === id ? { ...item, [key]: value } : item))
  }
  const focusIncome = (id: string): void => {
    go('income')
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }
  const selectedWages = incomeKinds.includes('W-2 wages')
  const selectedInterest = incomeKinds.includes('1099-INT interest')
  const wageEntriesValid = !selectedWages || (wages.length > 0 && wages.every((w) => w.employer.trim() && money(w.wages) !== null && money(w.withholding) !== null))
  const interestValid = !selectedInterest || money(interest) !== null
  const wageCents = selectedWages && wageEntriesValid ? wages.reduce((total, w) => total + (money(w.wages) || 0), 0) : 0
  const withholdingCents = selectedWages && wageEntriesValid ? wages.reduce((total, w) => total + (money(w.withholding) || 0), 0) : 0
  const interestCents = selectedInterest && interestValid ? money(interest) || 0 : 0
  const engineStatus: FilingStatus2025 = ({ single: 'single', joint: 'marriedJoint', separate: 'marriedSeparate', head: 'headOfHousehold', survivor: 'qualifyingSurvivingSpouse' } as { [key: string]: FilingStatus2025 })[filingStatus]
  const updateProfileFact = (key: keyof ProfileFacts2025, value: Answer2025): void => { setProfileFacts(previous => ({ ...previous, [key]: value })); setBasicDeductionConfirmed(false); setOrdinaryTaxMethodConfirmed(false) }
  const engine = map2025SourcesTo1040({ year: Number(year), filingStatus: engineStatus, w2: selectedWages ? wages.map(w => ({ id: String(w.id), employer: w.employer, box1: w.wages, box2: w.withholding })) : [], interest: selectedInterest ? [{ id: 'int-1', payer, box1: interest }] : [], standardDeductionFactsConfirmed: basicDeductionConfirmed && deduction === 'standard' && profileReview.simpleStandardDeductionEligible, taxpayerUnder65AndNotBlind: profileReview.taxpayerUnder65AndNotBlind, spouseUnder65AndNotBlind: profileReview.spouseUnder65AndNotBlind, notClaimableAsDependent: profileReview.notClaimableAsDependent, noOtherIncomeAdjustmentsCreditsOrTaxes: noOtherItemsConfirmed && hasDependents === 'no' && incomeKinds.every(kind => kind === 'W-2 wages' || kind === '1099-INT interest') })
  const worksheetTax = computeIrsTaxWorksheet2025(engine.lines['15'] === null ? -1 : engine.lines['15'], engineStatus, ordinaryTaxMethodConfirmed && engine.status === 'mapped')
  const federalReview = reviewFederalReturn2025(engine)
  const arithmeticReview = reconcileForm1040Arithmetic2025(engine, null, false)
  const unsupportedIncome = incomeKinds.filter((kind) => kind !== 'W-2 wages' && kind !== '1099-INT interest')
  const blocking = [
    ...(year !== '2025' ? [`Tax year ${year} is not implemented`] : []),
    ...(hasDependents === 'unknown' ? ['Dependent status not reviewed'] : []),
    ...(hasDependents === 'yes' ? ['Dependent eligibility and credits require further implementation'] : []),
    ...profileReview.unresolved,
    ...(deduction === 'unknown' ? ['Deduction choice not reviewed'] : []),
    ...(deduction === 'itemized' ? ['Schedule A itemized deduction validation is not implemented'] : []),
    ...(!wageEntriesValid ? ['W-2 entries need valid employer names and amounts'] : []),
    ...(!interestValid ? ['1099-INT interest needs a valid amount'] : []),
    ...unsupportedIncome.map((kind) => `${kind} requires additional tax logic`),
    'Complete IRS tax calculation and form-generation validation are not yet available',
    'Production identity, secure storage, and filing infrastructure are not configured'
  ]
  const scheduleIncomeReview = reconcileFederalScheduleIncome2025({
    year: 2025,
    wagesCents: wageEntriesValid && selectedWages ? wageCents : null,
    taxableInterestCents: interestValid && selectedInterest ? interestCents : null,
    schedule: scheduleCandidates,
    schedulesReviewed: schedulesEligibilityReviewed,
    noOtherIncomeConfirmed: otherIncomeReviewed,
    deductionCents: engine.lines['12e'] === null ? null : Math.round(engine.lines['12e'] * 100),
    deductionEligibilityReviewed
  })
  const go = (id: Step): void => { setNotice(''); navigate(v2PathForStep(id)); window.scrollTo(0, 0) }
  const next = (): void => go(steps[Math.min(current + 1, steps.length - 1)].id)
  const toggleKind = (kind: string): void => setIncomeKinds((previous) => previous.includes(kind) ? previous.filter((item) => item !== kind) : [...previous, kind])
  // Populate a deliberately fictional sample for UI walkthroughs only. Never overwrites a draft silently.
  const loadFictionalExample = (): void => {
    if (!window.confirm('Replace the current draft with a fictional training example? Your existing draft will be replaced.')) return
    applyWorkspace({ version: 1, year: '2025', filingStatus: 'single', hasDependents: 'no', deduction: 'standard',
      profileFacts: { taxpayer65: 'no', taxpayerBlind: 'no', claimableDependent: 'no', spouse65: 'unknown', spouseBlind: 'unknown' },
      incomeKinds: ['W-2 wages', '1099-INT interest'],
      wages: [{ id: 1, employer: 'Example Employer A (fictional)', wages: '68500.00', withholding: '7900.00' },
              { id: 2, employer: 'Example Employer B (fictional)', wages: '12500.00', withholding: '1300.00' }],
      payer: 'Example Credit Union (fictional)', interest: '145.75',
      basicDeductionConfirmed: false, noOtherItemsConfirmed: false, ordinaryTaxMethodConfirmed: false })
    setSchedulesEligibilityReviewed(false); setOtherIncomeReviewed(false); setDeductionEligibilityReviewed(false)
    go('profile')
    setNotice('Fictional example loaded. Eligibility confirmations remain unchecked. No real taxpayer data.')
  }
  const profileItems = [
    { title: 'Filing status', done: year === '2025' && !!filingStatus, step: 'profile' as Step },
    { title: 'Dependents', done: hasDependents !== 'unknown', step: 'profile' as Step },
    { title: 'Age, blindness and dependent eligibility', done: profileReview.unresolved.length === 0, step: 'profile' as Step },
    { title: 'Income documents', done: wageEntriesValid && interestValid && incomeKinds.length > 0, step: 'income' as Step },
    { title: 'Deduction selection', done: deduction !== 'unknown', step: 'deductions' as Step },
  ]
  const completeProfileItems = profileItems.filter(item => item.done).length


  return <div className="v2-app">
    <aside className="v2-side" aria-label="Tax preparation navigation">
      <div className="v2-logo"><span className="v2-mark">U</span><span>USTaxes <strong>NextGen</strong><small>Federal tax preparation</small></span></div>
      <div className="legacy-year-switch">Federal return <strong>{year}</strong><small>Draft / local preview</small></div>
      <div className="v2-side-label">RETURN WORKSPACE</div>
      <div className="legacy-side-group">GET STARTED</div>
      <nav>{steps.map((item, i) => <button key={item.id} type="button" className={`v2-nav ${step === item.id ? 'active' : ''}`} onClick={() => go(item.id)}><span className="v2-num">{i + 1}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>)}</nav>
      <div className="legacy-side-shortcuts"><div className="legacy-side-group">TAX DOCUMENTS</div><button type="button" onClick={() => go('income')}>W-2 wages</button><button type="button" onClick={() => go('income')}>1099 interest &amp; other income</button><button type="button" onClick={() => go('deductions')}>Schedule A &amp; deductions</button><button type="button" onClick={() => go('review')}>Form 1040 review</button></div>
      <div className="v2-side-bottom"><span className="v2-status-dot"/> Development foundation<br/><small>Not approved for real taxpayer data or filing</small></div>
    </aside>
    <main className="v2-main">
      <header className="v2-top"><div><span className="v2-eyebrow">USTAXES NEXTGEN 2.0</span><h1>{step === 'overview' ? 'Federal income tax return' : steps[current].title}</h1><p>{step === 'overview' ? 'Tax year 2025 · Return workspace' : steps[current].detail}</p></div><span className="v2-preview-tag">DEVELOPMENT PREVIEW</span></header>
      <div className="v2-warning"><strong>TEST MODE — fictional information only.</strong> This version is not authorized for real tax preparation, PDF filing, or e-file. Do not enter names, SSNs, addresses, or actual financial information.</div>
      <details className="legacy-developer-tools"><summary>Developer tools &amp; diagnostic reports <span>Scenario import/export, integrity, coverage, audit</span></summary>
      <section className="v2-card" aria-label="Tax return workspace">
        <span className="v2-eyebrow">TAX WORKSPACE / DEVELOPMENT</span>
        <h3>Tax return workspace — persistence integration pending</h3>
        <p>The current browser-only draft mechanism is not secure persistent storage. Do not enter SSNs, addresses or other personal identifiers until authenticated encrypted server storage is integrated.</p>
        <div className="v2-footer-right"><button type="button" className="v2-secondary" onClick={exportWorkspace}>Export scenario JSON</button><button type="button" className="v2-secondary" onClick={() => setShowImport(v => !v)}>Import scenario JSON</button><button type="button" className="v2-secondary" onClick={clearWorkspace}>Reset scenario</button></div>
        {showImport && <div><label>Paste previously exported tax return draft JSON<textarea rows={5} style={{width:'100%'}} value={importText} onChange={e => setImportText(e.target.value)} /></label><button type="button" className="v2-primary" onClick={importWorkspace}>Validate and import</button></div>}
      </section>
      <section className="v2-card" aria-label="Scenario quality report">
        <span className="v2-eyebrow">NEXTGEN 2.0 / SCENARIO QUALITY</span>
        <h3>Development scenario checks</h3>
        <p>Checks source completeness, unsupported tax situations and review confirmations. These checks do not establish filing readiness.</p>
        <div className="v2-review-grid"><div><span>Blocking findings</span><strong>{scenarioErrors}</strong></div><div><span>Review warnings</span><strong>{scenarioWarnings}</strong></div><div><span>Filing</span><strong>Disabled</strong></div></div>
        <div className="v2-footer-right"><button type="button" className="v2-secondary" onClick={() => downloadAudit('json')}>Download privacy-safe audit JSON</button><button type="button" className="v2-secondary" onClick={() => downloadAudit('csv')}>Download findings CSV</button></div>
        <p>Audit downloads exclude employer and payer labels, wage and interest amounts. Filing remains disabled regardless of diagnostic results.</p>
        <details><summary>Show {scenarioFindings.length} findings and navigate to sections</summary>
          <ul className="v2-blockers">{scenarioFindings.map(f => <li key={f.code}><strong>{f.severity.toUpperCase()}</strong> — {f.message} <button type="button" className="v2-text-button" onClick={() => go(f.step)}>Open {f.step}</button></li>)}</ul>
        </details>
      </section>
      <section className="v2-card" aria-label="Federal 2025 coverage matrix">
        <span className="v2-eyebrow">2025 / FEDERAL COVERAGE MATRIX</span>
        <h3>Federal forms and schedules — implementation status</h3>
        <p>This matrix separates available development previews from missing tax logic. A covered source does not imply an accurate, complete, or fileable return.</p>
        <div className="v2-review-grid"><div><span>Preview modules</span><strong>{federalCoverage.filter(x => x.status === 'preview').length}</strong></div><div><span>Blocked or not implemented</span><strong>{federalCoverage.filter(x => x.status !== 'preview').length}</strong></div><div><span>Filing readiness</span><strong>NOT READY</strong></div></div>
        <button type="button" className="v2-secondary" onClick={downloadCoverage}>Export coverage matrix CSV</button>
        <details><summary>View {federalCoverage.length} federal coverage items</summary><ul className="v2-blockers">{federalCoverage.map(item => <li key={item.id}><strong>{item.status.toUpperCase()} — {item.title}</strong><div>{item.detail}</div><button type="button" className="v2-text-button" onClick={() => go(item.step)}>Open {item.step}</button></li>)}</ul></details>
      </section>
      <section className="v2-card" aria-label="2025 source document integrity review">
        <span className="v2-eyebrow">2025 / SOURCE DOCUMENT INTEGRITY</span>
        <h3>W-2 and 1099-INT cross-document checks</h3>
        <p>Independent integer-cent validation of selected income sources, document completeness, withholding anomalies and unsupported categories. No tax liability or filing authorization is inferred.</p>
        <div className="v2-review-grid"><div><span>Source errors</span><strong>{sourceIntegrity.findings.filter(f => f.severity === 'error').length}</strong></div><div><span>Warnings</span><strong>{sourceIntegrity.findings.filter(f => f.severity === 'warning').length}</strong></div><div><span>Filing readiness</span><strong>NOT READY</strong></div></div>
        <button type="button" className="v2-secondary" onClick={() => {
          const blob = new Blob([federalSourceIntegrityCsv2025(sourceIntegrity)], { type: 'text/csv;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a'); link.href = url; link.download = `nextgen-source-integrity-${year}.csv`; link.click(); URL.revokeObjectURL(url)
          setNotice('Source integrity findings exported without personal labels or financial amounts.')
        }}>Export source integrity CSV</button>
        <details><summary>View {sourceIntegrity.findings.length} integrity findings</summary><ul className="v2-blockers">{sourceIntegrity.findings.map(f => <li key={f.code}><strong>{f.severity.toUpperCase()} — {f.code}</strong><div>{f.message}</div><button type="button" className="v2-text-button" onClick={() => go(f.source)}>Open {f.source}</button></li>)}</ul></details>
      </section>
      </details>
      <div className="v2-progress" aria-label={`Step ${current + 1} of ${steps.length}`}><div style={{ width: `${((current + 1) / steps.length) * 100}%` }}/></div>
      <div className="legacy-workspace-toolbar" aria-label="Return workspace shortcuts">
        <div><strong>2025 Federal Return</strong><span>Local test scenario · filing disabled</span></div>
        <div className="legacy-toolbar-actions">
          <button type="button" onClick={() => go('profile')}>Taxpayer</button>
          <button type="button" onClick={() => go('income')}>W-2 / 1099</button>
          <button type="button" onClick={() => go('deductions')}>Deductions</button>
          <button type="button" onClick={() => go('review')}>Form 1040</button>
        </div>
      </div>
      {step !== 'overview' && <div className="legacy-page-context"><span>Federal / {year} / {steps[current].title}</span><span>Step {current + 1} of {steps.length}</span></div>}

      {step === 'overview' && <section className="v2-card legacy-guided-profile" aria-label="Quick start and progress">
        <div className="legacy-register-head"><div><span className="v2-eyebrow">RETURN PREPARATION</span><h2>Return checklist</h2><p>Track the sections that need attention, or load a completely fictional example to explore the working forms.</p></div><button type="button" className="v2-secondary" onClick={loadFictionalExample}>Load fictional example</button></div>
        <div className="legacy-interview-list">{profileItems.map(item => <button type="button" key={item.title} onClick={() => go(item.step)}><span className={item.done ? 'legacy-interview-done' : 'legacy-interview-pending'}>{item.done ? '✓' : '!'}</span><strong>{item.title}</strong><small>{item.done ? 'Reviewed' : 'Open section →'}</small></button>)}</div>
      </section>}
      {step === 'overview' && <>
        <section className="v2-card legacy-dashboard-intro"><div><span className="v2-eyebrow">YOUR FEDERAL RETURN / 2025</span><h2>Continue your tax return</h2><p>Enter filing information, review income documents and deductions, then inspect your Form 1040 draft. Use fictional test data only.</p><button type="button" className="v2-primary" onClick={() => go('profile')}>Continue preparing return →</button></div><div className="legacy-return-stamp"><strong>1040</strong><span>U.S. Individual Income Tax Return</span><small>2025 · TEST DRAFT</small></div></section>
        <div className="v2-stat-grid"><div className="v2-stat"><span>Filing status</span><strong>{filingStatus === 'joint' ? 'Married filing jointly' : filingStatus === 'single' ? 'Single' : filingStatus === 'separate' ? 'Married filing separately' : filingStatus === 'head' ? 'Head of household' : 'Surviving spouse'}</strong><small>Change in About you</small></div><div className="v2-stat"><span>W-2 documents</span><strong>{selectedWages ? wages.length : 0}</strong><small>Review in Income</small></div><div className="v2-stat"><span>Return status</span><strong>Draft</strong><small>Not approved for filing</small></div></div>
        <section className="legacy-return-overview" aria-label="Draft return overview">
          <div className="legacy-overview-panel"><span>W-2 wages entered</span><strong>{wageEntriesValid ? usd(wageCents) : 'Incomplete'}</strong><button type="button" onClick={() => go('income')}>Review W-2 →</button></div>
          <div className="legacy-overview-panel"><span>Federal withholding</span><strong>{wageEntriesValid ? usd(withholdingCents) : 'Incomplete'}</strong><button type="button" onClick={() => go('income')}>Review payments →</button></div>
          <div className="legacy-overview-panel"><span>Taxable interest</span><strong>{selectedInterest ? (interestValid ? usd(interestCents) : 'Incomplete') : 'Not selected'}</strong><button type="button" onClick={() => go('income')}>Review 1099-INT →</button></div>
          <div className="legacy-overview-panel"><span>Review findings</span><strong>{readiness.filter(f => f.severity === 'blocker').length} blockers</strong><button type="button" onClick={() => go('review')}>Open review →</button></div>
        </section>
        <section className="v2-card legacy-return-sections"><h3>Prepare your return</h3><div className="legacy-section-grid">{steps.slice(1).map((item, index) => <button key={item.id} type="button" onClick={() => go(item.id)}><span className="legacy-section-icon">{index + 1}</span><span><strong>{item.title}</strong><small>{item.id === 'profile' ? 'Filing status, dependents and eligibility' : item.id === 'income' ? 'W-2, 1099 and schedule worksheets' : item.id === 'deductions' ? 'Standard or itemized deductions' : 'Form 1040 and reconciliation'}</small></span><span aria-hidden="true">→</span></button>)}</div></section>
      </>}
      {step === 'profile' && <section className="v2-card legacy-guided-profile" aria-label="Taxpayer interview checklist">
        <div className="legacy-register-head"><div><span className="v2-eyebrow">TAXPAYER INTERVIEW</span><h2>Personal and filing details</h2><p>Complete the eligibility questions below. No SSN, legal name or address is collected in this demo.</p></div><div className="legacy-completion-pill">{completeProfileItems} / {profileItems.length} reviewed</div></div>
        <div className="legacy-interview-list">{profileItems.map(item => <button type="button" key={item.title} onClick={() => go(item.step)}><span className={item.done ? 'legacy-interview-done' : 'legacy-interview-pending'}>{item.done ? '✓' : '!'}</span><strong>{item.title}</strong><small>{item.done ? 'Entered / reviewed' : 'Needs attention'}</small></button>)}</div>
      </section>}
      {step === 'profile' && <section className="v2-card"><div className="v2-section-head"><div><span className="v2-eyebrow">STEP 01</span><h2>Tell us about your filing situation</h2><p>For this preview, choose only tax characteristics. Personal identifiers are intentionally not collected.</p></div></div><div className="v2-form-grid"><label>Tax year<select value={year} onChange={(e) => setYear(e.target.value)}><option value="2025">2025 — development target</option><option value="2026">2026 — not supported</option><option value="2027">2027 — not supported</option><option value="2028">2028 — not supported</option></select></label><label>Filing status<select value={filingStatus} onChange={(e) => setFilingStatus(e.target.value)}><option value="single">Single</option><option value="joint">Married filing jointly</option><option value="separate">Married filing separately</option><option value="head">Head of household</option><option value="survivor">Qualifying surviving spouse</option></select></label><label>Dependents<select value={hasDependents} onChange={(e) => setHasDependents(e.target.value)}><option value="unknown">Not reviewed yet</option><option value="no">No dependents in return</option><option value="yes">Dependents — requires additional review</option></select></label></div><div className="v2-note"><strong>2025 eligibility facts — explicit answers required.</strong> Unknown answers do not authorize the simplified standard deduction.</div><div className="v2-form-grid">{([
  ['taxpayer65', 'Taxpayer age 65 or older at end of 2025'],
  ['taxpayerBlind', 'Taxpayer legally blind'],
  ['claimableDependent', 'Someone else can claim taxpayer as dependent'],
  ...((filingStatus === 'joint' || filingStatus === 'separate') ? [['spouse65', 'Spouse age 65 or older at end of 2025'], ['spouseBlind', 'Spouse legally blind']] : [])
] as [keyof ProfileFacts2025, string][]).map(([key, label]) => <label key={key}>{label}<select value={profileFacts[key]} onChange={e => updateProfileFact(key, e.target.value as Answer2025)}><option value="unknown">Not reviewed</option><option value="no">No</option><option value="yes">Yes</option></select></label>)}</div><div className="v2-note">Simple deduction eligibility: {profileReview.simpleStandardDeductionEligible ? 'Facts support the simplified path; further verification still required.' : 'Not established — advanced deduction calculations are not implemented.'}</div><div className="v2-note">Identity verification, residency, dependent eligibility, and other filing-status rules will be added before real returns are supported.</div></section>}
      {(step === 'income' || (step === 'review' && reviewTab === 'diagnostics')) && <NextGen2025SourceLedger year={year} wages={selectedWages ? wages : []} interest={interest} payer={payer} incomeKinds={incomeKinds} onNavigate={go} />}
      {step === 'income' && <NextGen2025ScheduleC year={year} />}
      {(step === 'income' || (step === 'review' && reviewTab === 'diagnostics')) && <NextGen2025ScheduleCBridge year={year} />}
      {(step === 'income' || (step === 'review' && reviewTab === 'diagnostics')) && <NextGen2025ScheduleSE year={year} />}
      {(step === 'income' || (step === 'review' && reviewTab === 'diagnostics')) && <NextGen2025SelfEmploymentPipeline year={year} />}
      {step === 'review' && <section className="v2-card phase36-workspace" aria-label="Unified federal review workspace">
        <span className="v2-eyebrow">PHASE 36 / UNIFIED REVIEW WORKSPACE</span>
        <h2>Federal return review</h2>
        <p>One workspace for the fictional 2025 draft. Switch views without changing the tax calculation or losing entered data.</p>
        <div className="phase36-tabs" role="tablist" aria-label="Review workspace views">
          {([['return','Tax Return'],['validation','Validation'],['diagnostics','Developer Diagnostics']] as const).map(([id,label]) =>
            <button key={id} type="button" role="tab" id={`phase36-tab-${id}`} aria-selected={reviewTab === id} aria-controls={`phase36-panel-${id}`} className={reviewTab === id ? 'phase36-tab-active' : ''} onClick={() => setReviewTab(id)}>{label}</button>
          )}
        </div>
        <div role="tabpanel" id={`phase36-panel-${reviewTab}`} aria-labelledby={`phase36-tab-${reviewTab}`} className="phase36-summary">
          {reviewTab === 'return' && <><h3>Form 1040 — draft source view</h3><p>Source amounts and limited reconciliations appear below. Tax, refund and filing authorization are not established.</p><div className="v2-review-grid"><div><span>W-2 wages</span><strong>{selectedWages && wageEntriesValid ? usd(wageCents) : 'Unverified'}</strong></div><div><span>1099-INT interest</span><strong>{selectedInterest ? (interestValid ? usd(interestCents) : 'Unverified') : 'Not selected'}</strong></div><div><span>Federal withholding</span><strong>{selectedWages && wageEntriesValid ? usd(withholdingCents) : 'Unverified'}</strong></div></div></>}
          {reviewTab === 'validation' && <><h3>Outstanding validation</h3><p>Review source and eligibility findings before any further calculation.</p><div className="v2-review-grid"><div><span>Readiness blockers</span><strong>{readiness.filter(f => f.severity === 'blocker').length}</strong></div><div><span>Source errors</span><strong>{sourceIntegrity.findings.filter(f => f.severity === 'error').length}</strong></div><div><span>Filing</span><strong>Disabled</strong></div></div></>}
          {reviewTab === 'diagnostics' && <><h3>Developer reports and calculation audits</h3><p>Advanced source traceability, Schedule C/SE dependencies, reconciliation worksheets and regression reports are retained below. A passing test does not certify IRS compliance.</p></>}
        </div>
        <div className="v2-note"><strong>TEST MODE.</strong> Fictional data only. PDF filing and e-file remain disabled.</div>
      </section>}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025UnifiedGraph year={year} wages={selectedWages && wageEntriesValid ? wageCents : null} withholding={selectedWages && wageEntriesValid ? withholdingCents : null} interest={selectedInterest && interestValid ? interestCents : null} schedule={scheduleCandidates} deduction={engine.lines['12e'] === null ? null : Math.round(engine.lines['12e'] * 100)} incomeReviewed={otherIncomeReviewed} schedulesReviewed={schedulesEligibilityReviewed} deductionReviewed={deductionEligibilityReviewed} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025CrossScheduleReconciliation year={year} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025FederalBalanceValidation year={year} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025ScenarioRegression year={year} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025CalculationCoverage year={year} />}
      {step === 'income' && <NextGen2025DocumentAudit year={year} wages={wages} interest={interest} payer={payer} incomeKinds={incomeKinds} onNavigate={go} />}
      {step === 'income' && <section className="v2-card legacy-income-control" aria-label="Income document validation dashboard">
        <div className="legacy-register-head"><div><span className="v2-eyebrow">DOCUMENT VALIDATION / 2025</span><h2>Income entry quality</h2><p>Check the source documents before proceeding to Form 1040. Amounts are kept as integer cents for reconciliation.</p></div><button type="button" className="v2-secondary" onClick={() => go('review')}>Open Form 1040 →</button></div>
        <div className="legacy-interview-kpis"><div><span>W-2 Box 1</span><strong>{!selectedWages ? 'Not selected' : wageEntriesValid ? usd(wageCents) : 'Incomplete'}</strong></div><div><span>W-2 Box 2</span><strong>{!selectedWages ? 'Not selected' : wageEntriesValid ? usd(withholdingCents) : 'Incomplete'}</strong></div><div><span>1099-INT Box 1</span><strong>{!selectedInterest ? 'Not selected' : interestValid && payer.trim() ? usd(interestCents) : 'Incomplete'}</strong></div></div>
        <ul className="legacy-source-checklist">
          {selectedWages && wages.map((w,index) => <li key={w.id}><span className={w.employer.trim() && money(w.wages)!==null && money(w.withholding)!==null ? 'legacy-valid' : 'legacy-incomplete'}>{w.employer.trim() && money(w.wages)!==null && money(w.withholding)!==null ? '✓' : '!'}</span><span>W-2 #{index+1} — {w.employer.trim() || 'Employer missing'}: {money(w.wages)===null ? 'Box 1 incomplete' : money(w.withholding)===null ? 'Box 2 incomplete' : 'source fields entered'}</span><button type="button" onClick={() => focusIncome('legacy-w2-editor')}>Edit</button></li>)}
          {selectedInterest && <li><span className={interestValid && payer.trim() ? 'legacy-valid' : 'legacy-incomplete'}>{interestValid && payer.trim() ? '✓' : '!'}</span><span>1099-INT — {payer.trim() || 'Payer missing'}: {interestValid ? 'Box 1 entered' : 'Box 1 incomplete'}</span><button type="button" onClick={() => focusIncome('legacy-interest-editor')}>Edit</button></li>}
        </ul>
      </section>}
      {step === 'income' && <section className="v2-card legacy-guided-profile" aria-label="Income entry guide">
        <div className="legacy-register-head"><div><span className="v2-eyebrow">INCOME INTERVIEW</span><h2>Enter your income documents</h2><p>Use the document register to add or edit W-2 and 1099-INT examples. Amounts must have no more than two decimal places.</p></div><button type="button" className="v2-secondary" onClick={() => setShowSampleHelp(v => !v)}>{showSampleHelp ? 'Hide guide' : 'How to enter documents'}</button></div>
        {showSampleHelp && <div className="legacy-interview-help"><strong>W-2:</strong> use Box 1 wages and Box 2 federal income tax withheld. <strong>1099-INT:</strong> use Box 1 taxable interest. Enter fictional data only; other boxes and tax situations are not supported by this simplified editor.</div>}
        <div className="legacy-interview-kpis"><div><span>W-2 records</span><strong>{selectedWages ? wages.length : 0}</strong></div><div><span>W-2 validation</span><strong>{wageEntriesValid ? 'Complete' : 'Needs review'}</strong></div><div><span>Interest validation</span><strong>{interestValid ? 'Complete' : 'Needs review'}</strong></div></div>
      </section>}
      {step === 'income' && <section className="v2-card legacy-document-register" aria-label="Income document register">
        <div className="legacy-register-head"><div><span className="v2-eyebrow">FEDERAL DOCUMENT CENTER / 2025</span><h2>Income documents</h2><p>Manage fictional source documents before reviewing Form 1040. Unsupported income categories remain blocked.</p></div><div className="legacy-register-buttons"><button type="button" className="v2-secondary" onClick={() => { if (!selectedWages) setIncomeKinds(k => [...k, 'W-2 wages']); setWages(old => [...old, { id: Math.max(0, ...old.map(w => w.id)) + 1, employer: '', wages: '', withholding: '' }]); focusIncome('legacy-w2-editor') }} disabled={wages.length >= 100}>+ New W-2</button><button type="button" className="v2-secondary" onClick={() => { if (!selectedInterest) setIncomeKinds(k => [...k, '1099-INT interest']); focusIncome('legacy-interest-editor') }}>+ 1099-INT</button></div></div>
        <label className="legacy-document-search">Find document<input value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} placeholder="Search by document type or fictional label" /></label>
        <div className="legacy-document-table" role="table" aria-label="Source documents">
          <div className="legacy-document-row legacy-document-heading" role="row"><span>Document</span><span>Fictional source</span><span>Amount</span><span>Status</span><span>Action</span></div>
          {selectedWages && wages.filter((w,index) => (`w-2 ${index+1} ${w.employer}`).toLowerCase().includes(documentSearch.toLowerCase())).map(w => <div key={w.id} className="legacy-document-row" role="row"><strong>W-2</strong><span>{w.employer || 'Not entered'}</span><span>{money(w.wages) === null ? '—' : usd(money(w.wages)!)}</span><span className={w.employer.trim() && money(w.wages)!==null && money(w.withholding)!==null ? 'legacy-valid' : 'legacy-incomplete'}>{w.employer.trim() && money(w.wages)!==null && money(w.withholding)!==null ? 'Entered' : 'Incomplete'}</span><button type="button" onClick={() => focusIncome('legacy-w2-editor')}>Edit</button></div>)}
          {selectedInterest && (`1099-int ${payer}`).toLowerCase().includes(documentSearch.toLowerCase()) && <div className="legacy-document-row" role="row"><strong>1099-INT</strong><span>{payer || 'Not entered'}</span><span>{money(interest)===null ? '—' : usd(money(interest)!)}</span><span className={payer.trim() && money(interest)!==null ? 'legacy-valid' : 'legacy-incomplete'}>{payer.trim() && money(interest)!==null ? 'Entered' : 'Incomplete'}</span><button type="button" onClick={() => focusIncome('legacy-interest-editor')}>Edit</button></div>}
        </div><p className="legacy-register-footnote">Entered means fields are syntactically complete, not that tax treatment has been verified. No personal taxpayer data should be entered.</p>
      </section>}
      {step === 'income' && <section className="v2-card"><span className="v2-eyebrow">STEP 02</span><h2>Income sources</h2><p>Choose the income categories in your tax return draft. Unsupported categories will be flagged in Review.</p><div className="v2-check-grid">{['W-2 wages','1099-INT interest','1099-DIV dividends','1099-NEC / self-employment','Capital gains','Retirement income','Rental income','Other income'].map((kind) => <label className="v2-check" key={kind}><input type="checkbox" checked={incomeKinds.includes(kind)} onChange={() => toggleKind(kind)}/>{kind}</label>)}</div><div className="legacy-income-summary" aria-label="Income document summary"><div><span>W-2 records</span><strong>{selectedWages ? wages.length : 0}</strong></div><div><span>Wages (draft)</span><strong>{wageEntriesValid ? usd(wageCents) : 'Review required'}</strong></div><div><span>Federal tax withheld</span><strong>{wageEntriesValid ? usd(withholdingCents) : 'Review required'}</strong></div><div><span>Taxable interest</span><strong>{selectedInterest ? (interestValid ? usd(interestCents) : 'Review required') : 'Not selected'}</strong></div></div>{selectedWages && <div className="v2-income-block" id="legacy-w2-editor"><h3>W-2 documents</h3>{wages.map((w, index) => <div key={w.id} className="v2-wage"><div className="v2-wage-title"><strong>W-2 #{index + 1}</strong>{wages.length > 1 && <button className="v2-text-button" onClick={() => setWages((old) => old.filter((item) => item.id !== w.id))}>Remove</button>}</div><div className="v2-form-grid"><label>Employer name<input value={w.employer} onChange={(e) => updateWage(w.id, 'employer', e.target.value)} placeholder="Fictional employer (test only)"/></label><label>Box 1 — wages ($)<input inputMode="decimal" value={w.wages} onChange={(e) => updateWage(w.id, 'wages', e.target.value)} placeholder="75000.00"/></label><label>Box 2 — federal withholding ($)<input inputMode="decimal" value={w.withholding} onChange={(e) => updateWage(w.id, 'withholding', e.target.value)} placeholder="9000.00"/></label></div></div>)}<button className="v2-secondary" onClick={() => setWages((old) => [...old, { id: Math.max(0, ...old.map((w) => w.id)) + 1, employer: '', wages: '', withholding: '' }])} disabled={wages.length >= 100}>+ Add another W-2</button>{!wageEntriesValid && <p className="v2-inline-warning">Each W-2 needs an employer label and valid dollar amounts (up to two decimal places).</p>}</div>}{selectedInterest && <div className="v2-income-block" id="legacy-interest-editor"><h3>1099-INT</h3><label className="v2-narrow-label">Payer<input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Fictional payer (test only)"/></label><label className="v2-narrow-label">Box 1 — taxable interest ($)<input inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="250.00"/></label></div>}</section>}
      {step === 'income' && <NextGen2025ScheduleEditors kind="B" year={year} draft={scheduleDraft} onChange={setScheduleDraft} interest1040={interest} />}
      {step === 'income' && <section className="legacy-next-action"><div><strong>Next: Deductions</strong><span>Review the deduction path after entering fictional income documents.</span></div><button type="button" className="v2-primary" onClick={() => go('deductions')}>Continue to deductions →</button></section>}
      {step === 'income' && year === '2025' && <NextGen2025Schedules onReconcile={setScheduleCandidates} />}
      {step === 'deductions' && <section className="v2-card legacy-guided-profile" aria-label="Deduction interview">
        <span className="v2-eyebrow">DEDUCTION INTERVIEW / 2025</span><h2>Choose your deduction path</h2>
        <div className="legacy-deduction-paths"><div><strong>Standard deduction</strong><p>Uses the IRS-defined standard deduction when the taxpayer facts and supported scenario have been reviewed. Age, blindness and dependent eligibility may change the calculation.</p><button type="button" className="v2-secondary" onClick={() => go('profile')}>Review eligibility facts →</button></div><div><strong>Itemized deductions (Schedule A)</strong><p>Requires documented medical expenses, taxes, interest, gifts and statutory limits. This preview does not calculate or claim Schedule A.</p><span className="legacy-incomplete">Calculation not enabled</span></div></div>
        <p className="legacy-register-footnote">These explanations do not establish eligibility or compute a filing-ready deduction.</p>
      </section>}
      {step === 'deductions' && <NextGen2025ScheduleEditors kind="A" year={year} draft={scheduleDraft} onChange={setScheduleDraft} interest1040={interest} />}
      {step === 'deductions' && <section className="v2-card"><span className="v2-eyebrow">STEP 03</span><h2>Deductions and adjustments</h2><p>Choose a review path. A selection here does not establish tax eligibility.</p><div className="v2-choice-grid">{[{id:'standard',title:'Standard deduction',detail:'Eligibility and the applicable amount must be verified.'},{id:'itemized',title:'Itemized deductions',detail:'Schedule A substantiation and limitations are required.'},{id:'unknown',title:'Not sure yet',detail:'Leave this unresolved until more information is available.'}].map((option) => <button key={option.id} className={`v2-choice ${deduction === option.id ? 'selected' : ''}`} onClick={() => setDeduction(option.id)}><strong>{option.title}</strong><small>{option.detail}</small></button>)}</div><label className="v2-check"><input type="checkbox" checked={basicDeductionConfirmed} disabled={!profileReview.simpleStandardDeductionEligible} onChange={(e) => setBasicDeductionConfirmed(e.target.checked)}/>For this return only: simplified standard deduction facts reviewed. This is not a determination of all tax eligibility.</label><label className="v2-check"><input type="checkbox" checked={noOtherItemsConfirmed} onChange={(e) => setNoOtherItemsConfirmed(e.target.checked)}/>For this return only: no other income, adjustments, credits, or additional taxes.</label><div className="v2-note">Qualified tips, overtime, senior and vehicle-loan-interest deductions require their own eligibility reviews under 2025 law. No deductions are automatically claimed in this foundation.</div></section>}
      {(step === 'income' || (step === 'review' && reviewTab === 'diagnostics')) && <NextGen2025IncomeBridge input={{ year, wagesSelected: selectedWages, wageRows: wages, interestSelected: selectedInterest, interest, payer, schedule: scheduleCandidates, scheduleReconciled: scheduleIncomeReview.status === 'reconciled', upstreamBlockers: scheduleIncomeReview.blockers }} onNavigate={go} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025LineTrace input={{year, wagesSelected:selectedWages, wageRows:wages.map(w=>({wages:w.wages,withholding:w.withholding})), interestSelected:selectedInterest, interest, line1a:engine.lines['1a'], line2b:engine.lines['2b'], line9:engine.lines['9'], line11a:engine.lines['11a'], line12e:engine.lines['12e'], line15:engine.lines['15'], line16:worksheetTax.status==='computed'?worksheetTax.line16TaxDollars:null, sourceMapped:engine.status==='mapped', taxVerified:worksheetTax.status==='computed'}} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025Integrated1040 input={{year, filingStatus, line1a:engine.lines['1a'],line2b:engine.lines['2b'],line9:engine.lines['9'],line11a:engine.lines['11a'],line12e:engine.lines['12e'],line15:engine.lines['15'],line16:worksheetTax.status==='computed'?worksheetTax.line16TaxDollars:null,withholdingCents:wageEntriesValid&&selectedWages?withholdingCents:null,sourceMapped:engine.status==='mapped',scheduleReconciled:scheduleIncomeReview.status==='reconciled',deductionReviewed:basicDeductionConfirmed&&deductionEligibilityReviewed,creditsAndOtherTaxesExcluded:noOtherItemsConfirmed}} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025ScheduleDependencies input={{year,line1a:engine.lines['1a'],line2b:engine.lines['2b'],line9:engine.lines['9'],line11a:engine.lines['11a'],line12e:engine.lines['12e'],line15:engine.lines['15'],line16:worksheetTax.status==='computed'?worksheetTax.line16TaxDollars:null,schedule1Reviewed:schedulesEligibilityReviewed&&otherIncomeReviewed&&scheduleIncomeReview.status==='reconciled',schedule2Reviewed:noOtherItemsConfirmed,schedule3Reviewed:noOtherItemsConfirmed,incomeSourcesValidated:engine.status==='mapped',deductionsValidated:basicDeductionConfirmed&&deductionEligibilityReviewed,ordinaryTaxMethodReviewed:ordinaryTaxMethodConfirmed}} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025ScheduleABD input={{year,deduction,deductionReviewed:deductionEligibilityReviewed,interestSelected:selectedInterest,interest,payer,dividendSelected:incomeKinds.includes('1099-DIV dividends'),capitalGainsSelected:incomeKinds.includes('Capital gains'),sourceMapped:engine.status==='mapped'}} onNavigate={go} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025UnifiedLedger input={{year:Number(year),wagesSelected:selectedWages,wages:wages.map(w=>({wages:w.wages,withholding:w.withholding})),interestSelected:selectedInterest,interest,sourceMapped:engine.status==='mapped',scheduleReconciled:scheduleIncomeReview.status==='reconciled',deductionReviewed:basicDeductionConfirmed&&deductionEligibilityReviewed,taxReviewed:ordinaryTaxMethodConfirmed&&worksheetTax.status==='computed',line1a:engine.lines['1a'],line2b:engine.lines['2b'],line9:engine.lines['9'],line11a:engine.lines['11a'],line12e:engine.lines['12e'],line15:engine.lines['15'],line16:worksheetTax.status==='computed'?worksheetTax.line16TaxDollars:null}} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025RegressionSuite />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025CreditBalance year={year} verifiedTaxCents={worksheetTax.status === 'computed' ? worksheetTax.line16TaxDollars * 100 : null} withholdingCents={wageEntriesValid && selectedWages ? withholdingCents : null} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025DeductionCreditAudit input={{ year, filingStatus, adjustedGrossIncomeCents: engine.lines['11a'] === null ? null : Math.round(engine.lines['11a'] * 100), deductionCents: engine.lines['12e'] === null ? null : Math.round(engine.lines['12e'] * 100), selectedDeduction: deduction, baseDeductionReviewed: basicDeductionConfirmed && deductionEligibilityReviewed && profileReview.simpleStandardDeductionEligible, dependentEligibilityReviewed: profileReview.simpleStandardDeductionEligible, noOtherItemsConfirmed, sourceValidated: engine.status === 'mapped' && scheduleIncomeReview.status === 'reconciled', specialTaxMethodsExcluded: ordinaryTaxMethodConfirmed }} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025TaxScenario year={year} filingStatus={filingStatus} incomeCents={engine.lines['11a'] === null ? null : Math.round(engine.lines['11a'] * 100)} deductionCents={engine.lines['12e'] === null ? null : Math.round(engine.lines['12e'] * 100)} sourceValidated={engine.status === 'mapped' && scheduleIncomeReview.status === 'reconciled'} deductionValidated={deduction === 'standard' && basicDeductionConfirmed && deductionEligibilityReviewed && profileReview.simpleStandardDeductionEligible} specialTaxMethodsExcluded={ordinaryTaxMethodConfirmed && noOtherItemsConfirmed} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025CalculationGate input={{ year, wagesSelected: selectedWages, wageRows: wages, interestSelected: selectedInterest, interest, payer, schedule: scheduleCandidates, scheduleReconciled: scheduleIncomeReview.status === 'reconciled', upstreamBlockers: scheduleIncomeReview.blockers }} onNavigate={go} />}
      {(step === 'income' || (step === 'review' && reviewTab === 'diagnostics')) && <NextGen2025ScheduleBridgeAudit year={year} candidates={scheduleCandidates} reconciled={scheduleIncomeReview.status === 'reconciled'} blockers={scheduleIncomeReview.blockers} onNavigate={go} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025DocumentAudit year={year} wages={wages} interest={interest} payer={payer} incomeKinds={incomeKinds} onNavigate={go} />}
      {step === 'review' && reviewTab === 'validation' && <section className="v2-card legacy-review-action-center" aria-label="Return review action center"><div className="legacy-register-head"><div><span className="v2-eyebrow">RETURN REVIEW / ACTION CENTER</span><h2>Items requiring attention</h2><p>Resolve draft data issues before reviewing calculation previews. This checklist does not certify filing readiness.</p></div><button type="button" className="v2-secondary" onClick={() => setShowAllReview(v => !v)}>{showAllReview ? 'Show fewer' : 'Show all findings'}</button></div>
      <div className="legacy-action-count"><strong>{readiness.filter(f => f.severity === 'blocker').length}</strong><span>blocking readiness findings</span><strong>{sourceIntegrity.findings.filter(f => f.severity === 'error').length}</strong><span>source errors</span></div>
      <div className="legacy-review-actions">{readiness.filter(f => f.severity === 'blocker').slice(0, showAllReview ? undefined : 5).map((f, i) => <div className="legacy-review-action" key={i}><span className="legacy-incomplete">Needs review</span><span>{f.title}</span><button type="button" onClick={() => go(f.area)}>Open {f.area} →</button></div>)}{readiness.filter(f => f.severity === 'blocker').length === 0 && <p>No blocking readiness findings from this limited checklist. Filing is still disabled.</p>}</div></section>}
      {step === 'review' && reviewTab === 'return' && <NextGen2025FormsNavigator year={year} onNavigate={go} onDiagnostics={() => setReviewTab('diagnostics')} />}
      {step === 'review' && reviewTab === 'return' && <div id="ng38-form1040"><NextGen2025FormWorkspace
        year={year}
        filingStatus={filingStatus}
        wages={{ selected: selectedWages, valid: wageEntriesValid, cents: wageCents }}
        interest={{ selected: selectedInterest, valid: interestValid && payer.trim().length > 0, cents: interestCents }}
        withholding={{ selected: selectedWages, valid: wageEntriesValid, cents: withholdingCents }}
        onNavigate={go}
      /></div>}
      {step === 'review' && reviewTab === 'return' && <section className="legacy-review-summary" aria-label="Federal return summary"><div><span>Wages</span><strong>{wageEntriesValid ? usd(wageCents) : 'Incomplete'}</strong></div><div><span>Interest</span><strong>{selectedInterest ? (interestValid ? usd(interestCents) : 'Incomplete') : 'Not selected'}</strong></div><div><span>Withholding</span><strong>{wageEntriesValid ? usd(withholdingCents) : 'Incomplete'}</strong></div><div><span>Filing status</span><strong>{filingStatus.replace(/^(.)/, c => c.toUpperCase())}</strong></div><p>Draft source values only. Tax, refund and filing remain unavailable until independently validated.</p></section>}
      {step === 'review' && reviewTab === 'validation' && <section className="v2-card" aria-label="2025 consolidated readiness checklist">
        <span className="v2-eyebrow">CONSOLIDATED 2025 REVIEW</span>
        <h2>Return readiness — action plan</h2>
        <p>This assessment consolidates profile, source validation, deduction eligibility and Form 1040 reconciliation. It does not certify IRS filing readiness.</p>
        <div className="v2-review-grid"><div><span>Open blockers</span><strong>{readiness.filter(f => f.severity === 'blocker').length}</strong></div><div><span>Review items</span><strong>{readiness.filter(f => f.severity === 'review').length}</strong></div><div><span>Filing authorization</span><strong>DISABLED</strong></div></div>
        <button type="button" className="v2-secondary" onClick={downloadReadiness}>Export readiness checklist (CSV)</button>
        <ul className="v2-blockers">{readiness.map(item => <li key={item.id}><strong>{item.severity.toUpperCase()} — {item.title}</strong><div>{item.action}</div><button type="button" className="v2-text-button" onClick={() => go(item.area)}>Open {item.area}</button></li>)}</ul>
      </section>}
      {step === 'review' && reviewTab === 'return' && <section className="v2-card" aria-label="2025 source to 1040 reconciliation"><span className="v2-eyebrow">2025 / SOURCE-TO-1040 CONTROL</span><h2>Source-to-Form-1040 reconciliation</h2><p>Independent cross-checks of W-2, 1099-INT and restricted Form 1040 lines. Age, blindness and dependent-claimability facts require explicit review; unsupported tax situations remain blocked. No filing or refund is authorized.</p><div className="v2-review-grid"><div><span>Cross-checks</span><strong>{source1040.checks.filter(c => c.passed).length}/{source1040.checks.length}</strong></div><div><span>Blocking issues</span><strong>{source1040.issues.filter(i => i.severity === 'blocked').length}</strong></div><div><span>Mapping status</span><strong>{source1040.status.toUpperCase()}</strong></div></div><button type="button" onClick={() => { const blob = new Blob([reconciliationCsv2025(source1040)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'nextgen-2025-1040-reconciliation.csv'; link.click(); URL.revokeObjectURL(url); setNotice('Diagnostic reconciliation exported without taxpayer names or amounts.') }}>Export reconciliation CSV (no amounts)</button><details><summary>View cross-checks and {source1040.issues.length} findings</summary><ul className="v2-blockers">{source1040.checks.map(c => <li key={c.id}>{c.passed ? 'PASS' : 'BLOCKED'} — {c.id}</li>)}{source1040.issues.map((i, n) => <li key={`${i.code}-${n}`}><strong>{i.severity.toUpperCase()} — {i.code}</strong><div>{i.message}</div></li>)}</ul></details></section>}
      {step === 'review' && reviewTab === 'return' && <section className="v2-card" aria-label="2025 Schedule-aware federal income reconciliation">
        <span className="v2-eyebrow">MAJOR STAGE / 2025 FEDERAL INCOME</span>
        <h2>Schedule-aware Form 1040 income calculation</h2>
        <p>Reconciles W-2, taxable interest, Schedule 1 additional income and adjustments, AGI and taxable income using integer cents. The preview is blocked unless the full supported income scope and deduction eligibility have been independently reviewed. It is not a filed return.</p>
        <label className="v2-check"><input type="checkbox" checked={schedulesEligibilityReviewed} onChange={e => setSchedulesEligibilityReviewed(e.target.checked)} />I independently checked Schedule 1 line classifications and eligibility.</label>
        <label className="v2-check"><input type="checkbox" checked={otherIncomeReviewed} onChange={e => setOtherIncomeReviewed(e.target.checked)} />I reviewed other income categories and confirmed that no additional Form 1040 income lines apply to this restricted calculation.</label>
        <label className="v2-check"><input type="checkbox" checked={deductionEligibilityReviewed} onChange={e => setDeductionEligibilityReviewed(e.target.checked)} />I independently reviewed the deduction amount and eligibility.</label>
        {scheduleIncomeReview.status === 'reconciled' && scheduleIncomeReview.lines && <div className="v2-review-grid">{Object.entries(scheduleIncomeReview.lines).map(([line, cents]) => <div key={line}><span>Form 1040 line {line} — {scheduleIncomeReview.provenance[line]}</span><strong>{usd(cents)}</strong></div>)}</div>}
        {scheduleIncomeReview.blockers.length > 0 && <ul className="v2-blockers">{scheduleIncomeReview.blockers.map((blocker, i) => <li key={i}>{blocker}</li>)}</ul>}
        <div className="v2-note"><strong>Filing status: NOT READY.</strong> Schedule 2/3 credits, additional taxes, payment ordering, Form 1040 line 16 and final refund/amount owed still require separate verified computation. This preview does not change the authoritative tax engine.</div>
      </section>}
      {step === 'review' && reviewTab === 'validation' && <NextGen2025ExceptionRegister input={{year, wageEntries:selectedWages ? wages : [], interestSelected:selectedInterest, interest1040:interest, interestPayer1040:payer, scheduleA:{medical:scheduleDraft.medical,stateTaxes:scheduleDraft.stateTaxes,propertyTaxes:scheduleDraft.propertyTaxes,mortgageInterest:scheduleDraft.mortgageInterest,charity:scheduleDraft.charity},scheduleB:{interestPayers:scheduleDraft.interestPayers,dividends:scheduleDraft.dividends},deductionChoice:deduction, mappedWagesDollars:engine.lines['1a'],mappedInterestDollars:engine.lines['2b'],mappedWithholdingDollars:null}} onNavigate={go} />}
      {step === 'review' && reviewTab === 'validation' && <NextGen2025QualityAssurance input={{year, wageEntries:selectedWages ? wages : [], interestSelected:selectedInterest, interest1040:interest, interestPayer1040:payer, scheduleA:{medical:scheduleDraft.medical,stateTaxes:scheduleDraft.stateTaxes,propertyTaxes:scheduleDraft.propertyTaxes,mortgageInterest:scheduleDraft.mortgageInterest,charity:scheduleDraft.charity},scheduleB:{interestPayers:scheduleDraft.interestPayers,dividends:scheduleDraft.dividends},deductionChoice:deduction, mappedWagesDollars:engine.lines['1a'],mappedInterestDollars:engine.lines['2b'],mappedWithholdingDollars:null}} />}
      {step === 'review' && reviewTab === 'validation' && <NextGen2025ReleaseReadiness input={{year, wageEntries:selectedWages ? wages : [], interestSelected:selectedInterest, interest1040:interest, interestPayer1040:payer, scheduleA:{medical:scheduleDraft.medical,stateTaxes:scheduleDraft.stateTaxes,propertyTaxes:scheduleDraft.propertyTaxes,mortgageInterest:scheduleDraft.mortgageInterest,charity:scheduleDraft.charity},scheduleB:{interestPayers:scheduleDraft.interestPayers,dividends:scheduleDraft.dividends},deductionChoice:deduction, mappedWagesDollars:engine.lines['1a'],mappedInterestDollars:engine.lines['2b'],mappedWithholdingDollars:null}} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025CalculationIntegrity input={{year, wageEntries:selectedWages ? wages : [], interestSelected:selectedInterest, interest1040:interest, interestPayer1040:payer, scheduleA:{medical:scheduleDraft.medical,stateTaxes:scheduleDraft.stateTaxes,propertyTaxes:scheduleDraft.propertyTaxes,mortgageInterest:scheduleDraft.mortgageInterest,charity:scheduleDraft.charity},scheduleB:{interestPayers:scheduleDraft.interestPayers,dividends:scheduleDraft.dividends},deductionChoice:deduction, mappedWagesDollars:engine.lines['1a'],mappedInterestDollars:engine.lines['2b'],mappedWithholdingDollars:null}} onNavigate={go} />}
      {step === 'review' && reviewTab === 'diagnostics' && <NextGen2025DocumentBridge input={{year, wageEntries:wages, interestSelected:incomeKinds.includes('1099-INT interest'), interest1040:interest, interestPayer1040:payer, scheduleA:{medical:scheduleDraft.medical,stateTaxes:scheduleDraft.stateTaxes,propertyTaxes:scheduleDraft.propertyTaxes,mortgageInterest:scheduleDraft.mortgageInterest,charity:scheduleDraft.charity},scheduleB:{interestPayers:scheduleDraft.interestPayers,dividends:scheduleDraft.dividends},deductionChoice:deduction}} onNavigate={go} />}
      {step === 'review' && reviewTab === 'diagnostics' && <section className="v2-card" aria-label="Schedule A B draft review"><span className="v2-eyebrow">PHASE 21 / DRAFT SOURCE RECONCILIATION</span><h2>Schedule A/B — saved draft and reconciliation</h2><p>Fictional source entries are included in scenario JSON export/import and retained for this browser tab. They are not posted to Form 1040 or used to calculate tax.</p><div className="v2-review-grid"><div><span>Schedule A raw expenses (not allowable deduction)</span><strong>{usd(scheduleReview.aSum)}</strong></div><div><span>Schedule B interest (not posted)</span><strong>{usd(scheduleReview.bSum)}</strong></div><div><span>Schedule B ordinary dividends (not posted)</span><strong>{usd(scheduleReview.dividendCents)}</strong></div><div><span>Entry validation</span><strong>{scheduleReview.valid ? 'Syntax valid' : 'Correction required'}</strong></div></div>{[...scheduleReview.aErrors,...scheduleReview.bErrors].map((message,i)=><p key={i} role="alert">{message}</p>)}{scheduleDraft.interestPayers.some(p=>p.amount.trim()) && money(interest)!==null && scheduleReview.bSum!==money(interest) && <p role="alert">Schedule B interest differs from the existing 1099-INT source. Review both entries; no automatic overwrite.</p>}<div className="v2-note"><strong>Not filing ready:</strong> Source eligibility, statutory limitations, duplicate documents, Schedule B filing requirements and tax-year-specific rules must be verified independently.</div></section>}
      {step === 'review' && reviewTab === 'diagnostics' && <><section className="v2-card"><span className="v2-eyebrow">STEP 04</span><h2>Return coverage review</h2><p>This is a source summary, <strong>not a tax calculation or a completed Form 1040</strong>.</p><div className="v2-review-grid"><div><span>Filing status</span><strong>{filingStatus.replace(/^(.)/, (letter) => letter.toUpperCase())}</strong></div><div><span>W-2 wages (draft)</span><strong>{wageEntriesValid ? usd(wageCents) : 'Needs review'}</strong></div><div><span>W-2 withholding (draft)</span><strong>{wageEntriesValid ? usd(withholdingCents) : 'Needs review'}</strong></div><div><span>1099-INT interest (draft)</span><strong>{interestValid ? usd(interestCents) : 'Needs review'}</strong></div></div></section><section className="v2-card"><span className="v2-eyebrow">TAX ENGINE 2025 / SOURCE MAPPING</span><h2>Form 1040 — restricted line preview</h2><p>Uses validated W-2 and 1099-INT source amounts. This is not a complete IRS return or tax liability computation.</p><p><strong>Source mapping: {engine.status === 'mapped' ? 'Validated for this limited scenario' : 'Blocked pending review'}</strong></p>{engine.status === 'mapped' && <div className="v2-review-grid">{Object.entries(engine.lines).map(([line, amount]) => <div key={line}><span>Form 1040 line {line}</span><strong>{amount === null ? 'Unavailable' : usd(Math.round(amount * 100))}</strong></div>)}</div>}{engine.blockers.length > 0 && <ul className="v2-blockers">{engine.blockers.map((item, i) => <li key={i}>{item}</li>)}</ul>}<h3>Not yet implemented</h3><ul className="v2-blockers">{engine.unsupported.map((item, i) => <li key={i}>{item}</li>)}</ul></section><section className="v2-card"><span className="v2-eyebrow">FEDERAL RETURN COVERAGE / 2025</span><h2>Form 1040 readiness and dependency review</h2><p>This checklist distinguishes source mapping from complete IRS tax calculation. A passed source mapping does not authorize filing.</p><div className="v2-review-grid"><div><span>Limited checks passed</span><strong>{federalReview.summary.passed}</strong></div><div><span>Blocked source checks</span><strong>{federalReview.summary.blocked}</strong></div><div><span>Modules not implemented</span><strong>{federalReview.summary.notImplemented}</strong></div></div><ul className="v2-blockers">{federalReview.items.map(item => <li key={item.id}><strong>{item.status === 'passed' ? 'PASS' : item.status === 'blocked' ? 'BLOCKED' : 'NOT IMPLEMENTED'} — {item.title}</strong>{item.relatedLines.length > 0 && <span> (1040: {item.relatedLines.join(', ')})</span>}<div>{item.detail}</div></li>)}</ul><div className="v2-note"><strong>Filing readiness: NOT READY.</strong> Filing PDF export and IRS e-file remain disabled, even when the limited W-2 / interest mapping passes.</div></section><section className="v2-card"><span className="v2-eyebrow">IRS 2025 / LINE 16 TAX COMPUTATION WORKSHEET</span><h2>Federal income tax — official worksheet (restricted)</h2><p>Uses the published IRS 2025 worksheet for taxable income of at least $100,000. Below $100,000 the IRS Tax Table is required. Special tax methods are not automatically inferred.</p><label className="v2-check"><input type="checkbox" checked={ordinaryTaxMethodConfirmed} onChange={(e) => setOrdinaryTaxMethodConfirmed(e.target.checked)}/>For this return only, I have reviewed and ruled out qualified dividends, capital gains and other special line 16 tax calculation methods.</label>{worksheetTax.status === 'computed' ? <div className="v2-review-grid"><div><span>IRS worksheet section</span><strong>{worksheetTax.worksheetSection}</strong></div><div><span>Applicable rate</span><strong>{worksheetTax.ratePercent}%</strong></div><div><span>IRS subtraction amount</span><strong>{usd(Math.round(worksheetTax.subtractionDollars * 100))}</strong></div><div><span>Calculated line 16 (whole dollars)</span><strong>{usd(worksheetTax.line16TaxDollars * 100)}</strong></div></div> : <div className="v2-note"><strong>Calculation blocked:</strong> {worksheetTax.reason}</div>}<p>Restricted calculation only. Additional taxes, credits, payments, refund and filing remain subject to independent verification. No return is submitted.</p></section><section className="v2-card"><span className="v2-eyebrow">FORM 1040 / ARITHMETIC RECONCILIATION</span><h2>Federal tax and payment balance</h2><p>A new independent arithmetic module verifies Form 1040 lines 16–37 after all tax, credit and payment components have been independently established. It checks line 18, 21, 22, 24, 32, 33, 34 and 37 using integer cents.</p><div className="v2-note"><strong>Current state: {arithmeticReview.status === 'blocked' ? 'BLOCKED — awaiting verified IRS tax and credit inputs' : 'Reconciled (not filing ready)'}.</strong> The system does not guess line 16, assume missing credits are zero, or present an estimated refund as a real result.</div></section><section className="v2-card" aria-label="Schedules 1 2 3 Form 1040 cross-step reconciliation">
        <span className="v2-eyebrow">2025 / CROSS-SCHEDULE RECONCILIATION</span>
        <h2>Schedules 1, 2 and 3 — Form 1040 line candidates</h2>
        <p>Values entered in the Income step remain visible during Review. These are unposted candidate totals, not completed tax liability or an IRS filing authorization.</p>
        <div className="v2-review-grid">{([['8', scheduleCandidates.line8], ['10', scheduleCandidates.line10], ['17', scheduleCandidates.line17], ['20', scheduleCandidates.line20], ['23', scheduleCandidates.line23], ['31', scheduleCandidates.line31]] as [string, number | null][]).map(([line, value]) => <div key={line}><span>Form 1040 line {line}</span><strong>{value === null ? 'Pending review' : usd(Math.round(value * 100))}</strong></div>)}</div>
        <div className="v2-note"><strong>{scheduleCandidates.blocked ? 'Posting blocked' : 'Candidate review complete — posting still blocked'}.</strong> {scheduleCandidates.entryCount} source record(s). Full eligibility, line-specific rules, ordering, and cross-form verification are required before amounts can change the authoritative Form 1040 calculation.</div>
      </section><NextGen2025TaxBalance mapping={engine} worksheet={worksheetTax}/><NextGen2025FederalReturn income={scheduleIncomeReview} schedules={scheduleCandidates} w2WithholdingCents={wageEntriesValid && selectedWages ? withholdingCents : null} /><section className="v2-card"><h3>Why filing is not enabled</h3><p>All blocking items must be resolved and independently validated before production use.</p><ul className="v2-blockers">{blocking.map((item) => <li key={item}>{item}</li>)}</ul><div className="v2-note">No tax due, refund, IRS PDF, or e-file output is generated from this foundation preview.</div></section></>}
      <div className="v2-footer-actions"><button className="v2-secondary" onClick={() => current > 0 ? go(steps[current - 1].id) : setNotice('You are already at the beginning.')}>← Back</button><div className="v2-footer-right"><span>Step {current + 1} of {steps.length}</span>{current < steps.length - 1 ? <button className="v2-primary" onClick={next}>Continue →</button> : <button className="v2-primary" onClick={() => go('overview')}>Return to overview</button>}</div></div>{notice && <p role="status">{notice}</p>}
      <footer className="v2-legal">USTaxes NextGen 2.0 Foundation · Development preview only · No real taxpayer information · <a href="https://www.irs.gov/forms-pubs/about-form-1040" target="_blank" rel="noopener noreferrer">Official IRS Form 1040 resources</a></footer>
    </main>
  </div>
}
