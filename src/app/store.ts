/**
 * Local storage for many returns (clients or family members) plus the preparer profile.
 * Everything stays in this browser. The storage object is injected so the logic is testable.
 */
import { emptyReturn, newId, normalizeReturn } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type ReturnStatus = 'in-progress' | 'review' | 'ready' | 'filed'
export const STATUS_LABELS: Record<ReturnStatus, string> = {
  'in-progress': 'In progress',
  review: 'Needs review',
  ready: 'Ready to file',
  filed: 'Filed'
}

export interface ReturnMeta {
  id: string
  /** Shown in the list. Empty means "use the names on the return". */
  label: string
  status: ReturnStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ReturnIndex {
  version: 1
  activeId: string | null
  returns: ReturnMeta[]
}

export interface PreparerProfile {
  name: string
  /** P followed by 8 digits. */
  ptin: string
  selfEmployed: boolean
  firmName: string
  /** 9 digits. */
  firmEin: string
  firmAddress: string
  phone: string
}

export const emptyPreparer = (): PreparerProfile => ({ name: '', ptin: '', selfEmployed: false, firmName: '', firmEin: '', firmAddress: '', phone: '' })

export const KEYS = {
  index: 'ustaxes-nextgen:index',
  returnPrefix: 'ustaxes-nextgen:return:',
  preparer: 'ustaxes-nextgen:preparer',
  privacy: 'ustaxes-nextgen:privacy-ack',
  legacy: 'ustaxes-nextgen:return-2025'
} as const

const now = (): string => new Date().toISOString()

const safeGet = (kv: KV, key: string): string | null => {
  try { return kv.getItem(key) } catch { return null }
}
const safeSet = (kv: KV, key: string, value: string): boolean => {
  try { kv.setItem(key, value); return true } catch { return false }
}

/** Names on the return, e.g. "Rivera, Alex & Sam". */
export function returnName(ret: TaxReturnInput): string {
  const t = ret.taxpayer
  const s = ret.spouse
  if (!t.firstName.trim() && !t.lastName.trim()) return 'Untitled return'
  if (ret.filingStatus === 'mfj' && s.firstName.trim()) {
    return t.lastName.trim() === s.lastName.trim() || !s.lastName.trim()
      ? `${t.lastName}, ${t.firstName} & ${s.firstName}`.trim()
      : `${t.lastName}, ${t.firstName} & ${s.firstName} ${s.lastName}`.trim()
  }
  return t.lastName.trim() ? `${t.lastName}, ${t.firstName}`.trim() : t.firstName.trim()
}

export const displayName = (meta: ReturnMeta, ret: TaxReturnInput | null): string =>
  meta.label.trim() || (ret ? returnName(ret) : 'Untitled return')

export function loadReturn(kv: KV, id: string): TaxReturnInput {
  const raw = safeGet(kv, KEYS.returnPrefix + id)
  if (!raw) return emptyReturn()
  try { return normalizeReturn(JSON.parse(raw)) } catch { return emptyReturn() }
}

export function saveReturn(kv: KV, id: string, data: TaxReturnInput): boolean {
  return safeSet(kv, KEYS.returnPrefix + id, JSON.stringify(data))
}

export function saveIndex(kv: KV, index: ReturnIndex): boolean {
  return safeSet(kv, KEYS.index, JSON.stringify(index))
}

const meta = (id: string, label = ''): ReturnMeta => ({ id, label, status: 'in-progress', notes: '', createdAt: now(), updatedAt: now() })

/** Loads the list of returns, moving a single return saved by older versions into it. */
export function loadIndex(kv: KV): ReturnIndex {
  const raw = safeGet(kv, KEYS.index)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<ReturnIndex>
      const returns = Array.isArray(parsed.returns)
        ? parsed.returns.filter((m) => m && typeof m.id === 'string').map((m) => ({ ...meta(m.id), ...m }))
        : []
      const activeId = returns.some((m) => m.id === parsed.activeId) ? (parsed.activeId as string) : returns[0]?.id ?? null
      return { version: 1, activeId, returns }
    } catch { /* fall through to a fresh index */ }
  }
  const index: ReturnIndex = { version: 1, activeId: null, returns: [] }
  const legacy = safeGet(kv, KEYS.legacy)
  if (legacy) {
    const id = newId('ret')
    try {
      saveReturn(kv, id, normalizeReturn(JSON.parse(legacy)))
      index.returns.push(meta(id))
      index.activeId = id
      saveIndex(kv, index)
      kv.removeItem(KEYS.legacy)
    } catch { /* keep the legacy key if anything fails */ }
  }
  return index
}

export function createReturn(kv: KV, index: ReturnIndex, data: TaxReturnInput = emptyReturn(), label = ''): { index: ReturnIndex; id: string } {
  const id = newId('ret')
  saveReturn(kv, id, data)
  const next: ReturnIndex = { ...index, activeId: id, returns: [meta(id, label), ...index.returns] }
  saveIndex(kv, next)
  return { index: next, id }
}

export function duplicateReturn(kv: KV, index: ReturnIndex, id: string): { index: ReturnIndex; id: string } {
  const source = index.returns.find((m) => m.id === id)
  const data = loadReturn(kv, id)
  const label = source ? `${displayName(source, data)} (copy)` : ''
  return createReturn(kv, index, data, label)
}

export function removeReturn(kv: KV, index: ReturnIndex, id: string): ReturnIndex {
  try { kv.removeItem(KEYS.returnPrefix + id) } catch { /* ignore */ }
  const returns = index.returns.filter((m) => m.id !== id)
  const next: ReturnIndex = { ...index, returns, activeId: index.activeId === id ? returns[0]?.id ?? null : index.activeId }
  saveIndex(kv, next)
  return next
}

export function updateMeta(kv: KV, index: ReturnIndex, id: string, patch: Partial<Omit<ReturnMeta, 'id'>>): ReturnIndex {
  const next: ReturnIndex = { ...index, returns: index.returns.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: now() } : m)) }
  saveIndex(kv, next)
  return next
}

export function setActive(kv: KV, index: ReturnIndex, id: string): ReturnIndex {
  const next = { ...index, activeId: id }
  saveIndex(kv, next)
  return next
}

/** Saves a return and stamps its updated time; returns the new index. */
export function touchReturn(kv: KV, index: ReturnIndex, id: string, data: TaxReturnInput): { index: ReturnIndex; saved: boolean } {
  const saved = saveReturn(kv, id, data)
  const next: ReturnIndex = { ...index, returns: index.returns.map((m) => (m.id === id ? { ...m, updatedAt: now() } : m)) }
  saveIndex(kv, next)
  return { index: next, saved }
}

export function loadPreparer(kv: KV): PreparerProfile {
  const raw = safeGet(kv, KEYS.preparer)
  if (!raw) return emptyPreparer()
  try { return { ...emptyPreparer(), ...(JSON.parse(raw) as Partial<PreparerProfile>) } } catch { return emptyPreparer() }
}

export const savePreparer = (kv: KV, p: PreparerProfile): boolean => safeSet(kv, KEYS.preparer, JSON.stringify(p))

export const preparerReady = (p: PreparerProfile): boolean => p.name.trim() !== '' && /^P\d{8}$/i.test(p.ptin.trim())

/** In-memory storage for tests and for browsers that block localStorage. */
export function memoryKV(): KV & { readonly length: number; key(i: number): string | null } {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)) }, removeItem: (k) => { m.delete(k) },
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null
  }
}
