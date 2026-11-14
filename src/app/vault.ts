/**
 * Optional password protection for everything the app keeps in this browser.
 *
 * When it is on, every app key in localStorage holds AES-256-GCM ciphertext; the key is derived
 * from the password with PBKDF2-SHA256 (600,000 iterations) and lives only in memory while the
 * app is unlocked. Reads come from a decrypted in-memory copy, so the rest of the app keeps its
 * synchronous storage interface; writes are encrypted and stored in the background, in order.
 * There is no recovery: a forgotten password means the data cannot be read.
 */
import type { KV } from './store.ts'

export const APP_PREFIX = 'ustaxes-nextgen:'
export const VAULT_KEY = `${APP_PREFIX}vault`
/** Settings that stay readable before unlocking (they hold no personal data). */
export const PLAIN_KEYS = new Set([VAULT_KEY, `${APP_PREFIX}privacy-ack`, `${APP_PREFIX}autolock`])
export const VAULT_ITERATIONS = 600000
const CHECK_TEXT = 'ustaxes-nextgen vault v1'
const ENC_PREFIX = 'enc1:'

/** localStorage-like storage whose keys can be listed. */
export interface ListableKV extends KV {
  readonly length: number
  key(index: number): string | null
}

interface VaultMeta { v: 1; salt: string; iterations: number; check: string }

const b64 = (bytes: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const unb64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

export function appKeys(storage: ListableKV): string[] {
  const out: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && k.startsWith(APP_PREFIX) && !PLAIN_KEYS.has(k)) out.push(k)
  }
  return out
}

export function hasVault(storage: KV): boolean {
  try { return !!storage.getItem(VAULT_KEY) } catch { return false }
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function seal(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(text)))
  return `${ENC_PREFIX}${b64(iv)}:${b64(cipher)}`
}

async function open(key: CryptoKey, value: string): Promise<string> {
  if (!value.startsWith(ENC_PREFIX)) return value
  const [iv, data] = value.slice(ENC_PREFIX.length).split(':')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) as BufferSource }, key, unb64(data) as BufferSource)
  return new TextDecoder().decode(plain)
}

/** Storage that the app reads and writes while unlocked. */
export class VaultKV implements KV {
  private data: Map<string, string>
  private storage: ListableKV
  private key: CryptoKey
  private queue: Promise<void> = Promise.resolve()
  private waiting = 0
  failed = false

  constructor(storage: ListableKV, key: CryptoKey, initial: Map<string, string>) {
    this.storage = storage
    this.key = key
    this.data = initial
  }

  getItem(k: string): string | null {
    if (PLAIN_KEYS.has(k)) return this.storage.getItem(k)
    return this.data.get(k) ?? null
  }

  setItem(k: string, v: string): void {
    if (PLAIN_KEYS.has(k)) { this.storage.setItem(k, v); return }
    this.data.set(k, v)
    this.enqueue(async () => {
      if (this.data.get(k) !== v) return // a newer write supersedes this one
      const sealed = await seal(this.key, v)
      if (this.data.get(k) === v) this.storage.setItem(k, sealed)
    })
  }

  removeItem(k: string): void {
    if (PLAIN_KEYS.has(k)) { this.storage.removeItem(k); return }
    this.data.delete(k)
    this.enqueue(async () => { if (!this.data.has(k)) this.storage.removeItem(k) })
  }

  /** Writes not yet stored. */
  get pending(): number { return this.waiting }

  /** Resolves when every write so far is stored. */
  flushed(): Promise<void> { return this.queue }

  private enqueue(job: () => Promise<void>): void {
    this.waiting++
    this.queue = this.queue.then(job).catch(() => { this.failed = true }).finally(() => { this.waiting-- })
  }

  /** Re-encrypts everything under a new password. */
  async changePassword(password: string, iterations = VAULT_ITERATIONS): Promise<void> {
    await this.flushed()
    const { key, meta } = await newVaultKey(password, iterations)
    for (const [k, v] of this.data) this.storage.setItem(k, await seal(key, v))
    this.storage.setItem(VAULT_KEY, JSON.stringify(meta))
    this.key = key
  }

  /** Turns protection off: stores everything as plain text again. */
  async disable(): Promise<void> {
    await this.flushed()
    for (const [k, v] of this.data) this.storage.setItem(k, v)
    this.storage.removeItem(VAULT_KEY)
  }
}

async function newVaultKey(password: string, iterations: number): Promise<{ key: CryptoKey; meta: VaultMeta }> {
  if (password.length < 8) throw new Error('Use a password of at least 8 characters.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(password, salt, iterations)
  return { key, meta: { v: 1, salt: b64(salt), iterations, check: await seal(key, CHECK_TEXT) } }
}

/** Turns protection on: encrypts every app key already stored. */
export async function createVault(storage: ListableKV, password: string, iterations = VAULT_ITERATIONS): Promise<VaultKV> {
  const { key, meta } = await newVaultKey(password, iterations)
  const data = new Map<string, string>()
  for (const k of appKeys(storage)) {
    const v = storage.getItem(k)
    if (v === null) continue
    data.set(k, v)
    storage.setItem(k, await seal(key, v))
  }
  storage.setItem(VAULT_KEY, JSON.stringify(meta))
  return new VaultKV(storage, key, data)
}

/** Opens protected storage; throws on a wrong password. */
export async function unlockVault(storage: ListableKV, password: string): Promise<VaultKV> {
  const raw = storage.getItem(VAULT_KEY)
  if (!raw) throw new Error('This browser has no password-protected data.')
  const meta = JSON.parse(raw) as VaultMeta
  const key = await deriveKey(password, unb64(meta.salt), meta.iterations)
  try {
    if ((await open(key, meta.check)) !== CHECK_TEXT) throw new Error('check')
  } catch {
    throw new Error('Wrong password.')
  }
  const data = new Map<string, string>()
  for (const k of appKeys(storage)) {
    const v = storage.getItem(k)
    if (v === null) continue
    data.set(k, await open(key, v))
  }
  return new VaultKV(storage, key, data)
}

/** Removes everything this app stored in the browser (returns, settings, cached app files). */
export async function eraseEverything(storage: ListableKV): Promise<number> {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && k.startsWith(APP_PREFIX)) keys.push(k)
  }
  keys.forEach((k) => storage.removeItem(k))
  try {
    if (typeof caches !== 'undefined') for (const name of await caches.keys()) if (name.startsWith('ustaxes')) await caches.delete(name)
  } catch { /* not available */ }
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister()
  } catch { /* not available */ }
  return keys.length
}

/** Bytes this app keeps in localStorage (UTF-16, as browsers count it). */
export function storedBytes(storage: ListableKV): number {
  let n = 0
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && k.startsWith(APP_PREFIX)) n += (k.length + (storage.getItem(k)?.length ?? 0)) * 2
  }
  return n
}
