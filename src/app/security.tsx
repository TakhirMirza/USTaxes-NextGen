/**
 * Privacy and security controls: the password lock screen, password protection settings,
 * erasing everything, and the "How your data is protected" page.
 */
import { createContext, ReactElement, useContext, useEffect, useState } from 'react'
import { Section, TextField } from './fields'
import type { ListableKV } from './vault.ts'
import { appKeys, storedBytes } from './vault.ts'

export const AUTOLOCK_KEY = 'ustaxes-nextgen:autolock'
export const DEFAULT_AUTOLOCK_MINUTES = 15
export const REPO_URL = 'https://github.com/TakhirMirza/USTaxes-NextGen'

export interface SecurityApi {
  /** 'plain' = localStorage without a password; 'vault' = password-protected; 'memory' = storage blocked. */
  mode: 'plain' | 'vault' | 'memory'
  raw: ListableKV | null
  enable: (password: string) => Promise<void>
  changePassword: (password: string) => Promise<void>
  disable: () => Promise<void>
  lock: () => void
  autolockMinutes: number
  setAutolockMinutes: (m: number) => void
  eraseAll: () => Promise<void>
}

export const SecurityContext = createContext<SecurityApi | null>(null)
export const useSecurity = (): SecurityApi | null => useContext(SecurityContext)

const PASSWORD_HINT = 'At least 8 characters. There is no way to recover it: if you forget it, the returns in this browser cannot be opened.'

// ── Lock screen ──────────────────────────────────────────────────────────────
export function LockScreen({ onUnlock, onErase }: { onUnlock: (password: string) => Promise<void>; onErase: () => Promise<void> }): ReactElement {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forgot, setForgot] = useState(false)
  const [confirm, setConfirm] = useState('')
  const submit = async (): Promise<void> => {
    if (!password) return
    setBusy(true)
    setError('')
    try { await onUnlock(password) } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) }
  }
  return (
    <div className="lock">
      <div className="lock-card">
        <span className="brand-mark" aria-hidden="true">1040</span>
        <h1>Your returns are locked</h1>
        <p>The returns in this browser are encrypted with your password. Enter it to open them.</p>
        <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <div className="field">
            <label htmlFor="unlock-password"><span>Password</span></label>
            <input id="unlock-password" type="password" autoComplete="current-password" autoFocus value={password}
              onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </div>
          {error && <p className="note is-warn" role="alert">{error}</p>}
          <button type="submit" className="button" disabled={busy || !password}>{busy ? 'Unlocking…' : 'Unlock'}</button>
        </form>
        {!forgot
          ? <button type="button" className="link-button" onClick={() => setForgot(true)}>Forgot the password?</button>
          : (
            <div className="lock-forgot">
              <p>The password cannot be recovered or reset, and no one, including the people who run this site, can open the data without it. You can restore from a backup file after erasing.</p>
              <TextField label="Type ERASE to delete everything this app stored in this browser" value={confirm} onChange={setConfirm} />
              <button type="button" className="button is-danger" disabled={confirm.trim() !== 'ERASE'} onClick={() => void onErase()}>Erase everything</button>
            </div>
          )}
      </div>
    </div>
  )
}

