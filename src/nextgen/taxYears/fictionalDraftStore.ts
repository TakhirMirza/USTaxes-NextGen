import type { DraftValue } from './fieldResolution'
import { validateDraft } from './fieldResolution'

// Development-only persistence. Never store real taxpayer information.
export const STORAGE_PREFIX = 'ustaxes-nextgen-fictional-drafts-v1:'
export type DraftBook = { schema: 1; taxYear: string; savedAt: string; entries: DraftValue[] }
export type LoadResult = { book: DraftBook; error: string | null }
export function emptyBook(year: string): DraftBook { return { schema: 1, taxYear: year, savedAt: '', entries: [] } }
export function storageKey(year: string): string { return STORAGE_PREFIX + year }
export function validYear(year: string): boolean { return /^20\d{2}$/.test(year) }
export function parseBook(text: string, year: string): LoadResult {
  const empty = emptyBook(year)
  try {
    if (text.length > 150000) return { book: empty, error: 'File exceeds the 150 KB limit.' }
    const obj: unknown = JSON.parse(text)
    if (!obj || typeof obj !== 'object') throw new Error('Not an object')
    const b = obj as Record<string, unknown>
    if (b.schema !== 1 || b.taxYear !== year || !Array.isArray(b.entries) || b.entries.length > 200) throw new Error('Wrong version, tax year, or entry count')
    const ids = new Set<string>(); const entries: DraftValue[] = []
    for (const item of b.entries) {
      if (!item || typeof item !== 'object') throw new Error('Invalid entry')
      const d = item as Record<string, unknown>
      if (typeof d.issueId !== 'string' || !d.issueId || d.issueId.length > 180 || typeof d.sourceKey !== 'string' || d.sourceKey.length > 180 || typeof d.note !== 'string' || d.note.length > 1000 || typeof d.value !== 'string' || validateDraft(d.value)) throw new Error('Invalid draft fields')
      if (ids.has(d.issueId)) throw new Error('Duplicate issue ID')
      ids.add(d.issueId)
      entries.push({issueId:d.issueId,sourceKey:d.sourceKey,value:d.value,note:d.note})
    }
    return { book: { schema: 1, taxYear: year, savedAt: typeof b.savedAt === 'string' ? b.savedAt.slice(0,40) : '', entries }, error:null }
  } catch { return { book: empty, error: 'Invalid or incompatible fictional draft file. Existing drafts were not changed.' } }
}
export function serializeBook(year: string, entries: readonly DraftValue[]): string {
  return JSON.stringify({schema:1,taxYear:year,savedAt:new Date().toISOString(),entries},null,2)
}
export function runPersistenceFixtures(): {name:string;passed:boolean}[] {
  const one:DraftValue = {issueId:'w2-test',sourceKey:'w2',value:'123.45',note:'fictional only'}
  const good = serializeBook('2025',[one]); const parsed = parseBook(good,'2025')
  return [
    {name:'Versioned JSON round-trip preserves cents',passed:parsed.error===null && parsed.book.entries[0]?.value==='123.45'},
    {name:'Tax years are isolated',passed:parseBook(good,'2026').error!==null},
    {name:'Unsupported schema rejected',passed:parseBook(good.replace('"schema": 1','"schema": 99'),'2025').error!==null},
    {name:'Duplicate issue IDs rejected',passed:parseBook(serializeBook('2025',[one,one]),'2025').error!==null},
    {name:'Malformed amount rejected',passed:parseBook(good.replace('123.45','123.456'),'2025').error!==null},
    {name:'Malformed JSON rejected',passed:parseBook('{broken','2025').error!==null},
    {name:'Draft keys are namespaced by year',passed:storageKey('2025')!==storageKey('2026')},
    {name:'Oversized import rejected',passed:parseBook('x'.repeat(150001),'2025').error!==null},
  ]
}
