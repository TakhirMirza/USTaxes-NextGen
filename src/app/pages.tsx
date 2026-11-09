import { ChangeEvent, ReactElement, ReactNode, useMemo, useRef, useState } from 'react'
import { computeReturn } from '../engine/compute.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { FILING_STATUS_LABELS } from '../engine/rules2025.ts'
import * as R from '../engine/rules2025.ts'
import { STATUS_LABELS, displayName, loadReturn, preparerReady } from './store.ts'
import type { KV, PreparerProfile, ReturnIndex, ReturnMeta, ReturnStatus } from './store.ts'
import { decryptBackup, encryptBackup, makeBackup, parseBackupText } from './backup.ts'
import type { BackupFile, EncryptedBackup } from './backup.ts'
import { Check, DigitsField, Section, TextField, usd } from './fields'

const saveFile = (name: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const today = (): string => new Date().toISOString().slice(0, 10)

// ── Masthead shared by every page ────────────────────────────────────────────
export function Masthead({ current, status, page, onExample }: {
  current: string; status?: ReturnStatus; page: 'return' | 'returns' | 'settings'; onExample: () => void
}): ReactElement {
  return (
    <header className="masthead">
      <a className="brand" href="#/returns">
        <span className="brand-mark" aria-hidden="true">1040</span>
        <span>USTaxes <em>NextGen</em></span>
      </a>
      <nav className="masthead-side" aria-label="App">
        {page === 'return'
          ? <span className="current-return">{current}{status && <span className={`status-pill is-${status}`}>{STATUS_LABELS[status]}</span>}</span>
          : <p className="masthead-note">2025 federal returns · private, runs in your browser</p>}
        <a className={`nav-link ${page === 'returns' ? 'is-active' : ''}`} href="#/returns">All returns</a>
        <a className={`nav-link ${page === 'settings' ? 'is-active' : ''}`} href="#/settings">Settings</a>
        <button type="button" className="link-button" onClick={onExample}>Try an example</button>
      </nav>
    </header>
  )
}

// ── Privacy notice shown once ────────────────────────────────────────────────
export function PrivacyGate({ onAccept }: { onAccept: () => void }): ReactElement {
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate-card">
        <h1 id="gate-title">Before you start</h1>
        <ul>
          <li><strong>Your information stays on this device.</strong> Returns are saved in this browser only. Nothing is sent to a server, and no one else, including the people who run this site, can see it.</li>
          <li><strong>On a shared or public computer,</strong> use a private window and delete your returns when you finish (All returns → Delete).</li>
          <li><strong>Clearing browser data erases your returns.</strong> Download a backup from Settings to keep a copy; you can protect it with a password.</li>
          <li><strong>This is a preparation aid, not tax advice.</strong> It prints IRS forms for you to sign and mail; it does not e-file. Check every figure before you file.</li>
        </ul>
        <button type="button" className="button" onClick={onAccept} autoFocus>I understand</button>
      </div>
    </div>
  )
}

// ── All returns ──────────────────────────────────────────────────────────────
interface Row { meta: ReturnMeta; data: TaxReturnInput; result: TaxReturnResult; name: string }

