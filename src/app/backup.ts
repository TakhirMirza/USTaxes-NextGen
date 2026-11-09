/**
 * Backup files: every return plus the preparer profile in one JSON file, optionally encrypted
 * with a password (PBKDF2-SHA256 → AES-256-GCM, Web Crypto). Works in browsers and in Node 22.
 */
import { normalizeReturn } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { createReturn, emptyPreparer, loadReturn, saveIndex } from './store.ts'
import type { KV, PreparerProfile, ReturnIndex, ReturnMeta } from './store.ts'

export interface BackupFile {
  format: 'ustaxes-nextgen-backup'
  version: 1
  createdAt: string
  preparer: PreparerProfile | null
  returns: { meta: ReturnMeta; data: TaxReturnInput }[]
}

export interface EncryptedBackup {
  format: 'ustaxes-nextgen-backup-encrypted'
  version: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  data: string
}

export type ParsedFile =
  | { kind: 'backup'; backup: BackupFile }
  | { kind: 'encrypted'; file: EncryptedBackup }
  | { kind: 'single'; data: TaxReturnInput }

export const PBKDF2_ITERATIONS = 600000

const b64 = (bytes: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const unb64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )
}

export function makeBackup(kv: KV, index: ReturnIndex, preparer: PreparerProfile | null): BackupFile {
  return {
    format: 'ustaxes-nextgen-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    preparer,
    returns: index.returns.map((meta) => ({ meta, data: loadReturn(kv, meta.id) }))
  }
}

export async function encryptBackup(backup: BackupFile, password: string, iterations = PBKDF2_ITERATIONS): Promise<EncryptedBackup> {
  if (password.length < 8) throw new Error('Use a password of at least 8 characters.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, iterations)
  const plain = new TextEncoder().encode(JSON.stringify(backup))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain))
  return { format: 'ustaxes-nextgen-backup-encrypted', version: 1, kdf: 'PBKDF2-SHA256', iterations, salt: b64(salt), iv: b64(iv), data: b64(cipher) }
}

export async function decryptBackup(file: EncryptedBackup, password: string): Promise<BackupFile> {
  const key = await deriveKey(password, unb64(file.salt), file.iterations)
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.iv) as BufferSource }, key, unb64(file.data) as BufferSource)
  } catch {
    throw new Error('Wrong password, or the file is damaged.')
  }
  const parsed = parseBackupText(new TextDecoder().decode(plain))
  if (parsed.kind !== 'backup') throw new Error('The decrypted file is not a USTaxes backup.')
  return parsed.backup
}

/** Recognizes a full backup, an encrypted backup, or a single return saved from the Review step. */
export function parseBackupText(text: string): ParsedFile {
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error('This is not a USTaxes file (it is not valid JSON).') }
  const o = json as Record<string, unknown>
  if (o && o.format === 'ustaxes-nextgen-backup-encrypted') return { kind: 'encrypted', file: o as unknown as EncryptedBackup }
  if (o && o.format === 'ustaxes-nextgen-backup' && Array.isArray(o.returns)) {
    const returns = (o.returns as { meta?: Partial<ReturnMeta>; data?: unknown }[]).map((r, i) => ({
      meta: {
        id: typeof r.meta?.id === 'string' ? r.meta.id : `imported-${i}`,
        label: r.meta?.label ?? '', status: r.meta?.status ?? 'in-progress', notes: r.meta?.notes ?? '',
        createdAt: r.meta?.createdAt ?? new Date().toISOString(), updatedAt: r.meta?.updatedAt ?? new Date().toISOString()
      } as ReturnMeta,
      data: normalizeReturn(r.data)
    }))
    const preparer = o.preparer && typeof o.preparer === 'object' ? { ...emptyPreparer(), ...(o.preparer as Partial<PreparerProfile>) } : null
    return { kind: 'backup', backup: { format: 'ustaxes-nextgen-backup', version: 1, createdAt: String(o.createdAt ?? ''), preparer, returns } }
  }
  if (o && typeof o === 'object' && ('taxpayer' in o || 'filingStatus' in o || 'w2s' in o)) return { kind: 'single', data: normalizeReturn(o) }
  throw new Error('This file is not a USTaxes return or backup.')
}

/** Adds every return from a backup as a new entry (nothing existing is overwritten). */
export function restoreBackup(kv: KV, index: ReturnIndex, backup: BackupFile): { index: ReturnIndex; added: number } {
  let next = index
  for (const r of backup.returns) {
    const created = createReturn(kv, next, r.data, r.meta.label)
    next = {
      ...created.index,
      returns: created.index.returns.map((m) => (m.id === created.id ? { ...m, status: r.meta.status, notes: r.meta.notes, createdAt: r.meta.createdAt } : m))
    }
  }
  saveIndex(kv, next)
  return { index: next, added: backup.returns.length }
}