// ── Settings: password protection and erasing ────────────────────────────────
export function SecuritySection(): ReactElement | null {
  const sec = useSecurity()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState('')
  if (!sec) return null
  const run = async (fn: () => Promise<void>, done: string): Promise<void> => {
    setBusy(true)
    setNote('')
    try { await fn(); setPw(''); setPw2(''); setNote(done) } catch (e) { setNote(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const mismatch = pw2 !== '' && pw !== pw2
  const ready = pw.length >= 8 && pw === pw2 && !busy
  return (
    <>
      <Section title="Password protection" intro="Encrypt every return stored in this browser (AES-256). Recommended on a shared computer or a laptop that leaves the house. You will need the password each time you open the app.">
        {sec.mode === 'memory' && <p className="note is-warn">This browser is blocking storage, so nothing is saved and there is nothing to protect.</p>}
        {sec.mode !== 'memory' && (
          <>
            <p className={`security-state ${sec.mode === 'vault' ? 'is-on' : ''}`}>{sec.mode === 'vault' ? 'On — your returns are stored encrypted.' : 'Off — your returns are stored unencrypted in this browser.'}</p>
            <div className="grid">
              <TextField label={sec.mode === 'vault' ? 'New password' : 'Password'} type="password" autoComplete="new-password" hint={PASSWORD_HINT} value={pw} onChange={setPw} />
              <TextField label="Repeat the password" type="password" autoComplete="new-password" hint={mismatch ? 'The passwords do not match.' : undefined} value={pw2} onChange={setPw2} />
            </div>
            <div className="button-row">
              {sec.mode === 'plain' && <button type="button" className="button" disabled={!ready} onClick={() => void run(() => sec.enable(pw), 'Password protection is on.')}>{busy ? 'Encrypting…' : 'Turn on password protection'}</button>}
              {sec.mode === 'vault' && <button type="button" className="button" disabled={!ready} onClick={() => void run(() => sec.changePassword(pw), 'Password changed.')}>{busy ? 'Encrypting…' : 'Change password'}</button>}
              {sec.mode === 'vault' && <button type="button" className="button is-quiet" disabled={busy} onClick={() => void run(() => sec.disable(), 'Password protection is off.')}>Turn off protection</button>}
              {sec.mode === 'vault' && <button type="button" className="button is-quiet" onClick={sec.lock}>Lock now</button>}
            </div>
            {sec.mode === 'vault' && (
              <div className="autolock">
                <label htmlFor="autolock"><span>Lock automatically after</span></label>
                <select id="autolock" className="select" value={sec.autolockMinutes} onChange={(e) => sec.setAutolockMinutes(Number(e.target.value))}>
                  {[5, 15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes without activity</option>)}
                </select>
              </div>
            )}
            {note && <p className="note" role="status">{note}</p>}
          </>
        )}
      </Section>
      <Section title="Delete everything from this browser" intro="Removes every return, the preparer profile, settings and the offline copy of the app from this browser. It cannot be undone; download a backup first if you need one.">
        <div className="grid">
          <TextField label="Type DELETE to confirm" value={confirm} onChange={setConfirm} />
        </div>
        <button type="button" className="button is-danger" disabled={confirm.trim() !== 'DELETE'} onClick={() => void sec.eraseAll()}>Delete everything</button>
      </Section>
    </>
  )
}

// ── How your data is protected ───────────────────────────────────────────────
export function PrivacyPage({ returnsCount }: { returnsCount: number }): ReactElement {
  const sec = useSecurity()
  const raw = sec?.raw ?? null
  const csp = typeof document !== 'undefined' && !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  const [offline, setOffline] = useState<'ready' | 'pending' | 'unsupported'>('pending')
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) { setOffline('unsupported'); return }
    navigator.serviceWorker.getRegistration().then((r) => setOffline(r?.active ? 'ready' : 'pending')).catch(() => setOffline('unsupported'))
  }, [])
  const kb = raw ? Math.max(1, Math.round(storedBytes(raw) / 1024)) : 0
  const keys = raw ? appKeys(raw).length : 0
  const checks: [boolean, string, string][] = [
    [true, 'Your tax data never leaves this device', 'The app runs entirely in your browser. There is no server, no account and no database, so there is nothing to breach, sell or subpoena.'],
    [csp, 'The browser blocks connections to other sites', csp ? 'A Content Security Policy forbids this page from sending data anywhere except loading its own files. No analytics, no ads, no third-party scripts or fonts.' : 'The Content Security Policy is added in the published build; this copy was not built that way.'],
    [sec?.mode === 'vault', 'Stored returns are encrypted', sec?.mode === 'vault' ? 'Password protection is on: returns are encrypted with AES-256 and locked after inactivity.' : 'Password protection is off. Anyone who uses this browser profile can open your returns. Turn it on in Settings.'],
    [offline === 'ready', 'Works offline', offline === 'ready' ? 'The app and the IRS forms are saved on this device, so it works with no internet connection.' : offline === 'pending' ? 'Reload the page once while online to save the app for offline use.' : 'This browser cannot keep an offline copy.'],
    [true, 'Backups are encrypted', 'Backup files can be protected with a password (AES-256-GCM, PBKDF2 with 600,000 iterations).'],
    [true, 'The code is open', 'Anyone can read the source code and check these claims.']
  ]
  return (
    <main className="page privacy">
      <h1>How your data is protected</h1>
      <p className="lede">Tax returns hold the most sensitive information you have: Social Security numbers, income, bank accounts, your children’s details. USTaxes NextGen is built so that information stays with you.</p>
      <ul className="checks-list">
        {checks.map(([ok, title, text]) => (
          <li key={title} className={ok ? 'is-ok' : 'is-todo'}>
            <span className="mark" aria-hidden="true">{ok ? '✓' : '!'}</span>
            <div><strong>{title}</strong><p>{text}</p></div>
          </li>
        ))}
      </ul>
      <Section title="What is stored in this browser">
        <dl className="facts">
          <div><dt>Returns</dt><dd>{returnsCount}</dd></div>
          <div><dt>Stored items</dt><dd>{keys}</dd></div>
          <div><dt>Space used</dt><dd>{raw ? `${kb} KB` : 'Nothing is saved (storage blocked)'}</dd></div>
          <div><dt>Password protection</dt><dd>{sec?.mode === 'vault' ? 'On' : 'Off'}</dd></div>
        </dl>
        <p><a className="button is-quiet" href="#/settings">Password protection and deleting data</a></p>
      </Section>
      <Section title="What this does not protect against">
        <ul className="plain-list">
          <li>Someone using your computer while the app is open and unlocked.</li>
          <li>Malware, or browser extensions allowed to read every page you visit.</li>
          <li>PDFs and backup files you download: keep them somewhere safe, and use a password on backups.</li>
          <li>GitHub, which hosts the site, sees that your device loaded the page (like any website), but never any tax information.</li>
        </ul>
      </Section>
      <p><a href={REPO_URL} target="_blank" rel="noreferrer noopener">Source code on GitHub</a></p>
    </main>
  )
}