export function ReturnsPage({ kv, index, onOpen, onNew, onDuplicate, onDelete, onMeta }: {
  kv: KV; index: ReturnIndex
  onOpen: (id: string) => void; onNew: () => void; onDuplicate: (id: string) => void
  onDelete: (id: string) => void; onMeta: (id: string, patch: Partial<ReturnMeta>) => void
}): ReactElement {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | 'all'>('all')
  const rows: Row[] = useMemo(() => index.returns.map((meta) => {
    const data = loadReturn(kv, meta.id)
    return { meta, data, result: computeReturn(data), name: displayName(meta, data) }
  }), [kv, index])
  const shown = rows.filter((r) => (statusFilter === 'all' || r.meta.status === statusFilter) && r.name.toLowerCase().includes(query.trim().toLowerCase()))
  const counts = (s: ReturnStatus): number => rows.filter((r) => r.meta.status === s).length

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Returns</h1>
          <p className="page-sub">{rows.length} {rows.length === 1 ? 'return' : 'returns'} in this browser{rows.length > 0 && ` · ${counts('ready')} ready to file · ${counts('filed')} filed`}</p>
        </div>
        <button type="button" className="button" onClick={onNew}>New return</button>
      </div>

      {rows.length > 3 && (
        <div className="filters">
          <input type="search" placeholder="Search by name" aria-label="Search returns by name" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReturnStatus | 'all')}>
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_LABELS) as ReturnStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]} ({counts(s)})</option>)}
          </select>
        </div>
      )}

      {shown.length === 0 && <p className="empty">{rows.length ? 'No returns match.' : 'No returns yet. Start a new one.'}</p>}
      {shown.length > 0 && (
        <table className="returns-table">
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Filing status</th><th scope="col" className="num">Refund / owed</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {shown.map(({ meta, data, result, name }) => {
              const s = result.summary
              const blocking = result.issues.filter((i) => i.level !== 'info').length
              return (
                <tr key={meta.id} className={meta.id === index.activeId ? 'is-active' : ''}>
                  <td data-label="Name">
                    <button type="button" className="row-title" onClick={() => onOpen(meta.id)}>{name}</button>
                    {meta.notes && <small className="row-notes">{meta.notes}</small>}
                    {blocking > 0 && meta.status !== 'filed' && <small className="row-flag">{blocking} item{blocking > 1 ? 's' : ''} to check</small>}
                  </td>
                  <td data-label="Filing status">{FILING_STATUS_LABELS[data.filingStatus]}</td>
                  <td data-label="Refund / owed" className={`num ${s.amountOwed > 0 ? 'is-owed' : 'is-refund'}`}>
                    {s.amountOwed > 0 ? `Owes ${usd(s.amountOwed)}` : s.refund > 0 ? `Refund ${usd(s.refund)}` : usd(0)}
                  </td>
                  <td data-label="Status">
                    <select aria-label={`Status of ${name}`} value={meta.status} onChange={(e) => onMeta(meta.id, { status: e.target.value as ReturnStatus })}>
                      {(Object.keys(STATUS_LABELS) as ReturnStatus[]).map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                    </select>
                  </td>
                  <td data-label="Updated">{new Date(meta.updatedAt).toLocaleDateString()}</td>
                  <td className="row-actions">
                    <button type="button" className="link-button" onClick={() => onOpen(meta.id)}>Open</button>
                    <button type="button" className="link-button" onClick={() => {
                      const notes = window.prompt(`Notes for ${name}`, meta.notes)
                      if (notes !== null) onMeta(meta.id, { notes: notes.slice(0, 300) })
                    }}>Notes</button>
                    <button type="button" className="link-button" onClick={() => onDuplicate(meta.id)}>Duplicate</button>
                    <button type="button" className="link-button is-danger" onClick={() => {
                      if (window.confirm(`Delete the return for ${name}? This cannot be undone. Download a backup from Settings first if you might need it.`)) onDelete(meta.id)
                    }}>Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="disclaimer">Returns are stored only in this browser. Back them up from Settings.</p>
    </main>
  )
}

// ── Settings: preparer profile and backups ───────────────────────────────────
export function SettingsPage({ kv, index, preparer, onPreparer, onRestore }: {
  kv: KV; index: ReturnIndex; preparer: PreparerProfile
  onPreparer: (p: PreparerProfile) => void
  onRestore: (backup: BackupFile, restorePreparer: boolean) => void
}): ReactElement {
  const fileInput = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<EncryptedBackup | null>(null)
  const [unlock, setUnlock] = useState('')
  const p = preparer
  const patch = (x: Partial<PreparerProfile>): void => onPreparer({ ...p, ...x })
  const ptinBad = p.ptin.trim() !== '' && !/^P\d{8}$/i.test(p.ptin.trim())

  const download = async (): Promise<void> => {
    setBusy(true)
    setNote('')
    try {
      const backup = makeBackup(kv, index, preparer)
      const body = password ? await encryptBackup(backup, password) : backup
      saveFile(`ustaxes-backup-${today()}${password ? '-encrypted' : ''}.json`, JSON.stringify(body, null, password ? 0 : 2))
      setNote(`Downloaded a backup of ${index.returns.length} return${index.returns.length === 1 ? '' : 's'}${password ? ', encrypted with your password. Without the password it cannot be opened.' : '.'}`)
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const restore = (backup: BackupFile): void => {
    const withPreparer = !!backup.preparer?.name && backup.preparer.name !== preparer.name &&
      window.confirm(`The backup includes the preparer profile for ${backup.preparer.name}. Replace your current profile with it?`)
    onRestore(backup, withPreparer)
    setNote(`Added ${backup.returns.length} return${backup.returns.length === 1 ? '' : 's'} from the backup. Nothing was overwritten.`)
  }
  const pick = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    file.text().then((text) => {
      const parsed = parseBackupText(text)
      if (parsed.kind === 'encrypted') { setPending(parsed.file); setNote('This backup is encrypted. Enter its password.'); return }
      if (parsed.kind === 'backup') { restore(parsed.backup); return }
      restore({ format: 'ustaxes-nextgen-backup', version: 1, createdAt: '', preparer: null, returns: [{ meta: { id: 'single', label: '', status: 'in-progress', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, data: parsed.data }] })
    }).catch((err: unknown) => setNote(err instanceof Error ? err.message : String(err)))
  }
  const decrypt = (): void => {
    if (!pending) return
    setBusy(true)
    decryptBackup(pending, unlock)
      .then((b) => { setPending(null); setUnlock(''); restore(b) })
      .catch((err: unknown) => setNote(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false))
  }

  return (
    <main className="page">
      <div className="page-head"><div><h1>Settings</h1></div></div>

      <Section title="Paid preparer" intro="If you prepare returns for others for pay, these details print in the “Paid Preparer Use Only” box of Form 1040 on returns where you turn it on (Review step).">
        <div className="grid">
          <TextField label="Preparer’s name" value={p.name} onChange={(v) => patch({ name: v })} />
          <div className={`field ${ptinBad ? 'is-invalid' : ''}`}>
            <label htmlFor="ptin"><span>PTIN</span></label>
            <input id="ptin" type="text" autoComplete="off" placeholder="P01234567" value={p.ptin} aria-invalid={ptinBad}
              onChange={(e) => patch({ ptin: e.target.value.toUpperCase().replace(/[^P0-9]/g, '').slice(0, 9) })} />
            <small>{ptinBad ? 'A PTIN is the letter P followed by 8 digits.' : 'From your IRS PTIN account'}</small>
          </div>
          <TextField label="Firm’s name" value={p.firmName} onChange={(v) => patch({ firmName: v })} />
          <DigitsField label="Firm’s EIN" length={9} groups={[2, 7]} value={p.firmEin} onChange={(v) => patch({ firmEin: v })} />
          <div className="span-2"><TextField label="Firm’s address" placeholder="Street, city, state, ZIP" value={p.firmAddress} onChange={(v) => patch({ firmAddress: v })} /></div>
          <TextField label="Phone" value={p.phone} onChange={(v) => patch({ phone: v })} />
        </div>
        <div className="checks"><Check label="I am self-employed" checked={p.selfEmployed} onChange={(v) => patch({ selfEmployed: v })} /></div>
        {preparerReady(p) && <p className="note">Profile complete. Turn on “Paid preparer” in each client’s Review step to print it.</p>}
      </Section>

      <Section title="Back up and restore" intro="A backup holds every return in this browser and your preparer profile, in one file. Add a password to encrypt it (AES-256); without the password the file cannot be read, so store the password safely.">
        <div className="grid">
          <div className="field">
            <label htmlFor="bk-pass"><span>Password (optional)</span></label>
            <input id="bk-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            <small>Recommended when the file leaves this computer</small>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="button" disabled={busy || index.returns.length === 0} onClick={() => { void download() }}>{busy ? 'Working…' : 'Download backup'}</button>
          <button type="button" className="button is-quiet" disabled={busy} onClick={() => fileInput.current?.click()}>Restore from a file</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={pick} />
        </div>
        {pending && (
          <div className="grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="bk-unlock"><span>Backup password</span></label>
              <input id="bk-unlock" type="password" autoComplete="current-password" value={unlock} onChange={(e) => setUnlock(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') decrypt() }} autoFocus />
            </div>
            <div className="actions" style={{ alignSelf: 'end' }}>
              <button type="button" className="button" disabled={busy || !unlock} onClick={decrypt}>Unlock and restore</button>
              <button type="button" className="button is-quiet" onClick={() => { setPending(null); setNote('') }}>Cancel</button>
            </div>
          </div>
        )}
        {note && <p className="note" role="status">{note}</p>}
      </Section>
    </main>
  )
}

// ── Client letter ────────────────────────────────────────────────────────────
const fmtDate = (iso: string): string => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

/** Suggested 2026 quarterly estimates from the prior-year safe harbor, assuming similar withholding. */
export function suggestedEstimates(ret: TaxReturnInput, res: TaxReturnResult): number {
  const f = res.f1040
  const tax = f['22'] + f['23'] - (f['27a'] + f['28'] + f['29'])
  const share = f['11a'] > R.PENALTY_HIGH_AGI[ret.filingStatus] ? R.PENALTY_HIGH_AGI_SHARE : 1
  const needed = tax * share - (f['25d'] + f['31'])
  return needed >= R.PENALTY_MIN_BALANCE ? Math.ceil(needed / 4 / 10) * 10 : 0
}

export function LetterPage({ ret, result, preparer, usePreparer }: { ret: TaxReturnInput; result: TaxReturnResult; preparer: PreparerProfile; usePreparer: boolean }): ReactElement {
  const f = result.f1040
  const s = result.summary
  const joint = ret.filingStatus === 'mfj'
  const names = joint ? `${ret.taxpayer.firstName} and ${ret.spouse.firstName} ${ret.taxpayer.lastName}` : `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`
  const account = ret.refundDeposit.accountNumber.replace(/\D/g, '')
  const deposit = s.refund > 0 && ret.refundDeposit.routingNumber.replace(/\D/g, '').length === 9 && account.length >= 4
  const quarterly = suggestedEstimates(ret, result)
  const open = result.issues.filter((i) => i.level !== 'info')
  const fromPreparer = usePreparer && preparer.name.trim() !== ''
  const steps: ReactNode[] = [
    <>Review the enclosed Form 1040 and schedules. {fromPreparer ? 'Let us know about anything that looks wrong before you sign.' : 'Correct anything that looks wrong before you sign.'}</>,
    <>Sign and date page 2 of Form 1040{joint ? '. Both spouses must sign.' : '.'}</>,
    <>Attach Copy B of every Form W-2{ret.retirement.some((r) => r.federalWithholding > 0) ? ', and any Form 1099-R that shows tax withheld,' : ''} to the front of page 1.</>,
    <>Mail the return to the IRS address for your state, listed at irs.gov/filingaddress. The address is different when you enclose a payment.</>
  ]
  if (s.amountOwed > 0) steps.push(<>Pay {usd(s.amountOwed)} by April 15, 2026: online at irs.gov/payments (IRS Direct Pay), or by check payable to “United States Treasury” with the enclosed Form 1040-V. Write your SSN and “2025 Form 1040” on the check.</>)
  steps.push(<>Keep a copy of this return and your records for at least three years.</>)

  return (
    <main className="letter">
      <div className="letter-tools no-print">
        <a className="link-button" href="#/review">Back to the return</a>
        <button type="button" className="button" onClick={() => window.print()}>Print letter</button>
      </div>
      <article className="letter-sheet">
        <header className="letter-head">
          {fromPreparer ? (
            <div>
              <strong>{preparer.firmName || preparer.name}</strong>
              {preparer.firmAddress && <div>{preparer.firmAddress}</div>}
              {preparer.phone && <div>{preparer.phone}</div>}
            </div>
          ) : <div><strong>2025 federal income tax return</strong></div>}
          <div className="letter-date">{fmtDate(today())}</div>
        </header>
        <address className="letter-to">
          {names.trim() || 'Taxpayer'}<br />
          {ret.contact.street}{ret.contact.apt && `, Apt. ${ret.contact.apt}`}<br />
          {[ret.contact.city, ret.contact.state].filter(Boolean).join(', ')} {ret.contact.zip.replace(/\D/g, '').slice(0, 5)}
        </address>

        <h1>Your 2025 federal income tax return</h1>
        <p>Dear {joint ? `${ret.taxpayer.firstName} and ${ret.spouse.firstName}` : ret.taxpayer.firstName || 'taxpayer'},</p>
        <p>
          {s.amountOwed > 0
            ? <>Your 2025 federal return shows a balance due of <strong>{usd(s.amountOwed)}</strong>{f['38'] > 0 ? `, including an estimated tax penalty of ${usd(f['38'])}` : ''}. It must be paid by April 15, 2026 to avoid further interest and penalties.</>
            : s.refund > 0
              ? <>Your 2025 federal return shows a refund of <strong>{usd(s.refund)}</strong>{deposit ? `, to be deposited to your ${ret.refundDeposit.accountType} account ending in ${account.slice(-4)}` : ', to be mailed as a paper check'}.</>
              : <>Your 2025 federal return shows no refund and no balance due.</>}
        </p>

        <table className="letter-figures">
          <tbody>
            <tr><th scope="row">Filing status</th><td>{FILING_STATUS_LABELS[ret.filingStatus]}</td></tr>
            <tr><th scope="row">Total income</th><td>{usd(s.totalIncome)}</td></tr>
            <tr><th scope="row">Adjusted gross income</th><td>{usd(s.agi)}</td></tr>
            <tr><th scope="row">{result.deduction.used === 'itemized' ? 'Itemized deductions' : 'Standard deduction'}{f['13a'] + f['13b'] > 0 ? ' and other deductions' : ''}</th><td>{usd(f['14'])}</td></tr>
            <tr><th scope="row">Taxable income</th><td>{usd(s.taxableIncome)}</td></tr>
            <tr><th scope="row">Total tax</th><td>{usd(s.totalTax)}</td></tr>
            <tr><th scope="row">Payments and refundable credits</th><td>{usd(s.totalPayments)}</td></tr>
            <tr className="is-key"><th scope="row">{s.amountOwed > 0 ? 'Amount you owe' : 'Refund'}</th><td>{usd(s.amountOwed > 0 ? s.amountOwed : s.refund)}</td></tr>
          </tbody>
        </table>

        <h2>What to do</h2>
        <ol>{steps.map((x, i) => <li key={i}>{x}</li>)}</ol>

        {quarterly > 0 && (
          <>
            <h2>Estimated tax for 2026</h2>
            <p>
              Your withholding did not cover your 2025 tax. To avoid a penalty next year, consider paying about <strong>{usd(quarterly)}</strong> on
              each of these dates: April 15, 2026; June 15, 2026; September 15, 2026; and January 15, 2027 (Form 1040-ES or irs.gov/payments).
              Raising the withholding on your W-4 works too. This assumes your 2026 income and withholding are similar to 2025.
            </p>
          </>
        )}

        {open.length > 0 && (
          <>
            <h2>Please confirm</h2>
            <ul>{open.map((i, n) => <li key={n}>{i.message}</li>)}</ul>
          </>
        )}

        <p>{fromPreparer ? 'Please call if you have any questions.' : 'This summary was prepared with USTaxes NextGen and is not tax advice.'}</p>
        {fromPreparer && <p className="letter-sign">Sincerely,<br /><br />{preparer.name}{preparer.ptin && <><br /><small>PTIN {preparer.ptin.toUpperCase()}</small></>}</p>}
      </article>
    </main>
  )
}
