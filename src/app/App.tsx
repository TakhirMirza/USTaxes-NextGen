import { ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { computeReturn } from '../engine/compute.ts'
import type { Issue, TaxReturnResult } from '../engine/compute.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { AboutStep, DeductionsStep, IncomeStep, PaymentsStep } from './steps'
import type { Setter } from './steps'
import { ReviewStep } from './review'
import { CompareStep } from './compare'
import { exampleReturn, hasEntries } from './example'
import { usd } from './fields'
import {
  KEYS, createReturn, displayName, duplicateReturn, loadIndex, loadPreparer, loadReturn, memoryKV,
  removeReturn, savePreparer, setActive, touchReturn, updateMeta
} from './store.ts'
import type { KV, PreparerProfile, ReturnIndex, ReturnMeta } from './store.ts'
import { restoreBackup } from './backup.ts'
import { LetterPage, Masthead, PrivacyGate, ReturnsPage, SettingsPage } from './pages'
import { LockScreen, PrivacyPage, SecurityContext, AUTOLOCK_KEY, DEFAULT_AUTOLOCK_MINUTES } from './security'
import type { SecurityApi } from './security'
import { createVault, eraseEverything, hasVault, unlockVault } from './vault.ts'
import type { ListableKV, VaultKV } from './vault.ts'
import './app.css'

const STEPS = [
  { path: 'about', title: 'About you', blurb: 'Filing status and household' },
  { path: 'income', title: 'Income', blurb: 'W-2, 1099, retirement, business, rentals, K-1' },
  { path: 'deductions', title: 'Deductions', blurb: 'HSA, adjustments, 2025 deductions, Schedule A' },
  { path: 'payments', title: 'Credits & payments', blurb: 'EIC, child, care, education, saver’s credits' },
  { path: 'review', title: 'Review', blurb: 'Form 1040, IRS forms, letter' },
  { path: 'compare', title: 'What if', blurb: 'Compare scenarios side by side' }
] as const
type StepPath = (typeof STEPS)[number]['path']
const stepForIssue: Record<Issue['step'], StepPath> = { about: 'about', income: 'income', deductions: 'deductions', credits: 'payments', review: 'review' }

/** localStorage when the browser allows it; memory otherwise (private modes that block storage). */
function pickStorage(): { kv: KV; persistent: boolean } {
  try {
    const probe = '__ustaxes_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return { kv: window.localStorage, persistent: true }
  } catch {
    return { kv: memoryKV(), persistent: false }
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

function Workspace({ ret, set, result, current, preparer, meta, onExample, onStatus, onSaveAsReturn }: {
  ret: TaxReturnInput; set: Setter; result: TaxReturnResult; current: StepPath; preparer: PreparerProfile
  meta: ReturnMeta; onExample: () => void; onStatus: (s: ReturnMeta['status']) => void
  onSaveAsReturn: (data: TaxReturnInput, label: string) => void
}): ReactElement {
  const navigate = useNavigate()
  const [summaryOpen, setSummaryOpen] = useState(false)
  const index = STEPS.findIndex((s) => s.path === current)
  const go = (path: StepPath): void => { navigate(`/${path}`); window.scrollTo({ top: 0 }) }
  const issueCount = (path: StepPath): number => result.issues.filter((i) => i.level !== 'info' && stepForIssue[i.step] === path).length
  const props = { ret, set, result }
  const step = STEPS[index]

  return (
    <div className="app">
      <Masthead current={displayName(meta, ret)} status={meta.status} page="return" onExample={onExample} />

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
        {current === 'review' && <ReviewStep {...props} preparer={preparer} status={meta.status} onStatus={onStatus} onGo={(s) => go(stepForIssue[s])} />}
        {current === 'compare' && <CompareStep {...props} onSaveAsReturn={onSaveAsReturn} />}

        <footer className="pager">
          {index > 0 ? <button type="button" className="button is-quiet" onClick={() => go(STEPS[index - 1].path)}>Back to {STEPS[index - 1].title}</button> : <span />}
          {index < STEPS.length - 1 && <button type="button" className="button" onClick={() => go(STEPS[index + 1].path)}>Continue to {STEPS[index + 1].title}</button>}
        </footer>
        <p className="disclaimer">
          USTaxes NextGen is an open-source preparation aid, not tax advice. It prints IRS forms to sign and mail; it does not e-file.
          Not yet covered: like-kind exchanges, casualty losses, estates and trusts (K-1 from Form 1041), foreign income, and state returns.
        </p>
      </main>

      <Summary result={result} open={summaryOpen} onToggle={() => setSummaryOpen((o) => !o)} />
    </div>
  )
}

function ReturnsApp({ storage, registerFlush }: { storage: { kv: KV; persistent: boolean }; registerFlush: (flush: () => void) => void }): ReactElement {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const kv = storage.kv

  const [index, setIndex] = useState<ReturnIndex>(() => {
    const i = loadIndex(kv)
    return i.returns.length ? i : createReturn(kv, i).index
  })
  const [preparer, setPreparer] = useState<PreparerProfile>(() => loadPreparer(kv))
  const [privacyOk, setPrivacyOk] = useState<boolean>(() => { try { return kv.getItem(KEYS.privacy) === '1' } catch { return false } })
  const activeId = index.activeId ?? index.returns[0]?.id ?? ''
  const [doc, setDoc] = useState<{ id: string; data: TaxReturnInput }>(() => ({ id: activeId, data: loadReturn(kv, activeId) }))
  const dirty = useRef(false)
  const [saveFailed, setSaveFailed] = useState(false)

  // Switching returns loads the selected one.
  useEffect(() => {
    if (activeId && doc.id !== activeId) {
      dirty.current = false
      setDoc({ id: activeId, data: loadReturn(kv, activeId) })
    }
  }, [activeId, doc.id, kv])

  // Saving: every index change is written at once, so the stored index always matches state.
  // flush() writes the open return synchronously; autosave calls it 300 ms after the last edit,
  // and it also runs before switching returns and when the page is hidden or closed.
  const docRef = useRef(doc)
  docRef.current = doc
  const flush = (): void => {
    if (!dirty.current) return
    dirty.current = false
    const { id, data } = docRef.current
    const { index: next, saved } = touchReturn(kv, loadIndex(kv), id, data)
    setSaveFailed(!saved)
    setIndex(next)
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => { registerFlush(() => flushRef.current()) }, [registerFlush])
  useEffect(() => {
    if (!dirty.current) return
    const t = window.setTimeout(() => flushRef.current(), 300)
    return () => window.clearTimeout(t)
  }, [doc])
  useEffect(() => {
    const onHide = (): void => flushRef.current()
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => { window.removeEventListener('pagehide', onHide); window.removeEventListener('beforeunload', onHide) }
  }, [kv])

  const result = useMemo(() => computeReturn(doc.data), [doc.data])
  const set: Setter = (fn) => { dirty.current = true; setDoc((d) => ({ ...d, data: fn(d.data) })) }

  const open = (id: string): void => { flush(); setIndex((prev) => setActive(kv, prev, id)); navigate('/about'); window.scrollTo({ top: 0 }) }
  const newReturn = (data?: TaxReturnInput, label = ''): void => {
    flush()
    const created = createReturn(kv, loadIndex(kv), data, label)
    setIndex(created.index)
    navigate('/about')
    window.scrollTo({ top: 0 })
  }
  const onExample = (): void => newReturn(exampleReturn(), 'Example household')
  const meta = index.returns.find((m) => m.id === doc.id) ?? index.returns[0]

  const banner = !storage.persistent || saveFailed
    ? <p className="storage-warning" role="alert">{!storage.persistent ? 'This browser is blocking storage, so nothing will be saved after you close the page. Download a backup from Settings before leaving.' : 'Your browser refused to save the latest changes (storage may be full). Download a backup from Settings now.'}</p>
    : null
  const gate = !privacyOk ? <PrivacyGate onAccept={() => { try { kv.setItem(KEYS.privacy, '1') } catch { /* ignore */ } setPrivacyOk(true) }} /> : null

  if (pathname === '/returns' || pathname === '/settings' || pathname === '/privacy') {
    return (
      <div className="app is-wide">
        {gate}
        <Masthead current="" page={pathname === '/returns' ? 'returns' : pathname === '/settings' ? 'settings' : 'privacy'} onExample={onExample} />
        {banner}
        {pathname === '/privacy' ? <PrivacyPage returnsCount={index.returns.length} /> : pathname === '/returns'
          ? <ReturnsPage kv={kv} index={index} onOpen={open} onNew={() => newReturn()}
              onDuplicate={(id) => { const d = duplicateReturn(kv, index, id); setIndex(d.index) }}
              onDelete={(id) => {
                let next = removeReturn(kv, index, id)
                if (!next.returns.length) next = createReturn(kv, next).index
                setIndex(next)
              }}
              onMeta={(id, patch) => setIndex((prev) => updateMeta(kv, prev, id, patch))} />
          : <SettingsPage kv={kv} index={index} preparer={preparer}
              onPreparer={(p) => { setPreparer(p); savePreparer(kv, p) }}
              onRestore={(backup, withPreparer) => {
                setIndex((prev) => {
                  // Drop the blank return a fresh browser starts with, so a restore doesn't leave it behind.
                  const lone = prev.returns.length === 1 ? prev.returns[0] : null
                  const base = lone && !lone.label && !hasEntries(loadReturn(kv, lone.id)) ? removeReturn(kv, prev, lone.id) : prev
                  const restored = restoreBackup(kv, base, backup).index
                  const activeId = base.returns.length ? prev.activeId : restored.returns[0]?.id ?? null
                  return activeId ? setActive(kv, restored, activeId) : restored
                })
                if (withPreparer && backup.preparer) { setPreparer(backup.preparer); savePreparer(kv, backup.preparer) }
              }} />}
      </div>
    )
  }

  if (pathname === '/letter') return <LetterPage ret={doc.data} result={result} preparer={preparer} usePreparer={doc.data.usePaidPreparer} />

  const step = STEPS.find((s) => pathname === `/${s.path}`)
  if (!step) return <Navigate to={(pathname === '/' || pathname === '/start') && index.returns.length > 1 ? '/returns' : '/about'} replace />
  if (!meta) return <Navigate to="/returns" replace />
  return (
    <>
      {gate}
      {banner}
      <Workspace ret={doc.data} set={set} result={result} current={step.path} preparer={preparer} meta={meta}
        onExample={onExample} onStatus={(status) => setIndex((prev) => updateMeta(kv, prev, meta.id, { status }))}
        onSaveAsReturn={(data, label) => newReturn(data, `${displayName(meta, doc.data)} — ${label}`)} />
    </>
  )
}

type Mode =
  | { kind: 'locked' }
  | { kind: 'plain'; raw: ListableKV }
  | { kind: 'memory'; kv: KV }
  | { kind: 'vault'; raw: ListableKV; vault: VaultKV }

function initialMode(): Mode {
  const picked = pickStorage()
  if (!picked.persistent) return { kind: 'memory', kv: picked.kv }
  const raw = window.localStorage as ListableKV
  return hasVault(raw) ? { kind: 'locked' } : { kind: 'plain', raw }
}

const readAutolock = (): number => {
  try { const n = Number(window.localStorage.getItem(AUTOLOCK_KEY)); return n > 0 ? n : DEFAULT_AUTOLOCK_MINUTES } catch { return DEFAULT_AUTOLOCK_MINUTES }
}

/** Chooses the storage (plain, password-protected, or memory) and handles locking. */
export default function App(): ReactElement {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [autolock, setAutolock] = useState<number>(readAutolock)
  const flushRef = useRef<() => void>(() => undefined)
  const registerFlush = useMemo(() => (f: () => void) => { flushRef.current = f }, [])

  const lock = (): void => {
    if (mode.kind !== 'vault') return
    flushRef.current()
    // Reloading drops the key and every decrypted value from memory.
    void mode.vault.flushed().then(() => window.location.reload())
  }
  const lockRef = useRef(lock)
  lockRef.current = lock

  // Lock after a period without activity.
  useEffect(() => {
    if (mode.kind !== 'vault') return
    let last = Date.now()
    const touch = (): void => { last = Date.now() }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const timer = window.setInterval(() => { if (Date.now() - last > autolock * 60000) lockRef.current() }, 15000)
    const warn = (e: BeforeUnloadEvent): void => { if (mode.vault.pending > 0) e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(timer)
      window.removeEventListener('beforeunload', warn)
    }
  }, [mode, autolock])

  const eraseAll = async (): Promise<void> => {
    await eraseEverything(window.localStorage as ListableKV)
    window.location.hash = '#/about'
    window.location.reload()
  }

  if (mode.kind === 'locked') {
    return (
      <LockScreen
        onUnlock={async (password) => {
          const raw = window.localStorage as ListableKV
          setMode({ kind: 'vault', raw, vault: await unlockVault(raw, password) })
        }}
        onErase={eraseAll} />
    )
  }

  const api: SecurityApi = {
    mode: mode.kind === 'vault' ? 'vault' : mode.kind === 'plain' ? 'plain' : 'memory',
    raw: mode.kind === 'memory' ? null : mode.raw,
    enable: async (password) => {
      if (mode.kind !== 'plain') return
      flushRef.current()
      setMode({ kind: 'vault', raw: mode.raw, vault: await createVault(mode.raw, password) })
    },
    changePassword: async (password) => { if (mode.kind === 'vault') await mode.vault.changePassword(password) },
    disable: async () => {
      if (mode.kind !== 'vault') return
      flushRef.current()
      await mode.vault.disable()
      setMode({ kind: 'plain', raw: mode.raw })
    },
    lock,
    autolockMinutes: autolock,
    setAutolockMinutes: (m) => { setAutolock(m); try { window.localStorage.setItem(AUTOLOCK_KEY, String(m)) } catch { /* ignore */ } },
    eraseAll
  }
  const storage = mode.kind === 'memory' ? { kv: mode.kv, persistent: false } : { kv: mode.kind === 'vault' ? mode.vault : mode.raw, persistent: true }
  return (
    <SecurityContext.Provider value={api}>
      <ReturnsApp key={mode.kind} storage={storage} registerFlush={registerFlush} />
    </SecurityContext.Provider>
  )
}
